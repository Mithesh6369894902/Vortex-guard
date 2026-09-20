/**
 * VertexGuard Conversational AI Layer
 *
 * Classifies questions into three categories:
 *   1. DATA  -> route to SQL compiler
 *   2. APP   -> answer from VertexGuard knowledge base
 *   3. GENERAL -> generate a helpful conversational response
 */

interface KBEntry {
  patterns: RegExp[];
  answer: string;
  followUps: string[];
}

const APP_KB: KBEntry[] = [
  {
    patterns: [/what\s+(is|does)\s+vertexguard/i, /about\s+vertexguard/i, /tell\s+me\s+about/i, /what\s+is\s+this/i],
    answer: 'VertexGuard is a real-time data verification and governance platform for LLM-powered analytics. It catches silent failures where the AI gives confident but wrong answers.\n\nHow it works:\n1. You ask a natural language question\n2. The AI Agent converts it to SQL and generates metric claims\n3. The Guardian Pipeline independently verifies every claim against warehouse ground truth\n4. Governance policies mask sensitive PII data before output\n5. A trust score (0-100) and verdict is assigned\n6. Everything is logged to a tamper-evident audit trail\n\nPipeline: Planning -> SQL Guardian -> Governance -> Execution -> Semantic Verification -> Statistical Audit -> Trust Scoring -> Audit Anchor.',
    followUps: ['How does trust scoring work?', 'What is the semantic verifier?', 'Show me the governance policies'],
  },
  {
    patterns: [/trust\s+score/i, /how\s+(does|do)\s+trust/i, /what\s+is\s+a\s+trust/i],
    answer: 'Trust scoring is VertexGuard confidence rating, scored 0-100.\n\nCalculation:\n- Start at 100\n- CRITICAL failure: -30 points\n- WARNING failure: -10 points\n- Mismatch claim: capped at 40\n- Unverifiable claim: capped at 30\n- All verified: boosted to 96+\n\nVerdict:\n- VERIFIED (>=92): Safe to use\n- WARNING: Review before acting\n- REJECTED: Do NOT use',
    followUps: ['What is the semantic verifier?', 'How does the Guardian pipeline work?'],
  },
  {
    patterns: [/semantic\s+verif/i, /how\s+(are|do)\s+claims/i, /claim\s+verif/i],
    answer: 'The Semantic Verifier independently recomputes every metric claim using its own SQL.\n\n1. AI says: Total revenue = 33.4 Cr\n2. Verifier writes INDEPENDENT verification SQL\n3. Both compared with 1% tolerance\n4. Match -> VERIFIED\n5. No match -> MISMATCH\n6. Cannot recompute -> UNVERIFIABLE\n\nCatches: unit errors, cancelled-order leaks, double-counted refunds, wrong time windows, aggregation swaps, hallucinations.',
    followUps: ['What syndromes does it catch?', 'How does governance masking work?'],
  },
  {
    patterns: [/silent\s+failure/i, /syndrome/i, /data\s+governance\s+trap/i],
    answer: 'The Silent Failure trap: LLM gives wrong answer with high confidence that LOOKS correct.\n\nSyndromes:\n- G: Trustworthy (control)\n- A: Unit/Scale error (10x off)\n- B: Cancelled-order leak\n- C: Refund double-count\n- D: Wrong time window\n- E: Aggregation swap (AVG vs SUM)\n- F: Hallucinated number',
    followUps: ['How does trust scoring work?', 'What is the semantic verifier?'],
  },
  {
    patterns: [/governance/i, /pii/i, /mask(ing|ed)?/i, /sensitive\s+data/i],
    answer: 'Governance is role-based data protection. Policies define who can see what.\n\nActions: allow, deny, mask\nSensitivity: public, internal, confidential, PII, SPI, restricted\n\nExample: Analyst -> email masked, phone masked. Executive -> full access.',
    followUps: ['What columns are sensitive?', 'Show me the governance dashboard'],
  },
  {
    patterns: [/pipeline/i, /guardian\s+pipeline/i, /stages?/i],
    answer: '8 stages:\n1. Planning - AI generates SQL + claims\n2. SQL Guardian - Static analysis\n3. Governance - PII masking\n4. Execution - Run against warehouse\n5. Semantic Verification - Independent recomputation\n6. Statistical Audit - Outlier detection\n7. Trust Scoring - 0-100 score\n8. Audit Anchor - Tamper-evident log',
    followUps: ['How does trust scoring work?', 'What is the semantic verifier?'],
  },
  {
    patterns: [/database|warehouse|postgres|pglite/i],
    answer: 'PostgreSQL warehouse. Dev: PGlite (embedded WASM). Prod: set DATABASE_URL.\n\nSchema: products (240), customers (45K), orders (616K), order_items (1M+), refunds (14K). Total: 33.4B GMV.',
    followUps: ['What tables are available?', 'How many customers?'],
  },
  {
    patterns: [/schema|tables?|database\s+structure/i],
    answer: '5 tables:\n- products: id, name, category, brand, price, stock\n- customers: id, name, email, phone, city, loyalty_tier\n- orders: id, customer_id, status, payment_method, total_amount\n- order_items: id, order_id, product_id, qty, line_total\n- refunds: id, order_id, amount, reason',
    followUps: ['Show me top categories', 'How many orders?'],
  },
  {
    patterns: [/who\s+(made|built|created)/i, /developer|team/i],
    answer: 'Built as proof-of-concept for LLM analytics verification.\n\nStack: Node.js + TypeScript + Express + React + Tailwind + PostgreSQL + WebSocket. Supports Gemini and OpenAI.',
    followUps: ['What technologies?', 'Show me the API endpoints'],
  },
  {
    patterns: [/api|endpoint|rest/i],
    answer: 'Endpoints:\n- POST /api/analyze\n- GET /api/audit\n- GET /api/policy\n- POST /api/policy\n- GET /api/catalog\n- GET /api/health\n- WS /ws (real-time streaming)',
    followUps: ['How does analyze work?', 'What is the WebSocket protocol?'],
  },
];

