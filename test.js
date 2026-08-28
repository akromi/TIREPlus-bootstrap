#!/usr/bin/env node
/**
 * TirePlus Test Harness (Bilingual EN/FR)
 * Usage: node test.js [base_url]
 */
const https = require("https");
const http = require("http");
const { URL } = require("url");
const BASE = process.argv[2] || "https://staging2.tireplus.ca";

// Some checks assert on headers and rewrites that live in .htaccess. A real
// server applies those; a local static serve of site/ never does, so absence is
// expected locally and a genuine defect anywhere else.
//
// This has to be conditional rather than always-warn. BASE defaults to staging,
// so an unconditional warning meant a broken redirect there still printed "All
// tests passed" and exited 0 — a check that cannot fail for the right reason,
// which is worse than no check at all.
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(BASE);
const softFail = () => (IS_LOCAL ? "warn" : false);
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

// Which Tekmetric shop the page books into. Nothing on the page looks wrong when
// this is wrong: the button opens, the scheduler renders, and the customer
// believes they have an appointment that no one received. This is the only place
// that discrepancy is visible, so it is asserted rather than eyeballed.
//
// The id reaches the page twice — window.tekmetricBooking for their config global
// and the onShowBooking() argument for the button — so both are checked, and
// checked against each other. A page where the two disagree books into whichever
// one their script happens to read.
const PRODUCTION_SHOP_ID = "b5337652-038c-429f-8e6a-dcabed405dee";
const SANDBOX_SHOP_ID = "c4cd3a3d-f612-4b8d-84be-df5f941b9e55";
function bookingShopId(h, s) {
  const btn = h.match(/onShowBooking\('([0-9a-fA-F-]{36})'\)/);
  rec(s, "Booking button carries a shop id", !!btn, btn ? btn[1] : "no onShowBooking(uuid) found");
  const cfg = h.match(/tekmetricBooking\s*=\s*\{\s*shopId:\s*'([0-9a-fA-F-]{36})'/);
  rec(s, "Booking config global carries a shop id", !!cfg, cfg ? cfg[1] : "no window.tekmetricBooking found");
  if (!btn || !cfg) return;
  const b = btn[1].toLowerCase(), c = cfg[1].toLowerCase();
  rec(s, "Button and config agree on the shop", b === c, b === c ? b : `button ${b} vs config ${c}`);
  rec(s, "Shop id is the Tire Plus production shop", b === PRODUCTION_SHOP_ID,
      b === SANDBOX_SHOP_ID ? "SANDBOX SHOP — bookings do not reach Tire Plus" : b);
}

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
    // Shop image
    chk("/img/shop.png", "Shop image (Visit Us)"),
    // Brands carousel (3D)
    chk("brands-carousel-3d", "3D carousel"),
    chk("brands-ring", "Carousel ring"),
    chk("/img/brands/michelin.webp", "Brand: Michelin"),
    chk("/img/brands/nokian.png", "Brand: Nokian"),
    chk("/img/brands/nexen.webp", "Brand: Nexen"),
    // Unified menu (Tires & Wheels merged)
    (h,s) => rec(s, "Menu: Tires & Wheels", />Tires &amp; Wheels</.test(h)),
    (h,s) => rec(s, "Menu: Book Appointment", />Book Appointment</.test(h)),
    // Mxpert AI Chat embed
    chk("Mxpert-Chat", "Mxpert AI chat script"),
    chk("Française", "FR toggle text"),
    chk("Visit Us", "Location section"),
    // Elfsight Google Reviews (replaced static rplg-badge)
    chk("elfsightcdn.com/platform.js", "Elfsight platform script"),
    chk("6977f068-a45d-408b-b12e-132c6c00b6c6", "Elfsight app ID"),
    (h,s) => rec(s, "No legacy rplg-badge", !has(h, "rplg-badge")),
    chk("mobile-call-bar", "Sticky mobile call bar"),
    (h,s) => rec(s, "lang=en-CA", has(h, 'lang="en-CA"')),
    // SRI on the pinned jsdelivr assets. Count, not just presence: Bootstrap
    // CSS, icons CSS (preload + noscript) and bundle JS = 4 integrity attrs.
    // A partial regression (one reference edited without its hash) still fails.
    (h,s) => rec(s, "SRI on all 4 pinned CDN refs", (h.match(/integrity="sha384-/g) || []).length >= 4),
  ]);

  // === EN: SEARCH (unified tires + wheels) ===
  console.log("\n━━━ EN: Tires & Wheels Search ━━━");
  await testPage("/search/", "Tires &amp; Wheels", [
    chk("Tires &amp; Wheels", "Heading"),
    chk("tireconnect-config.js", "EN config"),
    chk("widget.js", "Widget JS"),
    chk("Current promotions", "Promo tip"),
    chk("installation, balancing", "Price tip"),
    chk("Yellow triangle", "Inventory tip"),
    chk("Centerbore filter", "Wheels-tab Centerbore tip"),
    chk("OE Direct Fit", "OE Direct Fit"),
  ]);

  // === EN: BOOK AN APPOINTMENT (Tekmetric online booking) ===
  console.log("\n━━━ EN: Book an Appointment ━━━");
  await testPage("/book-appointment/", "Book an Appointment", [
    chk("Book an Appointment", "Heading"),
    chk("booking.tekmetric.com/iframe/modal.js", "Tekmetric modal loader"),
    chk("booking.tekmetric.com/iframe/modal.css", "Tekmetric modal stylesheet"),
    bookingShopId,
    chk("613-834-7325", "Phone fallback"),
    chk('data-ga-event="booking_start"', "GA booking_start hook"),
    // The iframe embed was refused by the scheduler (X-Frame-Options); the modal
    // replaced it. Assert the dead URL never comes back.
    (h, s) => rec(s, "No legacy myworkshop.site iframe", !has(h, "myworkshop.site")),
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
    // Shop image on FR home (parallel to EN)
    chk("/img/shop.png", "Shop image FR (Visitez-nous)"),
    chk("Mxpert-Chat", "Mxpert AI chat script (FR)"),
    (h,s) => rec(s, "Menu FR: Pneus et Roues", />Pneus et Roues</.test(h)),
    chk("English", "EN toggle text"),
    chk("Visitez-nous", "Location FR"),
    chk("Tous droits", "Footer FR"),
    (h,s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
    (h,s) => rec(s, "No English nav", !has(h, ">Home</")),
  ]);

  // === FR INNER ===
  console.log("\n━━━ FR: Pneus et Roues ━━━");
  await testPage("/fr/recherche/", "Pneus et Roues", [
    chk("tireconnect-config-fr.js", "FR config"),
    chk("Promotions et rabais", "FR promo tip"),
    chk("installation, l'équilibrage", "FR price tip"),
    chk("Triangle jaune", "FR inventory tip"),
    chk("Centre d'usinage", "Centerbore FR tip"),
    chk("première valeur", "First valeur FR"),
    chk("ajustement direct OE", "OE Direct Fit FR"),
    (h,s) => rec(s, "lang=fr-CA", has(h, 'lang="fr-CA"')),
  ]);

  console.log("\n━━━ FR: Prendre rendez-vous ━━━");
  await testPage("/fr/prendre-rendez-vous/", "Prendre rendez-vous", [
    chk("Prendre rendez-vous", "Heading FR"),
    chk("booking.tekmetric.com/iframe/modal.js", "Tekmetric modal loader"),
    bookingShopId,
    chk("613-834-7325", "Phone fallback FR"),
    chk('data-ga-event="booking_start"', "GA booking_start hook"),
    (h, s) => rec(s, "No legacy myworkshop.site iframe", !has(h, "myworkshop.site")),
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
    ["/img/logo.png","Logo"], ["/img/hero-service.webp","Hero (WebP)"],
    ["/img/shop.png","Shop photo"],
    ["/img/credit-cards.png","Credit cards"], ["/img/favicon.ico","Favicon"],
    ["/img/brands/michelin.webp","Brand: Michelin"],
    ["/img/brands/nexen.webp","Brand: Nexen"],
    ["/img/brands/nokian.png","Brand: Nokian"],
    ["/img/brands/general.webp","Brand: General Tire"],
  ];
  for (const [p, l] of assets) {
    try { const r = await fetch(`${BASE}${p}`); rec("assets", l, r.status === 200, `${r.status} ${p}`);
    } catch (e) { rec("assets", l, false, e.message); }
  }

  // === CROSS-PAGE CONSISTENCY ===
  console.log("\n━━━ Consistency ━━━");
  const pages = ["/","/search/","/book-appointment/","/contact-us/","/fr/","/fr/recherche/","/fr/prendre-rendez-vous/","/fr/contactez-nous/"];
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
  for (const p of ["/fr/","/fr/recherche/","/fr/prendre-rendez-vous/","/fr/contactez-nous/"]) {
    try {
      const r = await fetch(`${BASE}${p}`);
      if (r.status === 200) {
        rec("bilingual", `${p} lang=fr-CA`, has(r.body, 'lang="fr-CA"'));
        rec("bilingual", `${p} EN toggle`, has(r.body, 'title="English"'));
        rec("bilingual", `${p} no English nav`, !has(r.body, ">Home</"));
      }
    } catch (e) { rec("bilingual", `${p}`, false, e.message); }
  }
  for (const p of ["/","/search/","/book-appointment/","/contact-us/"]) {
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

  // test-booking-iframe.html was a scratch file superseded by /book-appointment/
  try {
    const r = await fetch(`${BASE}/test-booking-iframe.html`);
    rec("security", "test-booking-iframe.html removed (not 200)", r.status !== 200, `Got ${r.status}`);
  } catch (e) { rec("security", "test-booking-iframe.html removed (not 200)", true, "Network error = good"); }

  // CSS rules: font-size boost + reCAPTCHA badge hidden
  try {
    const r = await fetch(`${BASE}/css/style.css`);
    if (r.status === 200) {
      const css = r.body.replace(/\s+/g, " ");
      rec("css", "Root font-size: 125% (25% boost)", /font-size:\s*125%/.test(css));
      rec("css", "reCAPTCHA badge hidden", /\.grecaptcha-badge[^}]*visibility\s*:\s*hidden/i.test(css));
      rec("css", "Tekmetric modal widened past its 400px default",
          /#tekmetricBookingModal\s+\.tekmetric-booking-modal[^}]*width\s*:\s*min\(/i.test(css));
      rec("css", "Tekmetric booking iframe fills the widened modal",
          /#tekmetricBookingModal\s+\.tekmetric-booking-iframe[^}]*width\s*:\s*100%/i.test(css));
    } else {
      rec("css", "Fetch style.css", false, `Got ${r.status}`);
    }
  } catch (e) { rec("css", "Fetch style.css", false, e.message); }

  // === SEO ===
  console.log("\n━━━ SEO ━━━");
  try {
    const r = await fetch(`${BASE}/sitemap.xml`);
    rec("seo", "sitemap.xml loads", r.status === 200, `Got ${r.status}`);
    if (r.status === 200) {
      // /about/ + /fr/a-propos/ shipped missing from the sitemap once; pin them.
      rec("seo", "sitemap lists /about/", has(r.body, "<loc>https://tireplus.ca/about/</loc>"));
      rec("seo", "sitemap lists /fr/a-propos/", has(r.body, "<loc>https://tireplus.ca/fr/a-propos/</loc>"));
    }
  } catch (e) { rec("seo", "sitemap.xml loads", false, e.message); }
  try {
    const r = await fetch(`${BASE}/robots.txt`);
    rec("seo", "robots.txt loads", r.status === 200, `Got ${r.status}`);
    if (r.status === 200) rec("seo", "robots.txt names the sitemap", has(r.body, "Sitemap: https://tireplus.ca/sitemap.xml"));
  } catch (e) { rec("seo", "robots.txt loads", false, e.message); }

  // CSP headers come from .htaccess, which staging/production apply but a bare
  // local static server does not — so absence is a warning, not a failure.
  try {
    const r = await fetch(`${BASE}/`);
    rec("security", "CSP header (enforced)", r.headers["content-security-policy"] ? true : softFail(), r.headers["content-security-policy"] ? "" : `absent${IS_LOCAL ? " — expected without .htaccess" : " — .htaccess is not being applied"}`);
    rec("security", "CSP header (report-only)", r.headers["content-security-policy-report-only"] ? true : softFail(), r.headers["content-security-policy-report-only"] ? "" : `absent${IS_LOCAL ? " — expected without .htaccess" : " — .htaccess is not being applied"}`);
  } catch (e) { rec("security", "CSP headers", false, e.message); }

  // === RETIRED: TIRECONNECT SERVICE REQUESTS ===
  // /request-service/ and /fr/demande-de-service/ ran TireConnect's AutoService
  // module. Retired because those requests landed in TireConnect rather than
  // Tekmetric, leaving the shop with two inboxes for one job.
  //
  // Two things are checked, because either alone would let the retirement rot.
  // A surviving link sends customers to a redirect at best; a missing redirect
  // 404s every inbound link Google and the business listings still carry.
  console.log("\n━━━ Retired: TireConnect service requests ━━━");
  for (const p of ["/","/search/","/book-appointment/","/contact-us/","/faq/","/services/brakes/",
                   "/fr/","/fr/prendre-rendez-vous/","/fr/faq/","/fr/services/freins/"]) {
    try {
      const r = await fetch(`${BASE}${p}`);
      const dead = /href="\/(request-service|fr\/demande-de-service)\//.test(r.body);
      rec("retired", `${p} has no link to the retired request page`, !dead,
          dead ? "still links to the TireConnect service request page" : "");
    } catch (e) { rec("retired", `${p} link scan`, false, e.message); }
  }

  // The redirects live in .htaccess, which a live server applies and a local
  // static server does not — so a 404 here is expected locally, not a failure.
  for (const [from, landing] of [["/request-service/", "Book an Appointment"],
                                 ["/fr/demande-de-service/", "Prendre rendez-vous"]]) {
    try {
      const r = await fetch(`${BASE}${from}`);
      const ok = r.status === 200 && has(r.body, landing);
      rec("retired", `${from} redirects to booking`, ok ? true : softFail(),
          ok ? "" : `got ${r.status}${IS_LOCAL ? " — expected without .htaccess" : " — redirect is broken"}`);
    } catch (e) { rec("retired", `${from} redirect`, softFail(), e.message); }
  }

  // === ASSET CACHE-BUSTING ===
  // .htaccess.production caches CSS and JS for a year, which is only safe while
  // every reference carries a ?v= content hash. An unversioned URL never
  // changes, so a visitor holds a stale file for a year and no deploy can
  // dislodge it.
  //
  // CI blocks an unversioned reference from landing; this is the other half —
  // proof that what is actually SERVED carries the hash, and that the hashed URL
  // resolves rather than 404ing. Both languages, because the EN and FR partials
  // are separate files and only one of them may have been updated.
  console.log("\n━━━ Asset cache-busting ━━━");
  const busted = [
    ["/", "EN home"], ["/fr/", "FR home"],
    ["/search/", "EN search"], ["/fr/recherche/", "FR search"],
  ];
  for (const [p, label] of busted) {
    try {
      const r = await fetch(`${BASE}${p}`);
      const cssRef = r.body.match(/\/css\/style\.css\?v=([a-f0-9]+)/);
      const jsRef = r.body.match(/\/js\/main\.js\?v=([a-f0-9]+)/);
      rec("cache-bust", `${label} CSS is versioned`, !!cssRef,
          cssRef ? "" : "reference has no ?v= — a year-long cache on a URL that never changes");
      rec("cache-bust", `${label} JS is versioned`, !!jsRef,
          jsRef ? "" : "reference has no ?v= — a year-long cache on a URL that never changes");

      // A hash that points at nothing is worse than no hash: the page loses its
      // stylesheet outright rather than serving a stale one.
      if (cssRef) {
        const a = await fetch(`${BASE}/css/style.css?v=${cssRef[1]}`);
        rec("cache-bust", `${label} versioned CSS resolves`, a.status === 200, a.status === 200 ? "" : `got ${a.status}`);
      }
      if (jsRef) {
        const a = await fetch(`${BASE}/js/main.js?v=${jsRef[1]}`);
        rec("cache-bust", `${label} versioned JS resolves`, a.status === 200, a.status === 200 ? "" : `got ${a.status}`);
      }
    } catch (e) { rec("cache-bust", label, false, e.message); }
  }

  // The TireConnect widget config carries the apiKey, locale and locationId.
  // It is injected by a SCRIPT_BLOCK rather than a partial, so it versions
  // through a separate code path and can regress on its own.
  for (const [p, label] of [["/search/", "EN"], ["/fr/recherche/", "FR"]]) {
    try {
      const r = await fetch(`${BASE}${p}`);
      const ok = /\/assets\/js\/tireconnect-config(-fr)?\.js\?v=[a-f0-9]+/.test(r.body)
              && /\/assets\/js\/tireconnect-init\.js\?v=[a-f0-9]+/.test(r.body);
      rec("cache-bust", `${label} TireConnect scripts are versioned`, ok,
          ok ? "" : "widget config or init has no ?v= — a locationId change would not reach returning visitors");
    } catch (e) { rec("cache-bust", `${label} TireConnect scripts`, false, e.message); }
  }

  // === 404 PAGE ===
  // ErrorDocument used to point at /index.html, so a bad URL returned the
  // HOMEPAGE BODY under a 404 status. Status alone therefore proves nothing
  // here and never did — both the old and new config return 404. What changed
  // is the body, so that is what these assert.
  //
  // The .htaccess-dependent checks soft-fail locally: a static serve of site/
  // has no ErrorDocument and answers with its own 404.
  console.log("\n━━━ 404 page ━━━");
  try {
    const r = await fetch(`${BASE}/404.html`);
    rec("404", "/404.html is published", r.status === 200, r.status === 200 ? "" : `got ${r.status}`);
    const bilingual = has(r.body, "Page not found") && has(r.body, "Page introuvable");
    rec("404", "/404.html is bilingual", bilingual, bilingual ? "" : "expected both 'Page not found' and 'Page introuvable'");
    // The META TAG, not the X-Robots-Tag header this used to check. Staging is
    // configured with a site-wide `Header set X-Robots-Tag "noindex, nofollow"`
    // and a direct hit on /404.html carried none of it, so SiteGround appears to
    // serve static .html without mod_headers running. Asserting the header would
    // be a permanent warning that reports nothing about whether the page is
    // actually protected.
    //
    // The tag is in the document. It holds on any host, with or without
    // .htaccess, and whether the page arrives as an error document or a direct
    // 200 — which is the case that needs it, since only the direct hit is
    // indexable in the first place.
    const noindexed = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(r.body);
    rec("404", "/404.html is noindex", noindexed,
        noindexed ? "" : 'expected <meta name="robots" content="noindex"> in the page');
  } catch (e) { rec("404", "/404.html", false, e.message); }

  for (const [p, label] of [["/no-such-page-xyz/", "EN"], ["/fr/aucune-page-xyz/", "FR"]]) {
    try {
      const r = await fetch(`${BASE}${p}`);
      rec("404", `${label} unknown URL returns 404`, r.status === 404, r.status === 404 ? "" : `got ${r.status}`);
      // The homepage hero is the tell: if it is here, ErrorDocument is serving
      // index.html again and the visitor has no idea the URL was wrong.
      const isHome = has(r.body, "hero-phone") && !has(r.body, "Page not found");
      rec("404", `${label} unknown URL serves the 404 page`, !isHome && has(r.body, "Page not found") ? true : softFail(),
          isHome ? "served the HOMEPAGE — ErrorDocument is pointing at /index.html"
                 : (has(r.body, "Page not found") ? "" : `no 404 page in body${IS_LOCAL ? " — expected without .htaccess" : ""}`));
    } catch (e) { rec("404", `${label} unknown URL`, softFail(), e.message); }
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