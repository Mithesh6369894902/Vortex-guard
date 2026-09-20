/**
 * Deterministic warehouse seeder.
 * Generates a realistic 2.5-year retail marketplace dataset with
 * genuine PII-like columns (email, phone, national ID, income) so the
 * governance layer has real things to protect.
 */
import dotenv from 'dotenv';
dotenv.config();

import { getEngine, disposeEngine } from '../db/index';
import { SCHEMA_SQL } from '../db/schema';

// --- deterministic RNG ------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260920);
const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
const ri = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const rf = (min: number, scale: number) => Math.round((min + rand() * scale) * 100) / 100;

// --- constants --------------------------------------------------------------
const CITIES: Array<[string, string, string]> = [
  ['Mumbai', 'Maharashtra', '400001'],
  ['Delhi', 'Delhi', '110001'],
  ['Bengaluru', 'Karnataka', '560001'],
  ['Hyderabad', 'Telangana', '500001'],
  ['Chennai', 'Tamil Nadu', '600001'],
  ['Kolkata', 'West Bengal', '700001'],
  ['Pune', 'Maharashtra', '411001'],
  ['Ahmedabad', 'Gujarat', '380001'],
  ['Jaipur', 'Rajasthan', '302001'],
  ['Lucknow', 'Uttar Pradesh', '226001'],
  ['Chandigarh', 'Punjab', '160017'],
  ['Bhopal', 'Madhya Pradesh', '462001'],
];
const FIRST = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Ishaan','Kabir','Ayaan','Reyansh','Krishna','Dhruv','Rohan','Shaurya','Dev','Ananya','Diya','Saanvi','Anika','Aarohi','Myra','Ira','Navya','Riya','Kiara','Aisha','Pari','Meera','Sara','Eva'];
const LAST = ['Sharma','Verma','Patel','Reddy','Nair','Kulkarni','Iyer','Gupta','Singh','Mehta','Agarwal','Joshi','Rao','Das','Bose','Chopra','Bhat','Pillai','Shah','Khan'];
const CATEGORIES = [
  'Consumer Electronics','Mobile & Accessories','Fashion','Home & Kitchen','Beauty & Grooming',
  'Sports & Fitness','Books & Stationery','Grocery & Gourmet','Toys & Baby','Automotive','Personal Computing','Audio & Wearables',
];
const PAY = ['upi','card','netbanking','wallet','cod'];
const STATUS = ['delivered','delivered','delivered','shipped','processing','cancelled','returned'];
const REFUND_REASON = ['defective item','wrong item shipped','quality not as expected','delayed delivery','customer changed mind','damaged in transit'];