export type QuestionType = 'data' | 'app' | 'general';

interface GeneralResponse { answer: string; followUps: string[]; }

const GENERAL_RESPONSES: Record<string, GeneralResponse> = {
  greeting: {
    answer: 'Hello! I am VertexGuard AI - your intelligent data analytics assistant.\n\nI can help with:\n- Data Analytics: Ask about sales, customers, products, refunds\n- Application Questions: Ask about trust scoring, governance, pipeline\n- General Knowledge: SQL, data science, technology concepts\n\nTry: "What is the total revenue?" or "How does trust scoring work?"',
    followUps: ['What is the total revenue?', 'How does trust scoring work?', 'Show me top categories'],
  },
  help: {
    answer: 'What I can do:\n\nData Analytics: Revenue, AOV, breakdowns by category/brand/city/tier, trends, comparisons\nApplication: Guardian Pipeline, trust scoring, semantic verification, governance\nGeneral: SQL help, data concepts, technology explanations\n\nJust type your question naturally!',
    followUps: ['What is the total revenue?', 'How does the pipeline work?', 'Show me top products'],
  },
  sql: {
    answer: 'SQL Quick Reference:\n\nSELECT column FROM table WHERE conditions GROUP BY column ORDER BY column DESC LIMIT 10;\n\nAggregations: SUM, AVG, COUNT, MIN, MAX\nFilters: WHERE, HAVING, BETWEEN, LIKE, IN\nJoins: JOIN, LEFT JOIN, INNER JOIN\n\nThis warehouse: products, customers, orders, order_items, refunds',
    followUps: ['What is the total revenue?', 'Show me top categories by sales'],
  },
  ai: {
    answer: 'Machine Learning overview:\n\n- Supervised: learns from labeled data (classification, regression)\n- Unsupervised: finds patterns (clustering)\n- Reinforcement: learns through rewards\n\nLLMs (GPT, Gemini, Claude) are neural networks trained on massive text. They can hallucinate - produce confident wrong answers. That is why VertexGuard exists!',
    followUps: ['How does VertexGuard catch LLM errors?', 'What syndromes does it detect?'],
  },
  tech: {
    answer: 'Tech stack for this app:\n\nFrontend: React, TypeScript, Tailwind CSS, Zustand\nBackend: Node.js, Express, WebSocket\nDatabase: PostgreSQL (PGlite for dev)\nPipeline: 8-stage verification with real-time streaming',
    followUps: ['How is this app built?', 'What database does it use?'],
  },
  math: {
    answer: 'Common formulas:\n\nMean = Sum / Count\nPercentage = (Part / Whole) x 100\nGrowth Rate = ((New - Old) / Old) x 100\nAOV = Total Revenue / Order Count\nRefund Rate = (Refunds / Orders) x 100\n\nI can compute these from your warehouse data!',
    followUps: ['What is the average order value?', 'What is the refund rate?'],
  },
  fallback: {
    answer: 'Interesting question! I am primarily designed for data analytics but can help with general topics.\n\nData: Ask about revenue, orders, customers, products\nApp: Ask about VertexGuard, trust scoring, governance\nGeneral: SQL, data concepts, technology\n\nWhat would you like to know?',
    followUps: ['What is the total revenue?', 'How does the pipeline work?'],
  },
};

