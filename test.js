#!/usr/bin/env node
/**
 * TirePlus Automated Test Harness (Bilingual EN/FR)
 * Usage: node test.js [base_url]
 */
const https = require("https");
const http = require("http");
const { URL } = require("url");
const BASE = process.argv[2] || "https://staging2.tireplus.ca";
const R = { pass: 0, fail: 0, warn: 0, tests: [] };

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const o = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: opts.method || "GET", headers: opts.headers || {}, rejectUnauthorized: false, timeout: 15000 };
    if (opts.body) { o.headers["Content-Type"] = "application/x-www-form-urlencoded"; o.headers["Content-Length"] = Buffer.byteLength(opts.body); }
    const req = mod.request(o, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const r = res.headers.location.startsWith("http") ? res.headers.location : `${u.protocol}//${u.host}${res.headers.location}`;
        return fetch(r, opts).then(resolve).catch(reject);
      }
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    req.on("error", reject); req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    if (opts.body) req.write(opts.body); req.end();
  });
}

function rec(s, n, p, d = "") {
  const st = p === true ? "PASS" : p === "warn" ? "WARN" : "FAIL";
  R[st === "PASS" ? "pass" : st === "WARN" ? "warn" : "fail"]++;
  R.tests.push({ section: s, name: n, status: st, detail: d });
  const i = st === "PASS" ? "✅" : st === "WARN" ? "⚠️" : "❌";
  console.log(`  ${i} ${n}${d ? " — " + d : ""}`);
}

function has(h, t) { return h.toLowerCase().includes(t.toLowerCase()); }

async function testPage(path, title, checks) {
  let r; try { r = await fetch(`${BASE}${path}`); } catch (e) { rec(path, `Loads ${path}`, false, e.message); return null; }
  rec(path, "HTTP 200", r.status === 200, `Got ${r.status}`);
  if (r.status !== 200) return r;
  if (title) { const m = r.body.match(/<title>(.*?)<\/title>/i); rec(path, `Title contains "${title}"`, m && has(m[1], title)); }
  for (const c of (checks || [])) c(r.body, path);
  return r;
}

function chk(t, l) { return (h, s) => rec(s, l || `Contains "${t}"`, has(h, t)); }
function chkNot(t, l) { return (h, s) => rec(s, l || `No "${t}"`, !has(h, t), has(h, t) ? "FOUND" : ""); }