function esc(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Anchor: today for "real-time feel", but reuse a fixed date to stay deterministic-ish */
const TODAY = new Date();
function daysAgoISO(days: number): string {
  const d = new Date(TODAY.getTime() - days * 86400000);
  return d.toISOString();
}
function dateDaysAgo(days: number): string {
  return daysAgoISO(days).slice(0, 10);
}

async function main() {
  const db = await getEngine();
  const started = Date.now();
  console.log(`[seed] engine=${db.kind} schema...`);
  await db.exec(SCHEMA_SQL);

  // ---- products ------------------------------------------------------------
  const brandsByCat: Record<string, string[]> = {};
  for (const c of CATEGORIES) brandsByCat[c] = ['NovaTech','Zenith','Pulse','Orbit','Apex','Vertex','Lumen','Kraft','BlueBird','Maxx'];
  const products: [number, string, string, string, number, number][] = [];
  let pid = 100;
  for (let i = 0; i < 240; i++) {
    const cat = pick(CATEGORIES);
    const price = rf(199, 24999);
    products.push([pid, `${pick(brandsByCat[cat])} ${cat.replace('&','and')} item ${i + 1}`, cat, pick(brandsByCat[cat]), price, ri(0, 5000)]);
    pid++;
  }
  {
    const rows: string[] = [];
    for (const p of products) rows.push(`(${p[0]},${esc(p[1])},${esc(p[2])},${esc(p[3])},${p[4]},${p[5]},${esc(dateDaysAgo(ri(30, 900)))})`);
    for (let i = 0; i < rows.length; i += 400) await db.exec(`INSERT INTO products (id,name,category,brand,unit_price,stock,created_at) VALUES ${rows.slice(i, i + 400).join(',')};`);
    console.log(`  products: ${products.length}`);
  }

  // ---- customers -----------------------------------------------------------
  const custRows: string[] = [];
  let cid = 1;
  for (let i = 0; i < 45000; i++) {
    const [city, state, pin] = pick(CITIES);
    const tier = rand() < 0.08 ? 'platinum' : rand() < 0.25 ? 'gold' : rand() < 0.6 ? 'silver' : 'standard';
    const income = tier === 'platinum' ? rf(60000, 300000) : tier === 'gold' ? rf(35000, 90000) : rf(12000, 45000);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const email = `${name.toLowerCase().replace(/[^a-z]/g, '')}${ri(1, 9999)}@${pick(['gmail.com','yahoo.com','outlook.com','mail.com']) }`;
    const phone = `+9198${ri(100000000, 999999999)}`;
    const aadhaar = String(ri(100000000000, 999999999999));
    const vip = tier === 'platinum';
    custRows.push(`(${cid},${esc(name)},${esc(email)},${esc(phone)},${esc(city)},${esc(state)},${esc(pin)},${esc(aadhaar)},${income},${esc(tier)},${vip},${esc(dateDaysAgo(ri(60, 1000)))})`);
    cid++;
  }
  for (let i = 0; i < custRows.length; i += 400) await db.exec(`INSERT INTO customers (id,name,email,phone,city,state,pincode,aadhaar,monthly_income,loyalty_tier,is_vip,created_at) VALUES ${custRows.slice(i, i + 400).join(',')};`);
  console.log(`  customers: ${custRows.length}`);

  // ---- orders + items ------------------------------------------------------
  let oid = 1;
  let orderInserted = 0;
  let itemInserted = 0;
  // simulated purchase propensity per loyalty tier (orders / quarter)
  const tierByCust: Record<number, number> = {};
  for (let i = 1; i <= 45000; i++) {
    const roll = rand();
    tierByCust[i] = roll < 0.08 ? 7 : roll < 0.33 ? 3.2 : roll < 0.93 ? 1.4 : 0.5;
  }

  const orderBatch: string[] = [];
  const itemBatch: string[] = [];
  let orderFlush = () => { throw new Error('uninit'); };

  // We generate order-by-customer windowed over 2.5 years.
  const queue: { cid: number; dueDays: number }[] = [];
  let iid = 1;
  for (let i = 1; i <= 45000; i++) {
    if (rand() < 0.75) queue.push({ cid: i, dueDays: ri(720, 900) });
  }
  const deliverOrder = async (customerId: number, atDays: number) => {
    const itemCount = rand() < 0.5 ? 1 : rand() < 0.8 ? 2 : ri(3, 6);
    const chosen: [number, number, number][] = []; // productId, qty, unitPrice
    let sub = 0;
    for (let k = 0; k < itemCount; k++) {
      const prod = products[Math.floor(rand() * products.length)];
      const qty = ri(1, 4);
      const up = prod[4];
      const line = Math.round(up * qty * 100) / 100;
      sub += line;
      chosen.push([prod[0], qty, up]);
    }
    const discount = rand() < 0.2 ? Math.round(sub * (rand() < 0.5 ? 0.1 : 0.2) * 100) / 100 : 0;
    const total = Math.max(0, Math.round((sub - discount + 18 / 100 * sub) * 100) / 100);
    const status = pick(STATUS);
    const method = pick(PAY);
    orderBatch.push(`(${oid},${customerId},'${daysAgoISO(atDays)}',${esc(status)},${esc(method)},${discount},${total})`);
    for (const [prid, qty, up] of chosen) {
      itemBatch.push(`(${iid++},${oid},${prid},${qty},${up},${up * qty})`);
    }
    oid++;
    if (orderBatch.length >= 1000) {
      await db.exec(`INSERT INTO orders (id,customer_id,created_at,status,payment_method,discount,total_amount) VALUES ${orderBatch.join(',')};`);
      orderInserted += orderBatch.length;
      orderBatch.length = 0;
      const items = itemBatch.splice(0, itemBatch.length);
      await db.exec(`INSERT INTO order_items (id,order_id,product_id,qty,unit_price,line_total) VALUES ${items.join(',')};`);
      itemInserted += items.length;
    }
  };

  while (queue.length) {
    const { cid, dueDays } = queue.pop()!;
    if (dueDays <= 1) continue;
    const pace = tierByCust[cid] ?? 1.4;
    // how many orders in remaining window
    const n = Math.max(1, Math.min(40, Math.round(pace * (dueDays / 90))));
    for (let k = 0; k < n; k++) {
      await deliverOrder(cid, ri(1, Math.max(2, dueDays)));
    }
  }
  if (orderBatch.length) {
    await db.exec(`INSERT INTO orders (id,customer_id,created_at,status,payment_method,discount,total_amount) VALUES ${orderBatch.join(',')};`);
    orderInserted += orderBatch.length; orderBatch.length = 0;
  }
  if (itemBatch.length) {
    await db.exec(`INSERT INTO order_items (id,order_id,product_id,qty,unit_price,line_total) VALUES ${itemBatch.join(',')};`);
    itemInserted += itemBatch.length; itemBatch.length = 0;
  }
  console.log(`  orders: ${orderInserted}`);
  console.log(`  items: ${itemInserted}`);

  // ---- refunds -------------------------------------------------------------
  const refundRows: string[] = [];
  let rid = 1;
  // sample ~4% of delivered/returned orders
  const all = await db.query('SELECT id, total_amount FROM orders WHERE status IN ($1,$2)', ['delivered','returned']);
  const target = Math.floor(all.rows.length * 0.04);
  for (let i = 0; i < target; i++) {
    const o = all.rows[Math.floor(rand() * all.rows.length)];
    const amt = Math.round((o.total_amount as number) * (0.3 + rand() * 0.7) * 100) / 100;
    refundRows.push(`(${rid++},${o.id},${amt},${esc(pick(REFUND_REASON))},${esc(dateDaysAgo(ri(1, 740)))})`);
    if (refundRows.length >= 500) {
      await db.exec(`INSERT INTO refunds (id,order_id,amount,reason,created_at) VALUES ${refundRows.join(',')};`);
      refundRows.length = 0;
    }
  }
  if (refundRows.length) await db.exec(`INSERT INTO refunds (id,order_id,amount,reason,created_at) VALUES ${refundRows.join(',')};`);
  console.log(`  refunds: ${target}`);

  const s = Date.now() - started;
  console.log(`[seed] done in ${(s / 1000).toFixed(1)}s`);
  await disposeEngine();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});