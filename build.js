#!/usr/bin/env node
/**
 * build.js — TirePlus static site assembler (bilingual EN/FR)
 *
 * Reads page source files from  src/pages/
 * Combines them with shared partials from  src/_partials/
 * Writes assembled HTML to  site/
 *
 * Usage:   node build.js
 *
 * Front-matter:
 *   ---
 *   title: Page Title
 *   description: Meta description text
 *   lang: fr                          (optional — uses French partials)
 *   scripts: tireconnect-tires        (optional)
 *   ---
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const OUT_DIR = path.join(__dirname, "site");
const PARTIALS_DIR = path.join(SRC_DIR, "_partials");
const PAGES_DIR = path.join(SRC_DIR, "pages");

// --- Asset cache-busting ---------------------------------------------------
//
// .htaccess.production gives CSS and JS a long Expires, and these five files
// have fixed names that never change between deploys. Without a version in the
// URL a returning visitor keeps whatever copy they already have until it
// expires — new HTML against old CSS and old JS, with nothing anywhere saying
// so. main.js alone carries the language toggle's langMap, the TireConnect
// lazy-init and the GA event handlers, so "ship a fix and a chunk of returning
// visitors don't get it for weeks" is the actual failure, not a theoretical one.
//
// Appending a content hash makes the URL change exactly when the bytes change:
// edit the file and every visitor refetches on their next page load; leave it
// alone and the long cache stands. That is what makes the year-long Expires in
// .htaccess.production safe rather than dangerous.
//
// A query string rather than a hashed FILENAME, because site/css/ and site/js/
// are hand-written sources that live in site/ (see README) — not build output.
// Renaming them would either destroy the file being edited or leave a hashed
// duplicate beside it, and the deploy uploads all of site/, so both would ship.
//
// These files are read from site/, so they must exist before a build. They are
// committed, so they do; a missing one is a broken checkout and says so.
function assetVersion(relPath) {
  const full = path.join(OUT_DIR, relPath);
  let buf;
  try {
    buf = fs.readFileSync(full);
  } catch (e) {
    console.error(`\n  ✗  Cannot hash ${relPath} — ${full} is missing.`);
    console.error("     site/css, site/js and site/assets/js are committed sources, not build output.\n");
    throw e;
  }
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

// Token → version. Any {{...}} below is substituted into the finished page, so
// a reference works from a partial, a page source or a SCRIPT_BLOCK alike.
// Adding a local asset? Add it here, reference it as /path?v={{TOKEN}}, and the
// CI check in .github/workflows/ci.yml will hold the line for the next person.
const ASSET_VERSIONS = {
  "{{CSS_V}}": assetVersion("css/style.css"),
  "{{JS_V}}": assetVersion("js/main.js"),
  "{{TC_CONFIG_V}}": assetVersion("assets/js/tireconnect-config.js"),
  "{{TC_CONFIG_FR_V}}": assetVersion("assets/js/tireconnect-config-fr.js"),
  "{{TC_INIT_V}}": assetVersion("assets/js/tireconnect-init.js"),
};

function applyAssetVersions(html) {
  for (const [token, version] of Object.entries(ASSET_VERSIONS)) {
    html = html.split(token).join(version);
  }
  return html;
}

function readPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), "utf-8");
}

const partials = {
  en: { head: readPartial("head.html"), nav: readPartial("nav.html"), footer: readPartial("footer.html") },
  fr: { head: readPartial("head-fr.html"), nav: readPartial("nav-fr.html"), footer: readPartial("footer-fr.html") },
};

// The Tekmetric shop this site books into: Tire Plus, Orleans — the production
// shop, not the sandbox this launched against. Declared ONCE and substituted
// into pages as {{TEKMETRIC_SHOP_ID}}, because it appeared in two page sources
// before and a swap that updated one and missed the other would leave that
// language silently booking into the wrong shop — a failure with no visible
// symptom on the page that broke.
//
// Source: Tekmetric -> Marketing -> Online Booking -> "Add to your website".
// A wrong value here is invisible from the page: the button opens, the
// scheduler renders, and the customer believes they have an appointment that
// no one received. test.js asserts this exact id, so changing it by accident
// fails the suite instead of reaching customers.
const TEKMETRIC_SHOP_ID = "b5337652-038c-429f-8e6a-dcabed405dee";

const SCRIPT_BLOCKS = {
  "tireconnect-tires": `
  <script src="/assets/js/tireconnect-config.js?v={{TC_CONFIG_V}}"></script>
  <script>window.TC_PAGE = { type: "tires" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js?v={{TC_INIT_V}}"></script>`,
  "tireconnect-wheels": `
  <script src="/assets/js/tireconnect-config.js?v={{TC_CONFIG_V}}"></script>
  <script>window.TC_PAGE = { type: "wheels" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js?v={{TC_INIT_V}}"></script>`,
  "tireconnect-tires-fr": `
  <script src="/assets/js/tireconnect-config-fr.js?v={{TC_CONFIG_FR_V}}"></script>
  <script>window.TC_PAGE = { type: "tires" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js?v={{TC_INIT_V}}"></script>`,
  "tireconnect-wheels-fr": `
  <script src="/assets/js/tireconnect-config-fr.js?v={{TC_CONFIG_FR_V}}"></script>
  <script>window.TC_PAGE = { type: "wheels" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js?v={{TC_INIT_V}}"></script>`,
  // NOTE: Unlike init()/initWheels() (see tireconnect-init.js), TCWidget.initServices()
  // returns a long-lived promise that never settles, so a Promise.then(hideLoading)
  // pattern leaves the banner stuck on "Loading…" forever (confirmed in production).
  // We hide our outer banner immediately after kicking off init; the AutoService widget
  // renders its own internal loading state inside #tireconnect.
  // PARKED — no page references these two blocks. They drove /request-service/
  // and /fr/demande-de-service/, which ran TireConnect's AutoService module and
  // are now retired: those requests landed in TireConnect, not Tekmetric, so the
  // shop had two inboxes for one job and one of them was not the system of record.
  //
  // Kept rather than deleted for one reason: TireConnect AutoService speaks
  // French (locale: "fr_CA" below) and Tekmetric's booking does not. If Tekmetric
  // adds French this stays dead and can go. If they decline and French service
  // requests are worth restoring, this is the working implementation — recreate
  // the two pages with scripts: tireconnect-services / tireconnect-services-fr.
  //
  // The tires/wheels blocks above are NOT affected; /search/ still uses them, and
  // selling tires is what TireConnect is actually for.
  "tireconnect-services": `
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var loadingEl = document.getElementById('tc-loading');
      function hideLoading() { if (loadingEl) loadingEl.classList.add('d-none'); }
      if (typeof TCWidget === 'undefined' || !TCWidget.initServices) { hideLoading(); return; }
      try { TCWidget.initServices({ apikey: "165d92b73544d5ec4caf11c14e194648", container: "tireconnect" }); }
      catch (e) { console.error('TireConnect AutoService init threw:', e); }
      hideLoading();
    });
  </script>`,
  "tireconnect-services-fr": `
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var loadingEl = document.getElementById('tc-loading');
      function hideLoading() { if (loadingEl) loadingEl.classList.add('d-none'); }
      if (typeof TCWidget === 'undefined' || !TCWidget.initServices) { hideLoading(); return; }
      try { TCWidget.initServices({ apikey: "165d92b73544d5ec4caf11c14e194648", container: "tireconnect", locale: "fr_CA" }); }
      catch (e) { console.error('TireConnect AutoService init threw:', e); }
      hideLoading();
    });
  </script>`,
  // Tekmetric Online Booking. Source: Tekmetric -> Marketing -> Online Booking ->
  // "Add to your website", code (1). It loads Tekmetric's modal.js + modal.css,
  // which define the global onShowBooking(shopId) that the page's button calls.
  //
  // ONE deviation from what Tekmetric ships. Theirs opens with
  //   window.onload = function () { ... }
  // a bare assignment that REPLACES any other window.onload handler on the page,
  // and is itself replaced by the next script that does the same. Nothing else
  // here uses window.onload today, so it would work — and would break silently
  // the day something else did, with booking as the casualty. addEventListener
  // has identical timing (both fire on the load event) and cannot clobber.
  //
  // window.tekmetricBooking is Tekmetric's own config global, added to their
  // snippet after this page first shipped. Set synchronously here, before
  // modal.js is ever appended, so it is in place whichever way their script
  // reads the shop — from this object or from the onShowBooking() argument.
  // Both carry the same id: test.js asserts they agree, because a page where
  // they disagree books into whichever one their script happens to prefer.
  //
  // The ?time= cache-buster is Tekmetric's own, kept as shipped: it refetches
  // both files on every page load, which costs a round trip but means their
  // fixes land without a deploy here.
  //
  // Do NOT iframe the booking URL directly instead of this. That was tried
  // (site/test-booking-iframe.html, since removed) and the browser refuses it:
  // the scheduler sends frame-ancestors/X-Frame-Options that forbid embedding,
  // so the page renders "refused to connect". This modal is the supported path.
  "tekmetric-booking": `
  <script>
    window.tekmetricBooking = { shopId: '${TEKMETRIC_SHOP_ID}', orgId: undefined };

    window.addEventListener('load', function () {
      var script = document.createElement('script');
      script.src = 'https://booking.tekmetric.com/iframe/modal.js?time=' + new Date().getTime();
      script.defer = true;
      document.body.appendChild(script);

      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://booking.tekmetric.com/iframe/modal.css?time=' + new Date().getTime();
      document.head.appendChild(link);
    });
  </script>`,
};

function parsePage(filePath) {
  // Normalize CRLF → LF so regex works on Windows
  const raw = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    console.error(`  ⚠  No front-matter in ${filePath}`);
    return { meta: {}, body: raw };
  }
  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  });
  return { meta, body: match[2] };
}

function buildPage(pagePath) {
  const { meta, body } = parsePage(pagePath);
  const lang = meta.lang === "fr" ? "fr" : "en";
  const p = partials[lang];
  let head = p.head.replace("{{TITLE}}", meta.title || "Tire Plus").replace("{{DESCRIPTION}}", meta.description || "");

  // robots: in front-matter emits a meta tag; absent, the slot leaves no trace.
  //
  // A meta tag rather than the X-Robots-Tag header this used to rely on. That
  // header never reached a directly-requested /404.html on SiteGround — proven
  // on staging, where a site-wide `Header set X-Robots-Tag` is configured and
  // the response carried none. Static .html appears to be served without
  // mod_headers running. A meta tag is in the document, so it survives that,
  // survives being served as an ErrorDocument, and survives a move to a host
  // with no .htaccess at all.
  head = head.replace("{{ROBOTS}}\n",
    meta.robots ? `  <meta name="robots" content="${meta.robots}">\n` : "");
  const scriptBlock = SCRIPT_BLOCKS[meta.scripts] || "";
  let footer = p.footer.replace("{{SCRIPTS}}", scriptBlock);
  const pageBody = body.split("{{TEKMETRIC_SHOP_ID}}").join(TEKMETRIC_SHOP_ID);
  return applyAssetVersions(head + "\n" + p.nav + "\n" + pageBody + "\n" + footer);
}

function walkPages(dir, relBase) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath = path.join(dir, entry.name);
    const relPath = path.join(relBase, entry.name);
    if (entry.isDirectory()) {
      count += walkPages(srcPath, relPath);
    } else if (entry.name.endsWith(".html")) {
      const outPath = path.join(OUT_DIR, relPath);
      const outDir = path.dirname(outPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outPath, buildPage(srcPath), "utf-8");
      console.log(`  ✓  ${relPath}`);
      count++;
    }
  }
  return count;
}

console.log("Building TirePlus site (EN + FR)...\n");
console.log(`  Source:  ${PAGES_DIR}`);
console.log(`  Output:  ${OUT_DIR}\n`);
const total = walkPages(PAGES_DIR, "");
console.log(`\nDone — ${total} pages built.\n`);
