/**
 * Midman.bd — Playwright visual verification.
 *
 * Runs against the production standalone server and captures the full
 * page matrix: landing / auth / user dashboard / deal detail / admin —
 * × light+dark × bn+en × desktop+mobile. Screenshots land in
 * /home/z/my-project/download/midmanbd-shots/ for the visual review.
 *
 * Prereq: scripts/e2e-test.mjs has run (buyer/seller/admin accounts and
 * three deals exist). Login goes through the REAL login form.
 *
 * Usage: bun scripts/visual-test.mjs [baseUrl]
 */

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@libsql/client";

const BASE = process.argv[2] ?? "http://localhost:3111";

/** The e2e accounts have dynamic suffixes — resolve them from the DB. */
async function findAccount(prefix) {
  const db = createClient({ url: process.env.TURSO_DATABASE_URL });
  const res = await db.execute({
    sql: "SELECT email FROM users WHERE email LIKE ? ORDER BY created_at LIMIT 1",
    args: [`${prefix}-%@test.local`],
  });
  return res.rows[0] ? String(res.rows[0].email) : null;
}
const buyerEmail = await findAccount("buyer");
if (!buyerEmail) {
  console.error("No buyer account found — run scripts/e2e-test.mjs first.");
  process.exit(1);
}
console.log(`  buyer account: ${buyerEmail}`);
const OUT = "/home/z/my-project/download/midmanbd-shots";
mkdirSync(OUT, { recursive: true });

let SHOTS = 0;
let ERRORS = 0;
const consoleErrors = [];

async function newPage(browser, { viewport, theme, lang, jar }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });
  if (jar) {
    await context.addCookies(
      jar.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain?.startsWith(".") ? cookie.domain : new URL(BASE).hostname,
        path: cookie.path || "/",
        httpOnly: cookie.httpOnly,
        secure: false,
        sameSite: "Lax",
      }))
    );
  }
  await context.addCookies([
    {
      name: "mb_lang",
      value: lang,
      url: BASE,
    },
  ]);
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
  await page.addInitScript((theme) => {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, theme);
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });
  return { context, page };
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"], #email', email);
  await page.fill('input[name="password"], #password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  SHOTS++;
  console.log(`  📸 ${name}`);
}

async function setTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
}

const jarCookies = [];

