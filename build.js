#!/usr/bin/env node
/**
 * build.js — TirePlus static site assembler
 *
 * Reads page source files from  src/pages/
 * Combines them with shared partials from  src/_partials/
 * Writes assembled HTML to  site/
 *
 * Usage:
 *   node build.js
 *
 * Each page file uses a simple front-matter block:
 *   ---
 *   title: Page Title
 *   description: Meta description text
 *   scripts: tireconnect-tires    (optional)
 *   ---
 *   <main id="main-content"> ... </main>
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const OUT_DIR = path.join(__dirname, "site");
const PARTIALS_DIR = path.join(SRC_DIR, "_partials");
const PAGES_DIR = path.join(SRC_DIR, "pages");

// ── Read partials ──────────────────────────────────────────────
function readPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), "utf-8");
}

const headTpl = readPartial("head.html");
const navTpl = readPartial("nav.html");
const footerTpl = readPartial("footer.html");

// ── Script snippets for pages that need them ───────────────────
const SCRIPT_BLOCKS = {
  "tireconnect-tires": `
  <!-- TireConnect Tire Search Widget -->
  <script src="/assets/js/tireconnect-config.js"></script>
  <script>window.TC_PAGE = { type: "tires" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js"></script>`,

  "tireconnect-wheels": `
  <!-- TireConnect Wheel Search Widget -->
  <script src="/assets/js/tireconnect-config.js"></script>
  <script>window.TC_PAGE = { type: "wheels" };</script>
  <script src="https://app.tireconnect.ca/js/widget.js"></script>
  <script src="/assets/js/tireconnect-init.js"></script>`,
};

// ── Parse front-matter ─────────────────────────────────────────
function parsePage(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    console.error(`  ⚠  No front-matter found in ${filePath}, using raw content`);
    return { meta: {}, body: raw };
  }

  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  });

  return { meta, body: match[2] };
}

// ── Assemble one page ──────────────────────────────────────────
function buildPage(pagePath) {
  const { meta, body } = parsePage(pagePath);

  // Head: replace placeholders
  let head = headTpl
    .replace("{{TITLE}}", meta.title || "Tire Plus")
    .replace("{{DESCRIPTION}}", meta.description || "");

  // Footer: inject page-specific scripts (or nothing)
  const scriptKey = meta.scripts || "";
  const scriptBlock = SCRIPT_BLOCKS[scriptKey] || "";
  let footer = footerTpl.replace("{{SCRIPTS}}", scriptBlock);

  return head + "\n" + navTpl + "\n" + body + "\n" + footer;
}

// ── Walk pages directory ───────────────────────────────────────
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

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const html = buildPage(srcPath);
      fs.writeFileSync(outPath, html, "utf-8");
      console.log(`  ✓  ${relPath}`);
      count++;
    }
  }
  return count;
}

// ── Run ────────────────────────────────────────────────────────
console.log("Building TirePlus site...\n");
console.log(`  Source:  ${PAGES_DIR}`);
console.log(`  Output:  ${OUT_DIR}\n`);

const total = walkPages(PAGES_DIR, "");
console.log(`\nDone — ${total} pages built.\n`);
console.log("Static assets (css/, js/, assets/, img/) are already in site/ and don't need building.");
console.log("Run a local server to preview:  npx serve site");
