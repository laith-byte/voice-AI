/**
 * Startup dashboard QA: as admin (and optionally client) visit every page/tab.
 * Run: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node scripts/dashboard-qa.mjs
 * Optional: E2E_CLIENT_EMAIL=... E2E_CLIENT_PASSWORD=... to also run as client (expect redirect to portal).
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3001";
const results = [];

function report(pageUrl, status, message, account) {
  const r = { account, page: pageUrl, status, message };
  results.push(r);
  console.log(`${status}\t[${account}]\t${pageUrl}\t${message || ""}`);
}

async function login(page, email, password) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.fill("input#email", email);
  await page.fill("input#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(dashboard|agents|clients|portal|acme|billing|settings)/, { timeout: 20000 });
  return page.url();
}

async function getFirstAgentId(page) {
  await page.goto(BASE + "/agents", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
  const href = await page.locator('a[href^="/agents/"]').first().getAttribute("href").catch(() => null);
  if (!href) return null;
  const match = href.match(/\/agents\/([^/]+)/);
  return match ? match[1] : null;
}

async function getFirstClientId(page) {
  await page.goto(BASE + "/clients", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
  const href = await page.locator('a[href^="/clients/"]').first().getAttribute("href").catch(() => null);
  if (href) {
    const match = href.match(/\/clients\/([^/]+)/);
    if (match) return match[1];
  }
  const firstRow = page.locator("table tbody tr.cursor-pointer").first();
  if (await firstRow.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL(/\/clients\/[^/]+\//, { timeout: 10000 }),
      firstRow.click(),
    ]);
    const url = page.url();
    const match = url.match(/\/clients\/([^/]+)/);
    return match ? match[1] : null;
  }
  return null;
}

async function checkPage(page, url, account) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
    if (!res) {
      report(url, "FAIL", "No response", account);
      return;
    }
    if (res.status() >= 400) {
      report(url, "FAIL", `HTTP ${res.status()}`, account);
      return;
    }
    const hasError = await page.locator('text=Something went wrong, text=Error loading, text=Failed to load').first().isVisible().catch(() => false);
    if (hasError) {
      report(url, "FAIL", "Page shows error message", account);
      return;
    }
    if (consoleErrors.length > 0) {
      report(url, "WARN", `Console: ${consoleErrors.slice(0, 1).join(" ")}`, account);
      return;
    }
    report(url, "PASS", "", account);
  } catch (e) {
    report(url, "FAIL", e.message || String(e), account);
  }
}

async function runAsAccount(browser, account, email, password) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    const afterLogin = await login(page, email, password);
    if (afterLogin.includes("/login")) {
      report("/login", "FAIL", "Login did not redirect", account);
      await context.close();
      return;
    }
    if (account === "client" && (afterLogin.includes("/portal") || afterLogin.includes("/acme"))) {
      report("/dashboard (startup)", "PASS", "Client redirected to portal as expected", account);
      await context.close();
      return;
    }

    const agentId = await getFirstAgentId(page);
    const clientId = await getFirstClientId(page);

    const urls = [
      "/dashboard",
      "/agents",
      ...(agentId
        ? [
            `/agents/${agentId}/overview`,
            `/agents/${agentId}/agent-config`,
            `/agents/${agentId}/prompt-tree`,
            `/agents/${agentId}/widget`,
            `/agents/${agentId}/campaigns`,
            `/agents/${agentId}/ai-analysis`,
          ]
        : []),
      "/clients",
      ...(clientId
        ? [
            `/clients/${clientId}/overview`,
            `/clients/${clientId}/assigned-agents`,
            `/clients/${clientId}/phone-numbers`,
            `/clients/${clientId}/solutions`,
            `/clients/${clientId}/client-access`,
            `/clients/${clientId}/knowledge-base`,
          ]
        : []),
      "/settings/startup",
      "/settings/whitelabel",
      "/settings/members",
      "/settings/integrations",
      "/settings/phone-sip",
      "/settings/webhook-logs",
      "/settings/usage",
      "/billing/connect",
      "/billing/products",
      "/billing/subscriptions",
      "/billing/transactions",
      "/billing/invoices",
      "/billing/coupons",
      "/workflows",
      "/integrations",
    ];

    for (const path of urls) {
      await checkPage(page, BASE + path, account);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const clientEmail = process.env.E2E_CLIENT_EMAIL;
  const clientPassword = process.env.E2E_CLIENT_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  await runAsAccount(browser, "admin", adminEmail, adminPassword);
  if (clientEmail && clientPassword) {
    await runAsAccount(browser, "client", clientEmail, clientPassword);
  }

  await browser.close();

  const outPath = join(process.cwd(), "qa-screenshots", "dashboard-report.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log("\nReport saved to", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
