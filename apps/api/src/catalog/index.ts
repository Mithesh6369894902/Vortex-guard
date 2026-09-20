import type { QueryEngine } from '../db/engine';
import type { ColumnMeta, Sensitivity, TableMeta } from '@vertexguard/shared';

// Static semantic + sensitivity metadata (baked catalog). Live column types
// come from information_schema so both engines behave identically.
const BASE_TABLES: Record<
  string,
  { kind: 'fact' | 'dimension'; description: string; sensitivity: Sensitivity; columns: Record<string, { sensitivity: Sensitivity; piiKind: string | null; description: string }> }
> = {
  products: {
    kind: 'dimension',
    description: 'Catalog of sellable products including price and stock.',
    sensitivity: 'public',
    columns: {
      id: { sensitivity: 'public', piiKind: null, description: 'Product identifier' },
      name: { sensitivity: 'public', piiKind: null, description: 'Product display name' },
      category: { sensitivity: 'public', piiKind: null, description: 'Product category' },
      brand: { sensitivity: 'public', piiKind: null, description: 'Product brand' },
      unit_price: { sensitivity: 'internal', piiKind: null, description: 'Current unit price for the product' },
      stock: { sensitivity: 'internal', piiKind: null, description: 'Units currently available' },
      created_at: { sensitivity: 'public', piiKind: null, description: 'First-listed date' },
    },
  },
  customers: {
    kind: 'dimension',
    description: 'Customer master with personal identifiers and income.',
    sensitivity: 'confidential',
    columns: {
      id: { sensitivity: 'internal', piiKind: null, description: 'Customer identifier' },
      name: { sensitivity: 'pii', piiKind: 'name', description: 'Full name - personal data' },
      email: { sensitivity: 'pii', piiKind: 'email', description: 'Contact email - personal data' },
      phone: { sensitivity: 'pii', piiKind: 'phone', description: 'Mobile number - personal data' },
      city: { sensitivity: 'internal', piiKind: null, description: 'City of residence' },
      state: { sensitivity: 'internal', piiKind: null, description: 'State of residence' },
      pincode: { sensitivity: 'internal', piiKind: null, description: 'Postal code' },
      aadhaar: { sensitivity: 'pii', piiKind: 'national-id', description: 'National identification number - strictly protected' },
      monthly_income: { sensitivity: 'spi', piiKind: 'financial', description: 'Declared monthly income - sensitive personal info' },
      loyalty_tier: { sensitivity: 'internal', piiKind: null, description: 'Loyalty segment (standard/silver/gold/platinum)' },
      is_vip: { sensitivity: 'internal', piiKind: null, description: 'Flag for VIP customers' },
      created_at: { sensitivity: 'internal', piiKind: null, description: 'Account creation date' },
    },
  },
  orders: {
    kind: 'fact',
    description: 'Order headers with status, payment method and totals.',
    sensitivity: 'confidential',
    columns: {
      id: { sensitivity: 'internal', piiKind: null, description: 'Order identifier' },
      customer_id: { sensitivity: 'internal', piiKind: null, description: 'FK to customers' },
      created_at: { sensitivity: 'internal', piiKind: null, description: 'Order placed timestamp' },
      status: { sensitivity: 'internal', piiKind: null, description: 'Order lifecycle status' },
      payment_method: { sensitivity: 'internal', piiKind: null, description: 'Instrument type (upi/card/netbanking/wallet/cod)' },
      discount: { sensitivity: 'internal', piiKind: null, description: 'Discount applied to order' },
      total_amount: { sensitivity: 'internal', piiKind: null, description: 'Gross order value including GST' },
    },
  },
  order_items: {
    kind: 'fact',
    description: 'Line items per order (qty, price, line total).',
    sensitivity: 'internal',
    columns: {
      id: { sensitivity: 'internal', piiKind: null, description: 'Line identifier' },
      order_id: { sensitivity: 'internal', piiKind: null, description: 'FK to orders' },
      product_id: { sensitivity: 'internal', piiKind: null, description: 'FK to products' },
      qty: { sensitivity: 'internal', piiKind: null, description: 'Quantity purchased' },
      unit_price: { sensitivity: 'internal', piiKind: null, description: 'Price charged per unit' },
      line_total: { sensitivity: 'internal', piiKind: null, description: 'Line value before GST' },
    },
  },
  refunds: {
    kind: 'fact',
    description: 'Post-purchase refunds linked to orders.',
    sensitivity: 'internal',
    columns: {
      id: { sensitivity: 'internal', piiKind: null, description: 'Refund identifier' },
      order_id: { sensitivity: 'internal', piiKind: null, description: 'FK to orders' },
      amount: { sensitivity: 'internal', piiKind: null, description: 'Refund amount' },
      reason: { sensitivity: 'internal', piiKind: null, description: 'Refund reason text' },
      created_at: { sensitivity: 'internal', piiKind: null, description: 'Refund date' },
    },
  },
};

export interface Catalog {
  tables: TableMeta[];
}

export async function loadCatalog(db: QueryEngine): Promise<Catalog> {
  const cols = await db.query(
    `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`
  );

  const tables: TableMeta[] = [];
  for (const base of Object.keys(BASE_TABLES)) {
    const b = BASE_TABLES[base];
    tables.push({
      name: base,
      kind: b.kind,
      description: b.description,
      sensitivity: b.sensitivity,
      columns: cols.rows
        .filter((r) => r.table_name === base)
        .map((r): ColumnMeta => {
          const meta = b.columns[r.column_name as string] ?? {
            sensitivity: 'public' as Sensitivity,
            piiKind: null,
            description: '',
          };
          return {
            name: r.column_name as string,
            type: r.data_type as string,
            sensitivity: meta.sensitivity,
            piiKind: meta.piiKind,
            nullable: r.is_nullable === 'YES',
            description: meta.description,
          };
        }),
    });
  }
  return { tables };
}