const browser = await chromium.launch();
try {
  /* ---------------- capture the buyer session cookie ---------------- */
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "light",
      lang: "bn",
    });
    await login(page, buyerEmail, "escrow-pass-1");
    const cookies = await context.cookies();
    for (const c of cookies) jarCookies.push(c);
    console.log("  ✓ buyer logged in");
    await context.close();
  }
  const adminJar = [];
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "light",
      lang: "en",
    });
    // The e2e admin account email is dynamic — read it from the DB via a
    // fresh registration + promotion is complex here; instead log in as
    // the buyer-promoted admin: we register a NEW admin through the API.
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Visual Admin",
        email: "visual-admin@test.local",
        password: "visual-admin-1",
      }),
    });
    if (res.status === 201 || res.status === 409) {
      const { execSync } = await import("node:child_process");
      execSync("bun scripts/set-user-role.ts visual-admin@test.local admin", {
        cwd: process.cwd(),
        stdio: "pipe",
        env: process.env,
      });
    }
    await login(page, "visual-admin@test.local", "visual-admin-1");
    for (const c of await context.cookies()) adminJar.push(c);
    console.log("  ✓ admin logged in");
    await context.close();
  }

  /* ---------------- 1. Landing (anonymous) ---------------- */
  console.log("\n== Landing ==");
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "light",
      lang: "bn",
    });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await shot(page, "landing-desktop-1440-light-bn");
    await setTheme(page, "dark");
    await shot(page, "landing-desktop-1440-dark-bn");
    // English hero
    const { lang } = await page.evaluate(() => ({ lang: document.documentElement.lang }));
    await page.evaluate(() => {
      document.cookie = "mb_lang=en; path=/; max-age=31536000";
    });
    await page.reload({ waitUntil: "networkidle" });
    await shot(page, "landing-desktop-1440-dark-en");
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 390, height: 844 },
      theme: "light",
      lang: "bn",
    });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await shot(page, "landing-mobile-390-light-bn");
    await context.close();
  }

  /* ---------------- 2. Auth pages ---------------- */
  console.log("\n== Auth ==");
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "light",
      lang: "en",
    });
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await shot(page, "login-desktop-1440-light-en", false);
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await shot(page, "register-desktop-1440-light-en", false);
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 390, height: 844 },
      theme: "dark",
      lang: "bn",
    });
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await shot(page, "login-mobile-390-dark-bn", false);
    await context.close();
  }

  /* ---------------- 3. Buyer dashboard + deals ---------------- */
  console.log("\n== Buyer app ==");
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "light",
      lang: "bn",
      jar: jarCookies,
    });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await shot(page, "dashboard-desktop-1440-light-bn");
    await setTheme(page, "dark");
    await shot(page, "dashboard-desktop-1440-dark-bn");

    await page.goto(`${BASE}/deals`, { waitUntil: "networkidle" });
    await shot(page, "deals-desktop-1440-light-bn");

    // Deal detail: click the first deal row.
    await page.click("ul.divide-y li a >> nth=0");
    await page.waitForLoadState("networkidle");
    await shot(page, "deal-detail-desktop-1440-light-bn");

    await page.goto(`${BASE}/activity`, { waitUntil: "networkidle" });
    await shot(page, "activity-desktop-1440-light-bn");

    await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
    await shot(page, "notifications-desktop-1440-light-bn");

    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
    await shot(page, "settings-desktop-1440-light-bn");
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 390, height: 844 },
      theme: "light",
      lang: "bn",
      jar: jarCookies,
    });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await shot(page, "dashboard-mobile-390-light-bn");
    await page.goto(`${BASE}/deals/new`, { waitUntil: "networkidle" });
    await shot(page, "deal-new-mobile-390-light-bn");
    await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
    await shot(page, "notifications-mobile-390-dark-bn", false);
    await setTheme(page, "dark");
    await shot(page, "notifications-mobile-390-dark-bn-2", false);
    await context.close();
  }

  /* ---------------- 4. Admin ---------------- */
  console.log("\n== Admin ==");
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "light",
      lang: "en",
      jar: adminJar,
    });
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await shot(page, "admin-dashboard-desktop-1440-light-en");
    await page.goto(`${BASE}/admin/payments`, { waitUntil: "networkidle" });
    await shot(page, "admin-payments-desktop-1440-light-en");
    await page.goto(`${BASE}/admin/deals`, { waitUntil: "networkidle" });
    await shot(page, "admin-deals-desktop-1440-light-en");
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await shot(page, "admin-users-desktop-1440-light-en");
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 1440, height: 900 },
      theme: "dark",
      lang: "bn",
      jar: adminJar,
    });
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await shot(page, "admin-dashboard-desktop-1440-dark-bn");
    await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
    await shot(page, "admin-settings-desktop-1440-dark-bn");

    // Mobile admin: off-canvas navigation.
    const { page: mobilePage, context: mobileContext } = await newPage(browser, {
      viewport: { width: 390, height: 844 },
      theme: "light",
      lang: "bn",
      jar: adminJar,
    });
    await mobilePage.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await shot(mobilePage, "admin-mobile-390-light-bn", false);
    await mobilePage.click('[aria-label*="sidebar" i], button:has(svg.lucide-panel-left)');
    await mobilePage.waitForTimeout(600);
    await shot(mobilePage, "admin-mobile-390-nav-light-bn", false);
    await mobileContext.close();

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nCaptured ${SHOTS} screenshots → ${OUT}`);
if (consoleErrors.length > 0) {
  console.log(`\n⚠ Console errors (${consoleErrors.length}):`);
  for (const err of consoleErrors.slice(0, 10)) console.log(`  • ${err}`);
  process.exit(1);
}
console.log("ZERO console errors across the whole matrix");
