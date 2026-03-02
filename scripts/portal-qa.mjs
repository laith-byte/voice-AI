/**
 * Client portal QA: log in as client, visit every portal page/tab.
 * Run: E2E_CLIENT_EMAIL=... E2E_CLIENT_PASSWORD=... node scripts/portal-qa.mjs
 * Requires: dev server at http://localhost:3001
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3001";
const results = [];

function report(pageUrl, status, message) {
  const r = { page: pageUrl, status, message };
  results.push(r);
  console.log(`${status}\t${pageUrl}\t${message || ""}`);
}

async function login(page, email, password) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.fill("input#email", email);
  await page.fill("input#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/portal\/|acme|billing|integrations/, { timeout: 20000 });
  return page.url();
}

async function getPortalSlugAndAgentId(page) {
  const url = page.url();
  const slugMatch = url.match(/\/([^/]+)\/portal/);
  const slug = slugMatch ? slugMatch[1] : null;
  if (!slug) return { slug: null, agentId: null };

  // Portal dashboard shows agents; there is no separate /portal/agents list page.
  await page.goto(`${BASE}/${slug}/portal`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2500);
  const href = await page.locator(`a[href*="/portal/agents/"]`).first().getAttribute("href").catch(() => null);
  let agentId = null;
  if (href) {
    const idMatch = href.match(/\/agents\/([^/]+)/);
    if (idMatch) agentId = idMatch[1];
  }
  return { slug, agentId };
}

async function checkPage(page, url) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
    if (!res) {
      report(url, "FAIL", "No response");
      return;
    }
    if (res.status() >= 400) {
      report(url, "FAIL", `HTTP ${res.status()}`);
      return;
    }
    const hasError = await page.locator('text=Something went wrong, text=Error loading, text=Failed to load').first().isVisible().catch(() => false);
    if (hasError) {
      report(url, "FAIL", "Page shows error message");
      return;
    }
    if (consoleErrors.length > 0) {
      report(url, "WARN", `Console: ${consoleErrors.slice(0, 1).join(" ").slice(0, 150)}`);
      return;
    }
    report(url, "PASS", "");
  } catch (e) {
    report(url, "FAIL", (e && e.message) || String(e));
  }
}

async function main() {
  const clientEmail = process.env.E2E_CLIENT_EMAIL;
  const clientPassword = process.env.E2E_CLIENT_PASSWORD;

  if (!clientEmail || !clientPassword) {
    console.error("Set E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    const afterLogin = await login(page, clientEmail, clientPassword);
    if (afterLogin.includes("/login") && !afterLogin.includes("/portal")) {
      report("/login", "FAIL", "Login did not redirect to portal");
      await context.close();
      await browser.close();
      const outPath = join(process.cwd(), "qa-screenshots", "portal-report.json");
      writeFileSync(outPath, JSON.stringify(results, null, 2));
      console.log("\nReport saved to", outPath);
      process.exit(1);
    }

    const { slug, agentId } = await getPortalSlugAndAgentId(page);
    if (!slug) {
      report("/portal", "FAIL", "Could not determine client slug from URL");
    } else {
      const portalBase = `${BASE}/${slug}/portal`;

      await checkPage(page, `${portalBase}`);
      await checkPage(page, `${portalBase}/onboarding`);
      // No separate agent list page; agents are on the portal dashboard.

      if (agentId) {
        const agentTabs = [
          "widget",
          "conversations",
          "analytics",
          "knowledge-base",
          "call-handling",
          "post-call-actions",
          "campaigns",
          "leads",
          "topics",
          "agent-settings",
          "ai-analysis",
          "prompt-tree",
        ];
        for (const tab of agentTabs) {
          await checkPage(page, `${portalBase}/agents/${agentId}/${tab}`);
        }
      }

      await checkPage(page, `${portalBase}/conversation-flows`);
      await checkPage(page, `${portalBase}/integrations`);
      await checkPage(page, `${portalBase}/billing`);
      await checkPage(page, `${portalBase}/knowledge-base`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const outPath = join(process.cwd(), "qa-screenshots", "portal-report.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log("\nReport saved to", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