async function run() {
  console.log(`\n🔧 TirePlus Test Harness (Bilingual)\n   Target: ${BASE}\n   Time:   ${new Date().toISOString()}\n`);

  // === ENGLISH HOME ===
  console.log("━━━ EN: Home Page ━━━");
  await testPage("/", "Tire Plus", [
    chk("Your Trusted", "Hero heading"), chk("613-834-7325", "Phone"), chk("2006 St. Joseph", "Address"),
    chk("/tire-search/", "Tire search link"), chk("/wheel-search/", "Wheel search link"),
    chk("Wheel Alignment", "Highlights: Alignment"), chk("DriveON Licensed", "Highlights: DriveON"),
    chk("Road Force Balancing", "Highlights: Road Force"), chk("Oil Changes", "Highlights: Oil"),
    chk("Our Services", "Services heading"), chk("General Repairs", "Service: Repairs"),
    chk("Fluid Flush", "Service: Flush"), chk("Visit Us", "Location section"),
    chk("elfsight", "Elfsight widget"), chk('href="/fr/"', "FR toggle link"),
    chk("<footer", "Footer"), chk("skip-link", "Skip link"),
    chkNot("\\bMTO\\b", "No MTO"),
    (h, s) => rec(s, "lang=en-CA", has(h, 'lang="en-CA"')),
  ]);

  // === ENGLISH INNER PAGES ===
  console.log("\n━━━ EN: Tire Search ━━━");
  await testPage("/tire-search/", "Tire Search", [
    chk("Search for Tires", "Heading"), chk("tireconnect-config.js", "EN config"), chk("widget.js", "Widget JS"),
    chk('"tires"', "Page type tires"), chk("tc-loading", "Loading state"), chk("tc-error", "Error fallback"),
  ]);

  console.log("\n━━━ EN: Wheel Search ━━━");
  await testPage("/wheel-search/", "Wheel Search", [
    chk("Search for Wheels", "Heading"), chk("OE Direct Fit", "OE tip"), chk('"wheels"', "Page type wheels"),
  ]);

  console.log("\n━━━ EN: Appointments ━━━");
  await testPage("/appointments/", "Book an Appointment", [
    chk("Book Now", "Book button"), chk("workshopsoftware.com", "WS URL"), chk("o36ivi", "WS token"),
    chk("today or tomorrow", "Same-day warning"),
  ]);

  console.log("\n━━━ EN: Contact ━━━");
  await testPage("/contact-us/", "Contact Us", [
    chk("Send Us a Message", "Form heading"), chk('name="name"', "Name field"), chk('name="plate"', "Plate field"),
    chk('name="company_url"', "Honeypot"), chk("12 + 6", "Math question"), chk("recaptcha", "reCAPTCHA"),
    chk("info@tireplus.ca", "Email"), chk("Get Directions", "Directions"),
  ]);

  // === FRENCH HOME ===
  console.log("\n━━━ FR: Accueil ━━━");
  await testPage("/fr/", "Tire Plus", [
    chk("automobile de confiance", "Hero heading FR"), chk("613-834-7325", "Phone"),
    chk("Recherche de pneus", "FR tire button"), chk("Recherche de roues", "FR wheel button"),
    chk("Nos services", "Services FR"), chk("Réparations générales", "Service: Repairs FR"),
    chk("Visitez-nous", "Location FR"), chk("Accueil", "Nav: Accueil"),
    chk('href="/"', "EN toggle link"), chk("elfsight", "Elfsight widget"),
    (h, s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
    (h, s) => rec(s, "French nav (not English)", !has(h, '>Home</a>')),
    (h, s) => rec(s, "French footer", has(h, "Tous droits")),
  ]);

  // === FRENCH INNER PAGES ===
  console.log("\n━━━ FR: Recherche pneus ━━━");
  await testPage("/fr/recherche-pneus/", "Recherche de pneus", [
    chk("Recherche de pneus", "Heading FR"), chk("tireconnect-config-fr.js", "FR config"),
    (h, s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
  ]);

  console.log("\n━━━ FR: Recherche roues ━━━");
  await testPage("/fr/recherche-roues/", "Recherche de roues", [
    chk("Recherche de roues", "Heading FR"), chk("tireconnect-config-fr.js", "FR config"),
    chk("OE Direct Fit", "OE tip FR"),
  ]);

  console.log("\n━━━ FR: Rendez-vous ━━━");
  await testPage("/fr/rendez-vous/", "rendez-vous", [
    chk("Réserver maintenant", "Book button FR"), chk("workshopsoftware.com", "WS URL"),
    chk("aujourd'hui ou demain", "Same-day warning FR"),
  ]);

  console.log("\n━━━ FR: Contactez-nous ━━━");
  await testPage("/fr/contactez-nous/", "Contactez-nous", [
    chk("Envoyez-nous un message", "Form heading FR"), chk('name="lang" value="fr"', "Lang hidden field"),
    chk('name="company_url"', "Honeypot"), chk("12 + 6", "Math question"), chk("recaptcha", "reCAPTCHA"),
    (h, s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
  ]);

  // === STATIC ASSETS ===
  console.log("\n━━━ Static Assets ━━━");
  const assets = [
    ["/css/style.css","CSS"],["/js/main.js","JS"],["/assets/js/tireconnect-config.js","TC config EN"],
    ["/assets/js/tireconnect-config-fr.js","TC config FR"],["/assets/js/tireconnect-init.js","TC init"],
    ["/img/logo.png","Logo"],["/img/hero-service.png","Hero"],["/img/shop.png","Shop photo"],
    ["/img/driveon-logo.png","DriveON"],["/img/roadforce-logo.png","Road Force"],
    ["/img/alignment-logo.svg","Alignment"],["/img/oilchange-logo.svg","Oil change"],
    ["/img/tire-brands.png","Tire brands"],["/img/credit-cards.png","Credit cards"],["/img/favicon.ico","Favicon"],
  ];
  for (const [p, l] of assets) {
    try { const r = await fetch(`${BASE}${p}`); rec("assets", l, r.status === 200, `${r.status} ${p}`);
    } catch (e) { rec("assets", l, false, e.message); }
  }

  // === SECURITY ===
  console.log("\n━━━ Security ━━━");
  try {
    const r = await fetch(`${BASE}/`);
    rec("security", "X-Content-Type-Options", r.headers["x-content-type-options"] === "nosniff");
    rec("security", "X-Frame-Options", !!r.headers["x-frame-options"]);
  } catch (e) { rec("security", "Headers check", false, e.message); }
  try { const r = await fetch(`${BASE}/mail-test.php`); rec("security", "mail-test.php gone", r.status === 404 || r.status === 403); } catch(e) { rec("security", "mail-test.php gone", true); }
  try { const r = await fetch(`${BASE}/wp-login.php`); rec("security", "No wp-login", r.status === 404 || r.status === 403); } catch(e) { rec("security", "No wp-login", true); }

  // === CROSS-PAGE ===
  console.log("\n━━━ Cross-Page Consistency ━━━");
  const pages = ["/","/tire-search/","/wheel-search/","/appointments/","/contact-us/","/fr/","/fr/recherche-pneus/","/fr/recherche-roues/","/fr/rendez-vous/","/fr/contactez-nous/"];
  for (const p of pages) {
    try {
      const r = await fetch(`${BASE}${p}`);
      if (r.status === 200) {
        rec("consistency", `${p} navbar`, has(r.body, "navbar-tp"));
        rec("consistency", `${p} footer`, has(r.body, "<footer"));
        rec("consistency", `${p} phone`, has(r.body, "613-834-7325"));
        const stripped = r.body.replace(/<!--[\s\S]*?-->/g, "");
        rec("consistency", `${p} no MTO`, !/\bMTO\b/.test(stripped));
      }
    } catch (e) { rec("consistency", `${p}`, false, e.message); }
  }

  // === BILINGUAL INTEGRITY ===
  console.log("\n━━━ Bilingual Integrity ━━━");
  for (const p of ["/fr/","/fr/recherche-pneus/","/fr/recherche-roues/","/fr/rendez-vous/","/fr/contactez-nous/"]) {
    try {
      const r = await fetch(`${BASE}${p}`);
      if (r.status === 200) {
        rec("bilingual", `${p} lang=fr-CA`, has(r.body, 'lang="fr-CA"'));
        rec("bilingual", `${p} French nav`, has(r.body, "Accueil"));
        rec("bilingual", `${p} EN toggle`, has(r.body, 'title="English"'));
        rec("bilingual", `${p} no English nav`, !has(r.body, '>Home</a>'));
      }
    } catch (e) { rec("bilingual", `${p}`, false, e.message); }
  }
  for (const p of ["/","/tire-search/","/wheel-search/","/appointments/","/contact-us/"]) {
    try {
      const r = await fetch(`${BASE}${p}`);
      if (r.status === 200) {
        rec("bilingual", `${p} lang=en-CA`, has(r.body, 'lang="en-CA"'));
        rec("bilingual", `${p} FR toggle`, has(r.body, 'title="Français"'));
      }
    } catch (e) { rec("bilingual", `${p}`, false, e.message); }
  }

  // === SUMMARY ===
  console.log("\n" + "═".repeat(50));
  console.log(`  RESULTS: ${R.pass} passed, ${R.fail} failed, ${R.warn} warnings`);
  console.log(`  TOTAL:   ${R.pass + R.fail + R.warn} tests`);
  console.log("═".repeat(50));
  if (R.fail > 0) { console.log("\n❌ FAILURES:"); R.tests.filter(t => t.status === "FAIL").forEach(t => console.log(`   ${t.section} → ${t.name}${t.detail ? " — " + t.detail : ""}`)); }
  console.log(`\n${R.fail === 0 ? "🎉 All tests passed!" : "🔴 Some tests failed."}\n`);
  process.exit(R.fail > 0 ? 1 : 0);
}

run().catch(e => { console.error("Crashed:", e); process.exit(2); });
