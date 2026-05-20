# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This repo has **no `package.json` and no dependencies** — everything runs on stock Node.js (>=18 for `fetch`/URL/https) plus a PHP runtime on the deployed host. There is no lint step.

- **Build the site:** `node build.js` — assembles `src/pages/**` + `src/_partials/**` into `site/`.
- **Run the test harness:** `node test.js` (defaults to `https://staging2.tireplus.ca`) or `node test.js https://www.tireplus.ca` to point at production. The harness makes live HTTP requests; there is no local server and no way to run it offline.
- **Run a single test section:** there is no test selector. To narrow scope, temporarily comment out other `testPage(...)` blocks in `test.js`, or grep results: `node test.js | grep -E "FR:|EN:"`.

## Architecture

### Bilingual static site, custom assembler

`build.js` is a ~110-line static-site generator specific to this project. Every source page is an HTML fragment with YAML-ish front-matter:

```
---
title: Page Title
description: Meta description
lang: fr                       # optional — switches to French partials
scripts: tireconnect-tires     # optional — see SCRIPT_BLOCKS in build.js
---
<page body>
```

For each `src/pages/**/*.html`, the builder picks `partials.en` or `partials.fr` (based on `lang:`), substitutes `{{TITLE}}` / `{{DESCRIPTION}}` into the head partial and `{{SCRIPTS}}` into the footer partial, and writes the concatenated `head + nav + body + footer` to the matching path in `site/`.

Implications when editing:

- **Partials are duplicated per language.** `src/_partials/head.html` and `head-fr.html` (and `nav`/`footer` pairs) must be kept in sync for any nav/footer/meta change.
- **URL structure mirrors `src/pages/`.** A new EN page is `src/pages/<slug>/index.html`; a new FR page is `src/pages/fr/<slug>/index.html`. No routing config exists.
- **Adding a new script bundle** (e.g. another TireConnect widget) requires adding a key to `SCRIPT_BLOCKS` in `build.js` and referencing it via `scripts:` front-matter. The four existing keys are `tireconnect-tires`, `tireconnect-wheels`, and their `-fr` variants.
- **Front-matter is parsed by a hand-rolled regex** (`/^---\n([\s\S]*?)\n---\n([\s\S]*)$/`) with CRLF normalization. It is not YAML — only flat `key: value` pairs work; no nesting, lists, or quoting.

### `site/` is a hybrid directory — built **and** hand-maintained

The same `site/` tree that receives build output also contains files that are **never generated** and must be edited directly:

- `site/css/style.css`, `site/js/main.js`
- `site/contact-handler.php` (PHP form handler — reCAPTCHA v3, honeypot `company_url`, math captcha where `12 + 6` must equal `18`, bilingual via hidden `lang` field)
- `site/assets/js/tireconnect-*.js`, `site/img/**`, `site/robots.txt`, `site/sitemap.xml`

**Do not edit `site/<page>/index.html` directly** — those are overwritten on the next `node build.js`. Edit the corresponding `src/pages/<page>/index.html` instead. Conversely, the asset files above have no source in `src/`; editing `site/` *is* editing the source.

### Deployment via GitHub Actions + FTP

`.github/workflows/deploy-staging.yml`:

- Push to `main` → builds and FTP-syncs `site/` to **staging**.
- `workflow_dispatch` with `target: production` → deploys to **production**.
- Uses `SamKirkland/FTP-Deploy-Action@v4.3.5` with **`dangerous-clean-slate: true`** — anything on the remote that isn't in `site/` after the build is deleted. Be intentional about what `site/` contains before merging to `main`.
- FTP credentials live in repo secrets `FTP_USER`, `FTP_PASS`, `FTP_REMOTE`.

### Test harness invariants worth knowing

`test.js` encodes a lot of product invariants. When changing nav labels, page copy, brands, services, assets, or the contact form, expect to update both the page **and** the matching assertion in `test.js`. Notable invariants currently asserted:

- Menu uses `>Tires<` / `>Wheels<` (EN) and `>Pneus<` / `>Roues<` (FR) — renames will break the harness.
- FR pages must have `lang="fr-CA"` and **must not** contain `>Home<` (an English-nav leak check).
- The contact form must keep `name="company_url"` (honeypot), `name="math"`, and `name="plate"` fields.
- `mail-test.php` must **not** be reachable on the deployed host (diagnostic-removal check).
- `/css/style.css` must contain `font-size: 125%` on root and a `.grecaptcha-badge { visibility: hidden }` rule.
