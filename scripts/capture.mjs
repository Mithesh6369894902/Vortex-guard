import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let executablePath = chromePaths.find(p => fs.existsSync(p));

async function run() {
  console.log(`Using browser binary: ${executablePath}`);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  
  // 1. Initial Ask View / Hero
  console.log('Capturing 1_ask_hero.png...');
  await page.goto('http://localhost:4200/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outputDir, '1_ask_hero.png'), fullPage: false });

  // 2. Verified Query Execution
  console.log('Capturing 2_verified_query.png...');
  try {
    // Click sample pill for "Average order value this month"
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Average order value this month')) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: path.join(outputDir, '2_verified_query.png'), fullPage: true });
  } catch (err) {
    console.error('Error on verified query:', err);
  }

  // 3. Rejected Query Execution
  console.log('Capturing 3_rejected_anomaly.png...');
  try {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Total gross revenue for the last 90 days') || text.includes('orders in the last 30 days'))) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: path.join(outputDir, '3_rejected_anomaly.png'), fullPage: true });
  } catch (err) {
    console.error('Error on rejected query:', err);
  }

  // 4. Governance View
  console.log('Capturing 4_governance_matrix.png...');
  try {
    const navButtons = await page.$$('button, a');
    for (const btn of navButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.toLowerCase().includes('governance')) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(outputDir, '4_governance_matrix.png'), fullPage: true });
  } catch (err) {
    console.error('Error on governance view:', err);
  }

  // 5. Audit Trail View
  console.log('Capturing 5_audit_trail.png...');
  try {
    const navButtons = await page.$$('button, a');
    for (const btn of navButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.toLowerCase().includes('audit')) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(outputDir, '5_audit_trail.png'), fullPage: true });
  } catch (err) {
    console.error('Error on audit trail:', err);
  }

  await browser.close();
  console.log('All screenshots saved successfully in:', outputDir);
}

run().catch(console.error);