const DATA_KEYWORDS = [
  /\b(revenue|sales|gmv|turnover|total\s+(earned|sales|revenue|amount))/i,
  /\b(order(s)?|count|how\s+many)/i,
  /\b(customer(s)?|user(s)?|buyer(s)?)/i,
  /\b(product(s)?|item(s)?|category|categories|brand(s)?)/i,
  /\b(refund(s)?|return(s)?|cancel(led)?)/i,
  /\b(average|avg|aov|mean|median)/i,
  /\b(top|best|highest|lowest|most|least|ranking)/i,
  /\b(breakdown|split|distribution|by\s+)/i,
  /\b(trend|growth|increase|decrease|mom|qoq|compare|vs)/i,
  /\b(city|cities|state|states|region|geographic|mumbai|delhi|bengaluru)/i,
  /\b(tier|loyalty|vip|platinum|gold|silver)/i,
  /\b(payment|upi|card|cod|wallet|netbanking)/i,
  /\b(recent|latest|last|past|previous|this\s+(month|year|quarter|week))/i,
  /\b(expensive|cheapest|price|cost|stock|inventory)/i,
  /\b(in\s+mumbai|in\s+delhi|in\s+bengaluru|in\s+pune|in\s+chennai)/i,
];

const APP_KEYWORDS = [
  /\b(vertexguard|vertex\s*guard)\b/i,
  /\b(trust\s*score|verdict|verified|rejected|warning)/i,
  /\b(guardian|pipeline|stages?|verification|verifier)/i,
  /\b(governance|policy|policies|pii|mask(ing|ed)?|sensitive|redact)/i,
  /\b(silent\s+failure|data\s+governance\s+trap)/i,
  /\b(syndrome|syndromes|hallucination)/i,
  /\b(sql\s+guardian|audit\s+trail|fingerprint)/i,
  /\b(architecture|stack|technolog|postgres|pglite|react|express)/i,
  /\b(api|endpoint|rest|websocket)/i,
  /\b(what\s+is\s+this|about\s+(this|vertexguard)|tell\s+me)/i,
  /\b(how\s+(does|do)\s+(this|it|the|vertexguard))/i,
  /\b(who\s+(made|built|created|developed))/i,
  /\b(schema|tables?|columns?|database\s+structure)/i,
];

export function classifyQuestion(q: string): QuestionType {
  const trimmed = q.trim();
  if (trimmed.length <= 3 || /^(hi|hey|hello|yo|sup|help|bye|thanks|ok|okay|yes|no)$/i.test(trimmed)) {
    return 'general';
  }
  for (const re of APP_KEYWORDS) {
    if (re.test(trimmed)) return 'app';
  }
  for (const re of DATA_KEYWORDS) {
    if (re.test(trimmed)) return 'data';
  }
  if (trimmed.length > 10 && /\?|^(what|how|which|where|when|who|why|show|list|give|tell|find|get|calculate|compute|compare)/i.test(trimmed)) {
    return 'data';
  }
  return 'general';
}

export function findAppAnswer(q: string): { answer: string; followUps: string[] } | null {
  for (const entry of APP_KB) {
    for (const re of entry.patterns) {
      if (re.test(q)) {
        return { answer: entry.answer, followUps: entry.followUps };
      }
    }
  }
  return null;
}

export function generateGeneralResponse(q: string): GeneralResponse {
  const l = q.toLowerCase();
  if (/^(hi|hey|hello|yo|sup|greetings|good\s+(morning|afternoon|evening))/i.test(l)) {
    return GENERAL_RESPONSES.greeting;
  }
  if (/^(help|what\s+can\s+you\s+do|capabilities|features)/i.test(l)) {
    return GENERAL_RESPONSES.help;
  }
  if (/\b(sql|query|select|join|where|group\s+by|order\s+by)\b/i.test(l)) {
    return GENERAL_RESPONSES.sql;
  }
  if (/\b(machine\s+learning|ai|artificial\s+intelligence|llm|neural|nlp)\b/i.test(l)) {
    return GENERAL_RESPONSES.ai;
  }
  if (/\b(react|javascript|typescript|node|express|tailwind|stack|technology)\b/i.test(l)) {
    return GENERAL_RESPONSES.tech;
  }
  if (/\b(math|calculate|compute|formula|percent|average|mean|median)\b/i.test(l)) {
    return GENERAL_RESPONSES.math;
  }
  return GENERAL_RESPONSES.fallback;
}
