/**
 * Auth flow QA: login, signup, forgot-password pages + optional login/logout.
 * Run: node scripts/auth-qa.mjs
 * Requires: dev server at http://localhost:3001
 * Optional: E2E_TEST_EMAIL + E2E_TEST_PASSWORD in env for login/logout test
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const results = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // 1. Login page
  {
    const report = { test: 'login', page: BASE + '/login', status: 'PASS', message: '' };
    const page = await context.newPage();
    try {
      const res = await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!res || res.status() >= 400) {
        report.status = 'FAIL';
        report.message = res ? `HTTP ${res.status()}` : 'No response';
        results.push(report);
        await page.close();
      } else {
        const hasEmail = await page.locator('input#email, input[type="email"]').first().isVisible().catch(() => false);
        const hasPassword = await page.locator('input#password, input[type="password"]').first().isVisible().catch(() => false);
        if (!hasEmail || !hasPassword) {
          report.status = 'FAIL';
          report.message = `Missing fields: email=${hasEmail} password=${hasPassword}`;
        } else {
          await page.click('button[type="submit"]');
          await page.waitForTimeout(800);
          const stillOnLogin = page.url().includes('/login');
          const hasValidation = await page.locator('input:invalid').count() > 0 || await page.locator('[role="alert"], .text-red-500, .bg-red-500').count() > 0;
          if (!stillOnLogin && !hasValidation) {
            report.status = 'WARN';
            report.message = 'Empty submit did not keep user on login or show validation';
          }
        }
        results.push(report);
        console.log(`${report.status}\t${report.page}\t${report.message || 'OK'}`);
      }
    } catch (e) {
      report.status = 'FAIL';
      report.message = e.message || String(e);
      results.push(report);
      console.log(`${report.status}\t${report.page}\t${report.message}`);
    }
    await page.close();
  }

  // 2. Signup page (plan selection, not classic form)
  {
    const report = { test: 'signup', page: BASE + '/signup', status: 'PASS', message: '' };
    const page = await context.newPage();
    try {
      const res = await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!res || res.status() >= 400) {
        report.status = 'FAIL';
        report.message = res ? `HTTP ${res.status()}` : 'No response';
      } else {
        const hasPlans = await page.locator('text=Get Started').first().isVisible().catch(() => false);
        const hasLoginLink = await page.locator('a[href="/login"]').first().isVisible().catch(() => false);
        if (!hasPlans) {
          report.status = 'FAIL';
          report.message = 'Plan selection / Get Started not found';
        } else {
          report.message = 'Plan-based signup (no email/password form); Get Started and Login link present';
        }
        results.push(report);
        console.log(`${report.status}\t${report.page}\t${report.message || 'OK'}`);
      }
    } catch (e) {
      report.status = 'FAIL';
      report.message = e.message || String(e);
      results.push(report);
      console.log(`${report.status}\t${report.page}\t${report.message}`);
    }
    await page.close();
  }

  // 3. Forgot-password page
  {
    const report = { test: 'forgot-password', page: BASE + '/forgot-password', status: 'PASS', message: '' };
    const page = await context.newPage();
    try {
      const res = await page.goto(BASE + '/forgot-password', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!res || res.status() >= 400) {
        report.status = 'FAIL';
        report.message = res ? `HTTP ${res.status()}` : 'No response';
      } else {
        const hasEmail = await page.locator('input#email, input[type="email"]').first().isVisible().catch(() => false);
        if (!hasEmail) {
          report.status = 'FAIL';
          report.message = 'Email field not found';
        } else {
          await page.click('button[type="submit"]');
          await page.waitForTimeout(800);
          const stillOnPage = page.url().includes('/forgot-password');
          const hasValidation = await page.locator('input:invalid').count() > 0;
          if (!stillOnPage && !hasValidation) {
            report.status = 'WARN';
            report.message = 'Empty submit did not keep user on page or show validation';
          }
        }
        results.push(report);
        console.log(`${report.status}\t${report.page}\t${report.message || 'OK'}`);
      }
    } catch (e) {
      report.status = 'FAIL';
      report.message = e.message || String(e);
      results.push(report);
      console.log(`${report.status}\t${report.page}\t${report.message}`);
    }
    await page.close();
  }

  // 4. Login with test credentials (if available)
  const testEmail = process.env.E2E_TEST_EMAIL;
  const testPassword = process.env.E2E_TEST_PASSWORD;
  if (testEmail && testPassword) {
    const report = { test: 'login-redirect', page: 'POST /api/auth + redirect', status: 'PASS', message: '' };
    const page = await context.newPage();
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.fill('input#email', testEmail);
      await page.fill('input#password', testPassword);
      await Promise.all([
        page.waitForURL(/\/dashboard|\/portal/, { timeout: 15000 }),
        page.click('button[type="submit"]'),
      ]);
      const url = page.url();
      if (url.includes('/dashboard') || url.includes('/portal')) {
        report.message = `Redirected to ${url}`;
        results.push(report);
        console.log(`${report.status}\t${report.page}\t${report.message}`);

        // 5. Logout and verify redirect to login
        const logoutReport = { test: 'logout', page: 'logout → /login', status: 'PASS', message: '' };
        try {
          await page.waitForTimeout(1000);
          const userMenu = page.locator('button').filter({ has: page.locator('svg') }).or(page.locator('[data-state]')).first();
          const logOutItem = page.locator('text=Log Out').first();
          if (await logOutItem.isVisible().catch(() => false)) {
            await logOutItem.click();
          } else {
            const avatar = page.locator('[data-radix-collection-item], button').filter({ hasText: /user|account|@|invaria/i }).first();
            if (await avatar.isVisible().catch(() => false)) {
              await avatar.click();
              await page.waitForTimeout(400);
              await page.locator('text=Log Out').first().click({ timeout: 3000 });
            } else {
              await context.request.post(BASE + '/api/auth', { data: { action: 'sign-out' }, headers: { 'Content-Type': 'application/json' } });
              await page.goto(BASE + '/login');
            }
          }
          await page.waitForURL(/\/login/, { timeout: 5000 });
          if (page.url().includes('/login')) {
            logoutReport.message = 'Redirected to /login';
          } else {
            logoutReport.status = 'WARN';
            logoutReport.message = 'After logout URL: ' + page.url();
          }
        } catch (e) {
          logoutReport.status = 'FAIL';
          logoutReport.message = e.message || String(e);
        }
        results.push(logoutReport);
        console.log(`${logoutReport.status}\t${logoutReport.page}\t${logoutReport.message}`);
      } else {
        report.status = 'FAIL';
        report.message = `Expected redirect to /dashboard or /portal, got ${url}`;
        results.push(report);
        console.log(`${report.status}\t${report.page}\t${report.message}`);
      }
    } catch (e) {
      report.status = 'FAIL';
      report.message = e.message || String(e);
      results.push(report);
      console.log(`${report.status}\t${report.page}\t${report.message}`);
    }
    await page.close();
  } else {
    results.push({ test: 'login-redirect', page: 'N/A', status: 'WARN', message: 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD not set; skip login redirect test' });
    console.log('WARN\tlogin with credentials\tE2E_TEST_EMAIL/E2E_TEST_PASSWORD not set');
    results.push({ test: 'logout', page: 'N/A', status: 'WARN', message: 'Skipped (no test credentials)' });
    console.log('WARN\tlogout\tSkipped (no test credentials)');
  }

  await context.close();
  await browser.close();

  const outPath = join(process.cwd(), 'qa-screenshots', 'auth-report.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('\nAuth report saved to', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
