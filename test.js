#!/usr/bin/env node
/**
 * TirePlus Test Harness (Bilingual EN/FR)
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
    const req = mod.request(o, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const r = res.headers.location.startsWith("http") ? res.headers.location : `${u.protocol}//${u.host}${res.headers.location}`;
        return fetch(r, opts).then(resolve).catch(reject);
      }
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    req.on("error", reject); req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
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

async function run() {
  console.log(`\n🔧 TirePlus Test Harness\n   Target: ${BASE}\n   Time:   ${new Date().toISOString()}\n`);

  // === EN HOME ===
  console.log("━━━ EN: Home ━━━");
  await testPage("/", "Tire Plus", [
    chk("Your Trusted", "Hero heading"),
    chk("613-834-7325", "Phone"),
    chk("2006 St. Joseph", "Address"),
    chk("View Current Tire Promotions", "Promo button"),
    chk("tirepromos.com", "Promo link"),
    // Highlights (clickable)
    chk('href="/#services"', "Highlights link to services"),
    chk("Wheel Alignment", "Highlight: Alignment"),
    chk("DriveON Licensed", "Highlight: DriveON"),
    chk("Road Force Balancing", "Highlight: Road Force"),
    chk("Oil Changes", "Highlight: Oil"),
    // DriveON + shop image on home (recent additions)
    chk("/img/driveon-logo.png", "DriveON logo on home"),
    chk("/img/shop.png", "Shop image (Visit Us)"),
    // Brands carousel (3D)
    chk("brands-carousel-3d", "3D carousel"),
    chk("brands-ring", "Carousel ring"),
    chk("/img/brands/michelin.png", "Brand: Michelin"),
    chk("/img/brands/nokian.png", "Brand: Nokian"),
    chk("/img/brands/nexen.png", "Brand: Nexen"),
    // Services (12 cards)
    chk("Our Services", "Services heading"),
    chk("General Repairs &amp; Diagnostics", "Service: General+Diag"),
    chk("Tires, Wheels &amp; TPMS", "Service: Tires+TPMS"),
    chk("Front-End Service &amp; Alignment", "Service: Front-End+Align"),
    chk("Battery, Starter &amp; Alternator", "Service: Battery+Starter"),
    chk("A/C Service", "Service: A/C"),
    chk("Suspension &amp; Shocks", "Service: Suspension"),
    chk("Fluid Flush", "Service: Flush"),
    // Menu (renamed)
    (h,s) => rec(s, "Menu: Tires (renamed)", />Tires</.test(h)),
    (h,s) => rec(s, "Menu: Wheels (renamed)", />Wheels</.test(h)),
    chk("Française", "FR toggle text"),
    chk("Visit Us", "Location section"),
    // Elfsight Google Reviews (replaced static rplg-badge)
    chk("elfsightcdn.com/platform.js", "Elfsight platform script"),
    chk("6977f068-a45d-408b-b12e-132c6c00b6c6", "Elfsight app ID"),
    (h,s) => rec(s, "No legacy rplg-badge", !has(h, "rplg-badge")),
    chk("mobile-call-bar", "Sticky mobile call bar"),
    (h,s) => rec(s, "lang=en-CA", has(h, 'lang="en-CA"')),
  ]);

  // === EN: TIRE SEARCH ===
  console.log("\n━━━ EN: Tire Search ━━━");
  await testPage("/tire-search/", "Tire Search", [
    chk("Search for Tires", "Heading"),
    chk("tireconnect-config.js", "EN config"),
    chk("widget.js", "Widget JS"),
    chk("Current promotions", "Promo tip"),
    chk("Price includes installation", "Price tip"),
    chk("Yellow triangle", "Inventory tip"),
    chk("low inventory", "Inventory text"),
  ]);

  // === EN: WHEEL SEARCH ===
  console.log("\n━━━ EN: Wheel Search ━━━");
  await testPage("/wheel-search/", "Wheel Search", [
    chk("Search for Wheels", "Heading"),
    chk("Centerbore filter", "Centerbore tip"),
    chk("first option", "First option text"),
    chk("OE Direct Fit", "OE Direct Fit"),
    chk("Yellow triangle", "Inventory tip"),
  ]);

  // === EN: APPOINTMENTS / CONTACT ===
  console.log("\n━━━ EN: Appointments ━━━");
  await testPage("/appointments/", "Book an Appointment", [
    chk("Book Now", "Book button"),
    chk("workshopsoftware.com", "WS URL"),
    chk("o36ivi", "WS token"),
  ]);

  console.log("\n━━━ EN: Contact ━━━");
  await testPage("/contact-us/", "Contact Us", [
    chk("Send Us a Message", "Form heading"),
    chk('name="company_url"', "Honeypot"),
    chk("12 + 6", "Math question"),
    chk('name="math"', "Math field name"),
    chk('name="plate"', "License plate field"),
    chk('id="cf-plate"', "License plate input id"),
    chk("recaptcha", "reCAPTCHA"),
  ]);

  // === FR HOME ===
  console.log("\n━━━ FR: Accueil ━━━");
  await testPage("/fr/", "Tire Plus", [
    chk("automobile de confiance", "Hero FR"),
    chk("Voir les promotions", "FR promo button"),
    chk("tirepromos.com/fr", "FR promo link"),
    chk("InspectiON", "InspectiON branding"),
    chk("Programme InspectiON", "Programme InspectiON"),
    chk("Réparations générales et diagnostics", "Service FR: Repairs+Diag"),
    chk("Pneus, roues et TPMS", "Service FR: Tires+TPMS"),
    chk("Batterie, démarreur et alternateur", "Service FR: Battery"),
    chk("Service et recharge A/C", "Service FR: A/C"),
    chk("Suspension et amortisseurs", "Service FR: Suspension"),
    // DriveON + shop image on FR home (parallel to EN)
    chk("/img/driveon-logo.png", "DriveON logo on FR home"),
    chk("/img/shop.png", "Shop image FR (Visitez-nous)"),
    (h,s) => rec(s, "Menu FR: Pneus (renamed)", />Pneus</.test(h)),
    (h,s) => rec(s, "Menu FR: Roues (renamed)", />Roues</.test(h)),
    chk("English", "EN toggle text"),
    chk("Visitez-nous", "Location FR"),
    chk("Tous droits", "Footer FR"),
    (h,s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
    (h,s) => rec(s, "No English nav", !has(h, ">Home</")),
  ]);

  // === FR INNER ===
  console.log("\n━━━ FR: Recherche pneus ━━━");
  await testPage("/fr/recherche-pneus/", "Recherche de pneus", [
    chk("tireconnect-config-fr.js", "FR config"),
    chk("Promotions et rabais", "FR promo tip"),
    chk("installation, équilibrage", "FR price tip"),
    chk("Triangle jaune", "FR inventory tip"),
    (h,s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
  ]);

  console.log("\n━━━ FR: Recherche roues ━━━");
  await testPage("/fr/recherche-roues/", "Recherche de roues", [
    chk("tireconnect-config-fr.js", "FR config"),
    chk("Centre d'usinage", "Centerbore FR tip"),
    chk("première option", "First option FR"),
    chk("ajustement direct OE", "OE Direct Fit FR"),
    chk("Triangle jaune", "FR inventory tip"),
  ]);

  console.log("\n━━━ FR: Rendez-vous ━━━");
  await testPage("/fr/rendez-vous/", "rendez-vous", [
    chk("Réserver maintenant", "FR book button"),
    chk("workshopsoftware.com", "WS URL"),
  ]);

  console.log("\n━━━ FR: Contactez-nous ━━━");
  await testPage("/fr/contactez-nous/", "Contactez-nous", [
    chk("Envoyez-nous un message", "Form heading FR"),
    chk('name="lang" value="fr"', "Lang hidden field"),
    chk('name="company_url"', "Honeypot FR"),
    chk('name="math"', "Math field name FR"),
    chk('name="plate"', "License plate field FR"),
    chk("recaptcha", "reCAPTCHA"),
  ]);

  // === ASSETS ===
  console.log("\n━━━ Static Assets ━━━");
  const assets = [
    ["/css/style.css","CSS"], ["/js/main.js","JS"],
    ["/assets/js/tireconnect-config.js","TC EN"],
    ["/assets/js/tireconnect-config-fr.js","TC FR"],
    ["/assets/js/tireconnect-init.js","TC init"],
    ["/img/logo.png","Logo"], ["/img/hero-service.png","Hero"],
    ["/img/shop.png","Shop photo"], ["/img/driveon-logo.png","DriveON"],
    ["/img/roadforce-logo.png","Road Force"],
    ["/img/credit-cards.png","Credit cards"], ["/img/favicon.ico","Favicon"],
    ["/img/brands/michelin.png","Brand: Michelin"],
    ["/img/brands/nexen.png","Brand: Nexen"],
    ["/img/brands/nokian.png","Brand: Nokian"],
    ["/img/brands/general-tire.png","Brand: General Tire"],
  ];
  for (const [p, l] of assets) {
    try { const r = await fetch(`${BASE}${p}`); rec("assets", l, r.status === 200, `${r.status} ${p}`);
    } catch (e) { rec("assets", l, false, e.message); }
  }

  // === CROSS-PAGE CONSISTENCY ===
  console.log("\n━━━ Consistency ━━━");
  const pages = ["/","/tire-search/","/wheel-search/","/appointments/","/contact-us/","/fr/","/fr/recherche-pneus/","/fr/recherche-roues/","/fr/rendez-vous/","/fr/contactez-nous/"];
  for (const p of pages) {
    try {
      const r = await fetch(`${BASE}${p}`);
      if (r.status === 200) {
        rec("consistency", `${p} navbar`, has(r.body, "navbar-tp"));
        rec("consistency", `${p} footer`, has(r.body, "<footer"));
        rec("consistency", `${p} phone`, has(r.body, "613-834-7325"));
        rec("consistency", `${p} mobile-call-bar`, has(r.body, "mobile-call-bar"));
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
        rec("bilingual", `${p} EN toggle`, has(r.body, 'title="English"'));
        rec("bilingual", `${p} no English nav`, !has(r.body, ">Home</"));
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

  // === CSS & SECURITY ===
  console.log("\n━━━ CSS & Security ━━━");
  // mail-test.php should NOT be reachable (diagnostic file should be removed)
  try {
    const r = await fetch(`${BASE}/mail-test.php`);
    rec("security", "mail-test.php removed (not 200)", r.status !== 200, `Got ${r.status}`);
  } catch (e) { rec("security", "mail-test.php removed (not 200)", true, "Network error = good"); }

  // CSS rules: font-size boost + reCAPTCHA badge hidden
  try {
    const r = await fetch(`${BASE}/css/style.css`);
    if (r.status === 200) {
      const css = r.body.replace(/\s+/g, " ");
      rec("css", "Root font-size: 125% (25% boost)", /font-size:\s*125%/.test(css));
      rec("css", "reCAPTCHA badge hidden", /\.grecaptcha-badge[^}]*visibility\s*:\s*hidden/i.test(css));
    } else {
      rec("css", "Fetch style.css", false, `Got ${r.status}`);
    }
  } catch (e) { rec("css", "Fetch style.css", false, e.message); }

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