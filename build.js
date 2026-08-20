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

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const OUT_DIR = path.join(__dirname, "site");
const PARTIALS_DIR = path.join(SRC_DIR, "_partials");
const PAGES_DIR = path.join(SRC_DIR, "pages");

function readPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), "utf-8");
}

const partials = {
  en: { head: readPartial("head.html"), nav: readPartial("nav.html"), footer: readPartial("footer.html") },
  fr: { head: readPartial("head-fr.html"), nav: readPartial("nav-fr.html"), footer: readPartial("footer-fr.html") },
};

const SCRIPT_BLOCKS = {
  "tireconnect-tires": `
  <script src="/assets/js/tireconnect-config.js"></script>
  <script>window.TC_PAGE = { type: "tires" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js"></script>`,
  "tireconnect-wheels": `
  <script src="/assets/js/tireconnect-config.js"></script>
  <script>window.TC_PAGE = { type: "wheels" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js"></script>`,
  "tireconnect-tires-fr": `
  <script src="/assets/js/tireconnect-config-fr.js"></script>
  <script>window.TC_PAGE = { type: "tires" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js"></script>`,
  "tireconnect-wheels-fr": `
  <script src="/assets/js/tireconnect-config-fr.js"></script>
  <script>window.TC_PAGE = { type: "wheels" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js"></script>`,
  // NOTE: Unlike init()/initWheels() (see tireconnect-init.js), TCWidget.initServices()
  // returns a long-lived promise that never settles, so a Promise.then(hideLoading)
  // pattern leaves the banner stuck on "Loading…" forever (confirmed in production).
  // We hide our outer banner immediately after kicking off init; the AutoService widget
  // renders its own internal loading state inside #tireconnect.
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
  const scriptBlock = SCRIPT_BLOCKS[meta.scripts] || "";
  let footer = p.footer.replace("{{SCRIPTS}}", scriptBlock);
  return head + "\n" + p.nav + "\n" + body + "\n" + footer;
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
