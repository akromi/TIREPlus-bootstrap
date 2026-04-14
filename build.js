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
};

function parsePage(filePath) {
  // Strip BOM + normalize line endings (Windows CRLF → LF)
  const raw = fs.readFileSync(filePath, "utf-8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
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
  // Debug: show detected language for FR pages
  if (filePath.includes("/fr/") || filePath.includes("\\fr\\")) {
    console.log(`    → lang="${meta.lang || 'NOT SET'}" for ${path.basename(path.dirname(filePath))}`);
  }
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