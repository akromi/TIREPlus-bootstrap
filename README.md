# TirePlus Website (tireplus.ca)

Static Bootstrap 5 rebuild of tireplus.ca. Source lives in `src/`, the compiled
site lives in `site/`. Push to `main` auto-deploys to staging; production is a
manual workflow dispatch.

## Prerequisites

- Node.js 20+ (https://nodejs.org)
- Git
- A clone of this repo

No `npm install` required — `build.js` and `test.js` use only Node built-ins.

## Project layout

```
src/
  pages/        Page HTML (EN at root, FR under src/pages/fr/)
  _partials/    Shared header/nav/footer fragments
site/           Build output — committed to git and uploaded via FTP
  css/          Hand-written CSS
  js/           Site JS (main.js)
  assets/js/    Third-party widget config (TireConnect)
  img/          Images
  .htaccess.staging      Cache-disabled, noindex variant
  .htaccess.production   Cache-friendly variant (browser cache, security headers)
build.js        Compiles src/ → site/
test.js         Smoke tests run against a URL
.github/workflows/deploy-staging.yml   CI deploy to SiteGround
```

The deploy workflow renames the correct `.htaccess.*` to `.htaccess`
per environment, so a plain `site/.htaccess` is never committed.

## Local workflow

From the repo root, in PowerShell:

```powershell
node build.js                                # Rebuild site/ from src/
git add .
git commit -m "Describe what changed"
git push
```

Pushing to `main` triggers the GitHub Action that deploys to
**https://staging2.tireplus.ca**. Pages typically appear in 60-90 seconds.

To preview locally before pushing, open `site/index.html` directly in a
browser, or serve `site/` with any static server (e.g. `npx serve site`).

## Testing

`test.js` hits a live URL and runs ~40 assertions (page loads, asset
availability, bilingual integrity, widget IDs, CSS rules).

```powershell
node test.js                                 # Default: staging2.tireplus.ca
node test.js https://tireplus.ca             # Run against production
node test.js http://localhost:3000           # Run against a local server
```

Failures print the failing assertion. Exit code is non-zero on failure.

## Deployment

### Staging (automatic)
Every push to `main` deploys to **staging2.tireplus.ca**.
- Workflow: `.github/workflows/deploy-staging.yml`
- Action: `SamKirkland/FTP-Deploy-Action@v4.3.5` over FTPS
- The staging `.htaccess` disables SiteGround Dynamic Cache and sets
  `X-Robots-Tag: noindex` so staging never gets indexed.
- `dangerous-clean-slate: true` wipes the staging web root on each deploy,
  so stale assets are never an issue.

### Production (manual)
1. Go to **Actions** tab on GitHub
2. Click **Deploy** workflow in the left sidebar
3. Click **Run workflow** (top right)
4. Set `Deploy target` to `production`, click **Run workflow**

After a production deploy, optionally purge SiteGround Dynamic Cache via
SiteGround Site Tools → Speed → Caching → Flush Cache.

## Required GitHub Secrets

Set under repo **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `FTP_USER` | SiteGround FTP username |
| `FTP_PASS` | SiteGround FTP password |
| `FTP_REMOTE` | Remote web-root path (e.g. `/public_html/`) |

The `staging` and `production` GitHub Environments use the same secret names
but can hold different values (different remote dirs, etc.).

## Common tasks

### Add a new English page
1. Create `src/pages/my-page/index.html` using an existing page as a template
   (e.g. `src/pages/about/index.html` or `src/pages/faq/index.html`).
2. Add a matching French page at `src/pages/fr/my-page/index.html` (or a
   translated slug, e.g. `fr/a-propos/`). **Include `lang: fr` in the
   front-matter** — without it, `build.js` uses the English head/nav/footer
   partials.
3. Add nav links in `src/_partials/nav.html` and `src/_partials/nav-fr.html`.
4. (Optional) Add footer Quick Links in `src/_partials/footer.html` and
   `src/_partials/footer-fr.html`.
5. Add the EN ↔ FR slug pair to the `langMap` object in `site/js/main.js`
   so the language toggle stays on the equivalent page.
6. `node build.js`, commit, push.

### Reorder or rename nav links
Edit `src/_partials/nav.html` (EN) and `src/_partials/nav-fr.html` (FR).
Keep the order in sync between the two and mirror to the footer Quick Links
if those links also appear there.

### Edit the header or footer
Edit `src/_partials/{head,nav,footer}.html` (and the `-fr.html` variants).
Run `node build.js` to propagate changes to every page in `site/`.

### Update a service page
Edit `src/pages/services/<slug>/index.html` (and the FR equivalent).
Service pages are independent — no shared service template.

### Edit `.htaccess` rules
- Staging-only changes: edit `site/.htaccess.staging`
- Production-only changes: edit `site/.htaccess.production`
- Never commit a file literally named `site/.htaccess` — it's gitignored
  and the workflow generates it at deploy time.

## Analytics

Google Analytics 4 is wired into `src/_partials/head.html` and
`src/_partials/head-fr.html`.

- **Measurement ID:** `G-6WE1MYK226`
- **Production-only:** the snippet has a hostname guard, so it loads gtag.js
  *only* when the page is served from `tireplus.ca` or `www.tireplus.ca`.
  Staging and local previews never send data to GA.

### Custom events (in `site/js/main.js`)

| Event | Fires when | Parameters |
|---|---|---|
| `phone_call` | A `tel:` link is clicked | `phone_number` |
| `cta_click` | A `.btn-cta` button is clicked | `cta_label`, `cta_destination` |

Standard GA4 enhanced measurement also captures `page_view`, `scroll`,
outbound `click`, `file_download`, and form events automatically.

### To verify GA is working
1. Deploy to production.
2. Open `https://tireplus.ca` in an incognito window.
3. In GA4 → **Reports → Realtime**, you should appear within ~30 seconds.
4. Click the phone number or a CTA — you should see `phone_call` /
   `cta_click` in the event stream.

### To change the GA4 ID
Replace `G-6WE1MYK226` in both `src/_partials/head.html` and
`src/_partials/head-fr.html`, then `node build.js` and deploy.

### To disable analytics
Remove the `<!-- Google Analytics 4 -->` script block from both
`head.html` and `head-fr.html`.

## Rollback

The fastest rollback is to revert the offending commit and push:

```powershell
git revert <commit-sha>
git push
```

That triggers a fresh staging deploy of the previous state. For production,
follow the manual deploy steps above after the revert is on `main`.

If the FTP upload itself fails mid-deploy, re-run the workflow from the
Actions tab — `dangerous-clean-slate: true` makes the deploy idempotent.

## Troubleshooting

**Staging shows old content after a deploy**
The new staging `.htaccess` should prevent this. Hard-refresh with
Ctrl+Shift+R. If it persists, check DevTools → Network for the response
header `x-proxy-cache`. Should read `MISS`. If it reads `HIT`, the
`.htaccess.staging` didn't deploy correctly — check the workflow logs.

**Deploy fails at "Select staging .htaccess"**
Usually means `site/.htaccess.staging` or `site/.htaccess.production`
didn't make it into the build artifact. Confirm `include-hidden-files: true`
is set on the `actions/upload-artifact` step in the workflow.

**TireConnect widget doesn't load**
Check browser console for blocked third-party requests. The widget is
initialized lazily via IntersectionObserver in `site/js/main.js`; if the
container `<div id="tireconnect">` has been renamed or removed, the
widget will silently no-op.

**`node build.js` errors on Windows about line endings**
The repo uses LF line endings (see `.gitattributes`). If your editor
converted files to CRLF, run `git checkout -- .` to restore them.

**Analytics shows no data after a production deploy**
GA only fires on `tireplus.ca` / `www.tireplus.ca` by design. Confirm:
(1) you're on production, not staging; (2) DevTools → Network shows a
request to `googletagmanager.com/gtag/js?id=G-6WE1MYK226`; (3) you are
not blocked by an ad blocker or privacy extension; (4) the IP you're
testing from isn't filtered as "internal traffic" in GA4 admin.
