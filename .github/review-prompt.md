Review this pull request.

This is a **static bilingual (EN/FR) Bootstrap 5 site** for tireplus.ca.
`src/` is the source, `site/` is the build output and **is committed to
git**, `build.js` compiles one into the other using only Node built-ins.
Read `README.md` — it documents the layout, the deploy, and the recipes
below.

Prioritise in this order. The first three are this repo's structural traps:
they pass every mechanical check and only show up in a browser, in the
wrong language, or in production.

1. **Bilingual parity, in all five places a page lives.** Adding a page is
   a six-step recipe across five files, and a half-finished one looks
   complete:
   - the EN page under `src/pages/`,
   - the FR page under `src/pages/fr/`,
   - **`lang: fr` in the FR page's front-matter** — without it `build.js`
     silently uses the ENGLISH head/nav/footer partials, so the page
     renders in French with English navigation,
   - nav links in **both** `src/_partials/nav.html` and `nav-fr.html`,
   - the EN ↔ FR slug pair in **`langMap` in `site/js/main.js`** — a
     missing entry does not error, it just leaves the language toggle
     pointing at the wrong page.

   CI counts EN and FR pages, so a missing page fails the build. It cannot
   tell whether the right pages pair up, whether `lang: fr` is present, or
   whether `langMap` gained its entry. That is your job.

2. **Environment-specific files.** `site/.htaccess.staging` disables cache
   and sets `X-Robots-Tag: noindex`; `site/.htaccess.production` sets
   browser cache and security headers. The deploy renames the right one
   into place. A change that edits one and not the other, or that assumes
   a plain `site/.htaccess`, ships one environment's rules to the other —
   and the staging variant reaching production would **deindex the live
   site**.

3. **Analytics fires on production only**, via a hostname guard in
   `src/_partials/head.html` and `head-fr.html`. A change to that guard,
   or to only one of the two partials, either sends staging traffic to GA
   or silently stops production data. Both partials, or neither.

4. **The deploy is destructive.** `dangerous-clean-slate: true` wipes the
   web root every deploy, and production is a manual dispatch. Flag any
   change to `.github/workflows/deploy-staging.yml` that alters what is
   uploaded, which secret or environment is used, or the artifact
   contents — `include-hidden-files: true` is load-bearing, since the
   `.htaccess.*` variants are hidden files and the deploy fails without
   them.

5. Correctness and accessibility bugs in the page markup generally.

Report only what you can state as a concrete failure: the input or state,
and the wrong result it produces — which page, which language, which
environment.

Skip what CI already decided. It has already verified that `site/` is in
sync with `src/`, that no `site/.htaccess` is committed, and that EN and
FR page counts match. All three passed before you ran; repeating them
costs money and tells the reader nothing.

Do not comment on `site/` files as if they were hand-written. They are
generated from `src/` — a finding there belongs on the `src/` file or the
partial that produced it.

If the diff is clean, say so in one line. A review that manufactures
findings to look useful is worse than no review, because the next one gets
skimmed.

Leave a comment. Do not approve, do not request changes, and do not push
commits.
