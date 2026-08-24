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

## Contact form reCAPTCHA secret

`site/contact-handler.php` verifies reCAPTCHA v3 tokens server-side. The
SECRET key is **not** in this repo — an earlier version committed it, and a
secret in a git repo is leaked for good, so that key must be treated as
burned. Setup:

1. **Rotate the key**: https://www.google.com/recaptcha/admin → the
   tireplus.ca site → settings → regenerate the secret key. (The SITE key in
   the contact pages is public by design and does not change.)
2. Create `tireplus-config.php` containing:

   ```php
   <?php
   $recaptcha_secret = 'PASTE-NEW-SECRET-HERE';
   ```

3. Upload it via SiteGround Site Tools → File Manager to the directory
   **one level above** the webroot (e.g. next to `public_html/`, not inside
   it). Above the webroot it can never be served, and the FTP deploy's
   `dangerous-clean-slate` wipe only touches the webroot, so it survives
   every deploy. Do this once per environment (staging and production).

If the file is missing the handler skips reCAPTCHA verification and relies
on the math question + honeypot — the form keeps working, just with weaker
spam protection, so a missing config fails soft rather than eating
customer messages.

## Content-Security-Policy

Both `.htaccess` variants send two CSP headers:

- **`Content-Security-Policy` (enforced)** — only directives that cannot
  break rendering: `frame-ancestors 'self'; base-uri 'self';
  object-src 'none'`. Nothing here governs loading a subresource.
- **`Content-Security-Policy-Report-Only`** — the full resource allowlist.
  Violations show up in the browser console; nothing is blocked.

The allowlist is report-only because four third parties (TireConnect,
Tekmetric, Elfsight, Mxpert) inject their own subresources at runtime, and
their full origin set can only be confirmed by watching real traffic.
Enforcing an incomplete list would silently kill the tire-quote widget.

To promote the allowlist to enforced:

1. Browse **staging** with DevTools open — every page, both languages;
   exercise tire search, booking modal, chat, reviews widget and the
   contact form.
2. Add any origin the console reports (look for
   `[Report Only]` violations) to the matching directive in **both**
   `.htaccess.staging` and `.htaccess.production`.
3. When a full pass is clean, merge the report-only directives into the
   enforced header and delete the report-only one.

Note the policy carries `'unsafe-inline'` for scripts and styles — the GA4
snippet, JSON-LD and the widget init blocks are all inline. So the CSP
restricts *where code loads from*, but is not yet XSS-proof against
injected inline scripts. Hashing the inline blocks per-build in `build.js`
is the eventual fix if that matters.

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
| `cta_click` | A `.btn-cta` link or button is clicked | `cta_label`, `cta_destination` |
| `booking_start` | The Tekmetric booking button is clicked (opens the scheduler) | `cta_label` |

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

**Booking modal doesn't open**
The "Book Your Appointment" button calls `onShowBooking('<shop-id>')`, a global
defined by Tekmetric's `modal.js`. That script is injected by the
`tekmetric-booking` block in `build.js` on the window `load` event, so the button
is inert until the page has fully loaded, and stays inert if
`booking.tekmetric.com` is unreachable or the shop id is wrong. Check the console
for a failed request to `booking.tekmetric.com/iframe/modal.js`.

Do NOT "fix" this by iframing the booking URL directly. That was the first
attempt and the browser refuses it outright — the scheduler sends
`X-Frame-Options`/`frame-ancestors` headers that forbid embedding, so the page
renders nothing but "refused to connect". The modal is Tekmetric's supported
path. The embed code comes from Tekmetric -> Marketing -> Online Booking ->
"Add to your website"; if it is ever regenerated, both the loader in `build.js`
and the shop id on the two booking pages must be updated together.

The button is a `<button>`, not an `<a>`, because it opens a modal rather than
navigating. It reports to GA via `data-ga-event="booking_start"` — see the
click handler in `site/js/main.js`, which matches `a, button` and lets any
element name its own event. Remove that attribute and booking clicks go
silent.

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
