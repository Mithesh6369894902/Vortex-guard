import sqlparser from 'node-sql-parser';
import type { Check } from '@vertexguard/shared';

const { Parser } = sqlparser;
const parser = new Parser();

export interface GuardOutcome {
  green: boolean;           // no critical failures
  checks: Check[];
  tables: string[];
  columns: string[];        // "table.column" references detected in query
  hasLimit: boolean;
  isSelectOnly: boolean;
}

const DENY_KEYWORDS: Array<[RegExp, string]> = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bDROP\s+DATABASE\b/i, 'DROP DATABASE'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
  [/\bDELETE\s+FROM\b/i, 'DELETE'],
  [/\bUPDATE\s+\w+\s+SET\b/i, 'UPDATE'],
  [/\bINSERT\s+INTO\b/i, 'INSERT'],
  [/\bCOPY\s+\w+/i, 'COPY'],
  [/\bCREATE\s+TABLE\b/i, 'CREATE TABLE'],
  [/\bALTER\s+TABLE\b/i, 'ALTER TABLE'],
  [/\bGRANT\s+.*TO\b/i, 'GRANT'],
  [/\bREVOKE\b/i, 'REVOKE'],
  [/\bEXEC\b/i, 'EXEC'],
  [/\bWAITFOR\b|\bPG_SLEEP\b|\bBENCHMARK\s*\(/i, 'sleep/timing payload'],
  [/\bINTO\s+OUTFILE\b|\bLOAD_FILE\s*\(/i, 'file export payload'],
];

const COMMENT_TRICK = /(--|\/\*)[^;]*(;)\s*\w+/i;

export function runGuard(sql: string): GuardOutcome {
  const checks: Check[] = [];
  let green = true;

  const fail = (title: string, detail: string) => {
    checks.push({ id: `grd-${checks.length + 1}`, engine: 'guard', severity: 'critical', status: 'failed', title, detail });
    green = false;
  };
  const warn = (title: string, detail: string) => {
    checks.push({ id: `grd-${checks.length + 1}`, engine: 'guard', severity: 'warning', status: 'warned', title, detail });
  };
  const pass = (title: string, detail: string) => {
    checks.push({ id: `grd-${checks.length + 1}`, engine: 'guard', severity: 'info', status: 'passed', title, detail });
  };

  // 1. comment-trick / stacked statement attempt
  if (COMMENT_TRICK.test(sql)) {
    fail('Stacked-statement camouflage detected', 'SQL comments contain a second statement - a classic injection trick. Blocked.');
    return { green, checks, tables: [], columns: [], hasLimit: false, isSelectOnly: false };
  }

  // 2. deny keywords (defense in depth even for exotic dialects)
  for (const [re, label] of DENY_KEYWORDS) {
    if (re.test(sql)) fail('Destructive statement rejected', `Query contains forbidden construct: ${label}.`);
  }

  // 3. syntactic parse into a single SELECT AST
  let ast: unknown;
  try {
    ast = parser.astify(sql, { database: 'postgresql' });
  } catch {
    fail('SQL failed to parse', 'Guardian could not build a valid syntax tree - refusing to execute unverifiable SQL.');
  }

  let isSelectOnly = false;
  let tables: string[] = [];
  let columns: string[] = [];
  let hasLimit = false;

  if (ast) {
    const a = ast as any;
    if (Array.isArray(a)) {
      if (a.length === 1) {
        isSelectOnly = checkIsSelect(a[0], sql);
      } else {
        fail('Multiple statements detected', `${a.length} statements sent in a single query - only single SELECT is allowed.`);
      }
    } else {
      isSelectOnly = checkIsSelect(a, sql);
    }
    if (isSelectOnly) {
      hasLimit = sql.toUpperCase().includes('LIMIT');
      try {
        tables = (parser.tableList(sql, { database: 'postgresql' }) as string[])
          .map((t) => t.split('::'))
          .filter((p) => p[0] === 'select')
          .map((p) => (p[2] && p[2] !== 'null' ? p[2] : p[1]))
      } catch {
        /* table list best-effort */
      }
      columns = collectSelectColumns(a);
    }
  }

  if (isSelectOnly) {
    pass('Single read-only statement', 'Query is one SELECT and contains no mutation constructs.');
    if (hasLimit) {
      pass('Row cap present', 'Query bounds the number of returned rows with LIMIT.');
    } else if (/\b(SUM|AVG|COUNT|MIN|MAX|COUNT\s*\(\s*DISTINCT)\b/i.test(sql)) {
      pass('Aggregate result bounded', 'Aggregation collapses the result to a small structured set.');
    } else {
      warn('Unbounded row read', 'No LIMIT clause. Large result sets are truncated at the execution layer, but raw dumps should be bounded.');
    }
    const known = new Set(['products', 'customers', 'orders', 'order_items', 'refunds']);
    const unknown = tables.filter((t) => !known.has(t));
    if (tables.length === 0) {
      warn('No catalog tables referenced', 'Statement touches no known warehouse table.');
    } else if (unknown.length) {
      warn('Unknown tables referenced', `Query mentions [${unknown.join(', ')}], which are not part of the governed catalog.`);
    }
  }

  return { green, checks, tables: [...new Set(tables)], columns: [...new Set(columns)], hasLimit, isSelectOnly };
}

function checkIsSelect(ast: any, sql: string): boolean {
  if (!ast) return false;
  if (ast.type === 'select') return true;
  const up = sql.trim().toUpperCase();
  if (/^SELECT\b/.test(up)) return true;
  return false;
}

interface AliasEntry {
  alias: string | null;
  table: string;
}

/** Resolve FROM/JOIN aliases to physical table names (deduped). */
function collectAliases(from: any[] | undefined): AliasEntry[] {
  const out: AliasEntry[] = [];
  const seen = new Set<string>();
  const push = (alias: string | null, table: string) => {
    const key = `${alias ?? ''}|${table}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ alias, table });
    }
  };
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const table = node.table ?? node.tableValue ?? node.database;
    if (typeof table === 'string') push(node.as ?? null, table);
    if (node.relation) walk(node.relation);
    if (node.tableList) node.tableList.forEach(walk);
  };
  walk(from);
  return out;
}

function collectColumnsFromColumnList(sql: string): string[] {
  try {
    return (parser.columnList(sql, { database: 'postgresql' }) as string[])
      .map((c) => {
        const p = c.split('::');
        // entries look like select::table::col or select::null::col (aliased)
        const tbl = p[1] && p[1] !== 'null' ? p[1] : p[2];
        const rest = p.slice(2).join('::');
        if (tbl && rest && !rest.startsWith('#') && rest !== '*') {
          const colName = rest.split('.')[0] ?? rest;
          return `${tbl}.${colName.replace(/`/g, '')}`;
        }
        return null;
      })
      .filter((c): c is string => !!c);
  } catch {
    return [];
  }
}

/** Walk the SELECT AST and return "table.column" refs, resolving aliases. */
function collectSelectColumns(ast: any): string[] {
  if (!ast || ast.type !== 'select') return [];
  const refs: string[] = [];
  const aliases = collectAliases(ast.from);
  const distinctTables = new Set(aliases.map((a) => a.table));
  const walkExpr = (expr: any) => {
    if (!expr) return;
    if (expr.type === 'column_ref') {
      const col = expr.column;
      if (typeof col === 'string' && col !== '*') {
        let table = typeof expr.table === 'string' ? expr.table : null;
        if (table) {
          const hit = aliases.find((a) => a.alias === table);
          if (hit) table = hit.table;
        } else if (distinctTables.size === 1) {
          table = distinctTables.values().next().value as string;
        }
        if (table) refs.push(`${table}.${col.replace(/`/g, '')}`);
      }
      return;
    }
    if (Array.isArray(expr)) {
      expr.forEach(walkExpr);
      return;
    }
    for (const key of ['with', 'args', 'expr', 'left', 'right', 'having', 'on', 'value', 'target']) {
      const child = expr[key];
      if (child && typeof child === 'object') walkExpr(child);
    }
  };
  for (const col of ast.columns ?? []) walkExpr(col.expr ?? col);
  if (ast.orderby) for (const o of ast.orderby) walkExpr(o.expr);
  return [...new Set(refs)];
}

/** Minimal display sanitization: collapse whitespace + strip literal comments. */
export function sanitizeForDisplay(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}