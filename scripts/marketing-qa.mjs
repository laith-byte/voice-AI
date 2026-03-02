/**
 * One-off script: visit each marketing URL, take screenshot, report PASS/FAIL/WARN.
 * Run: npx playwright install chromium && node scripts/marketing-qa.mjs
 * Requires: dev server running at http://localhost:3001
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const URLS = [
  { path: '/', name: 'home' },
  { path: '/pricing', name: 'pricing' },
  { path: '/features', name: 'features' },
  { path: '/industries', name: 'industries' },
  { path: '/about', name: 'about' },
  { path: '/contact', name: 'contact' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
];

const OUT_DIR = join(process.cwd(), 'qa-screenshots');
mkdirSync(OUT_DIR, { recursive: true });

const results = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  for (const { path, name } of URLS) {
    const url = BASE + path;
    const report = { url, name, status: 'PASS', message: '', details: [], screenshot: null };
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') consoleErrors.push(msg.text());
    });

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      if (!response) {
        report.status = 'FAIL';
        report.message = 'No response';
      } else if (response.status() >= 400) {
        report.status = 'FAIL';
        report.message = `HTTP ${response.status()}`;
      } else {
        if (consoleErrors.length > 0) {
          report.status = 'WARN';
          report.details.push(`Console errors: ${consoleErrors.slice(0, 3).join('; ')}`);
        }

        // Links/buttons: verify at least one in-page link is clickable, then return to this page
        const navLinks = page.locator('a[href^="/"], a[href^="' + BASE + '"]');
        const linkCount = await navLinks.count();
        if (linkCount > 0) {
          try {
            await navLinks.first().click({ timeout: 3000 });
            await page.waitForTimeout(500);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(300);
          } catch (e) {
            report.details.push('Sample nav link click failed: ' + (e.message || e));
            if (report.status === 'PASS') report.status = 'WARN';
          }
        }
      }

      // Contact page: fill form and submit, verify success
      if (name === 'contact' && report.status !== 'FAIL') {
        try {
          await page.goto(BASE + '/contact', { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(500);
          await page.fill('input[placeholder*="name" i], input[placeholder*="Name" i]', 'QA Test User');
          await page.fill('input[type="email"]', 'qa@test.invalid');
          await page.fill('input[placeholder*="company" i], input[placeholder*="Company" i]', 'QA Test Co');
          await page.selectOption('select', 'other');
          await page.fill('textarea', 'E2E test message.');
          await page.click('button[type="submit"]');
          await page.waitForSelector('text=Thank You', { timeout: 20000 }).catch(() => null);
          const thankYou = await page.locator('text=Thank You').isVisible().catch(() => false);
          if (!thankYou) {
            const errVisible = await page.locator('text=Something went wrong').isVisible().catch(() => false);
            if (errVisible) {
              report.status = 'FAIL';
              report.message = 'Form submit returned error';
              report.details.push('Contact form showed "Something went wrong"');
            } else {
              if (report.status === 'PASS') report.status = 'WARN';
              report.details.push('Form submitted; success state not detected within 20s');
            }
          }
        } catch (e) {
          report.status = 'FAIL';
          report.message = 'Form submit failed';
          report.details.push(e.message || String(e));
        }
      }

      if (report.details.length && !report.message) report.message = report.details.join('. ');
      const screenshotPath = join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      report.screenshot = screenshotPath;
    } catch (err) {
      report.status = 'FAIL';
      report.message = err.message || String(err);
    } finally {
      await page.close();
    }

    results.push(report);
    console.log(`${report.status}\t${url}\t${report.message || 'OK'}`);
  }

  await context.close();
  await browser.close();

  const summaryPath = join(OUT_DIR, 'report.json');
  writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log('\nScreenshots and report saved to', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
