# Updating and deployment

**The one thing to know:** this site is *built*. You edit the source in `src/`,
run one command, and commit the result. Pushing to `main` publishes to
**staging** — never straight to the live site. Going live is a separate button
you press once you're happy.

That safety net is the main difference from a plain HTML site. Nothing you push
can break https://tireplus.ca until you deliberately promote it.

---

## How publishing works

```
  edit src/  →  node build.js  →  commit + push to main
                                          │
                                          ▼
                              staging2.tireplus.ca   (automatic, ~60–90s)
                                          │
                                    you check it
                                          │
                                          ▼
                                   tireplus.ca       (manual button)
```

Two rules follow from this:

- **`main` is not live.** It's staging. Take your time there.
- **Deploys queue, they never overlap.** If two changes land close together the
  second waits for the first to finish. That's deliberate — an interrupted FTP
  upload could leave the site half-written.

---

## Before you start (one time only)

You need **Node.js 20 or newer** — https://nodejs.org — and Git. There is
nothing to install beyond that: `build.js` uses only what Node ships with, so
there's no `npm install`, no `node_modules`, no dependencies to keep updated.

```bash
git clone https://github.com/akromi/TIREPlus-bootstrap
cd TIREPlus-bootstrap
```

Every time after that, get the latest first:

```bash
git pull
```

---

## Making a change

### Step 1 — Edit the right file

This is the part that catches people out. **Page content is edited in `src/`,
never in `site/`.** Anything you type into `site/about/index.html` is erased the
next time the site builds. But CSS, JavaScript and images *do* live in `site/`
and are edited there directly.

| To change | Edit this |
|---|---|
| Wording on a page | `src/pages/<page>/index.html` **and its French twin** under `src/pages/fr/` |
| Page title / Google description | the `title:` and `description:` lines at the top of that page's file |
| Navigation links | `src/_partials/nav.html` **and** `nav-fr.html` |
| Footer | `src/_partials/footer.html` **and** `footer-fr.html` |
| Address, hours, phone shown in Google results | the JSON-LD block in `src/_partials/head.html` **and** `head-fr.html` |
| Colours, fonts, spacing | `site/css/style.css` |
| Language-toggle page pairs, click tracking | `site/js/main.js` |
| Redirects, caching, security headers | `site/.htaccess.production` and `.htaccess.staging` |
| The "page not found" page | `src/pages/404.html` (one bilingual page — keep that filename) |

> **Everything is bilingual.** Every English page has a French counterpart, and
> a CI check fails the build if the two counts don't match. Change one, change
> the other.

### Step 2 — Rebuild

```bash
node build.js
```

**This is not optional, even for a CSS or JavaScript edit.** Every stylesheet
and script is referenced with a `?v=` content fingerprint, and the build
recalculates it. Skip the rebuild and returning visitors keep the old file for
up to a year, because the live site caches these aggressively. CI catches it,
but only after you've opened a pull request — save yourself the round trip.

### Step 3 — Preview it

```bash
npx serve site
```

Then open the address it prints (usually http://localhost:3000).

> Serve the folder as above — **don't double-click `site/index.html`**. The
> pages load the stylesheet from `/css/style.css`, which only resolves when the
> folder is being served, so opening the file directly shows a half-styled page.

### Step 4 — Publish to staging

```bash
git add .
git commit -m "Short note about what you changed"
git push
```

Wait 60–90 seconds, then open **https://staging2.tireplus.ca**. Hold **Shift**
and reload if you still see the old version.

### Step 5 — Check it

Click through what you changed, in both languages. For a broader sweep:

```bash
node test.js                          # checks staging
```

That runs over 200 checks — pages load, images resolve, both languages line up,
the booking and tire-search widgets are wired correctly. Failures print the
specific assertion that broke.

### Step 6 — Go live

1. Go to the **Actions** tab on GitHub.
2. Click **Deploy** in the left sidebar.
3. Click **Run workflow** (top right).
4. Set **Deploy target** to `production`.
5. Click **Run workflow**.

Then confirm the live site:

```bash
node test.js https://tireplus.ca
```

---

## Editing from a phone or someone else's computer

You can edit directly on GitHub — click a file, click the pencil (✏️), commit
to `main`. Whether that's safe depends on the file:

**Safe to edit in the browser.** These ship exactly as they are:
`site/robots.txt`, `site/llms.txt`, `site/sitemap.xml`, and the two `.htaccess`
files.

**Works, but leaves a mess.** Editing anything in `src/` still deploys
correctly, because the deploy runs the build itself — the live page will be
right. But the `site/` folder committed to Git is now stale, and the *next* pull
request anyone opens will fail its CI check until someone runs `node build.js`.
Fine in a pinch; rebuild and commit when you're back at a computer.

**Don't.** Editing a built page under `site/` (like `site/faq/index.html`)
appears to work and is then silently overwritten by the next build.

---

## Adding a whole new page

Six steps, and missing any one of them is the most common way to half-add a
page:

1. Create `src/pages/my-page/index.html`, copying an existing page as a starting
   point.
2. Create the French version at `src/pages/fr/mon-slug/index.html`, and put
   `lang: fr` in its front-matter. Without that line it gets the English header
   and footer.
3. Add the link to `src/_partials/nav.html` and `nav-fr.html`.
4. Add the English↔French slug pair to `langMap` in `site/js/main.js`, so the
   language toggle lands on the matching page instead of the homepage.
5. Add both URLs to `site/sitemap.xml`.
6. `node build.js`, commit, push.

Steps 2, 3 and 5 are enforced by CI, so a half-finished page fails the pull
request rather than reaching the site.

---

## Checking a deploy worked

GitHub → **Actions** tab. The newest run is at the top.

- Green tick = uploaded successfully.
- Red X = click it to read which step failed.
- Yellow dot = still running, or **queued behind another deploy** (normal).

If staging still shows old content after a green deploy, hard-refresh with
**Ctrl+Shift+R**. If it persists, see *Troubleshooting* in
[README.md](README.md) — there's a cache header to check.

---

## Undoing a change

There is **no rollback button** — the site is uploaded by FTP, not hosted on a
platform that keeps previous versions. You undo by reversing the commit:

```bash
git revert <commit-sha>
git push
```

That redeploys the previous state to staging automatically. To undo it on the
live site as well, run the production deploy again (Step 6 above) once the
revert is on `main`.

Nothing is ever permanently lost — every version is in Git history.

---

## Things not to break

**Don't skip `node build.js`.** Covered above, and worth repeating: it's the
one step that makes a CSS or JS change actually reach visitors.

**Don't commit a file called `site/.htaccess`.** There are two variants —
`.htaccess.staging` and `.htaccess.production` — and the deploy renames the
right one into place. A committed `site/.htaccess` would override that and could
apply staging's "hide from Google" rule to the live site.

**Don't change the Bootstrap version without updating its `integrity` hash.**
The stylesheet and script tags in `src/_partials/head.html` and `footer.html`
carry a cryptographic fingerprint. Change the version number alone and the
browser refuses to load the file — the site loses all styling. Both the version
and the hash change together, or neither does.

**Don't rename `404.html` or move it into a folder.** Its filename is what
keeps it out of the sitemap and page-parity checks.

**Don't replace an image with a new one under the same filename.** Images are
cached for a year and aren't fingerprinted the way CSS and JS are. Give the
replacement a new name.

**Don't put the booking scheduler in an `<iframe>`.** It has been tried. The
booking provider blocks embedding outright, so the page renders nothing but
"refused to connect". The pop-up modal is the supported approach.

**Don't put passwords or secret keys in any file in this repo.** It's a public
repository, and Git remembers deleted files forever. The contact form's secret
key lives in a file on the server, above the web root — see *Contact form
reCAPTCHA secret* in [README.md](README.md).

---

## If something goes wrong

Revert and push (see *Undoing a change*), which puts staging back within about a
minute, then work out the problem at your own pace. If the live site is the one
affected, revert first and then run the production deploy.

If a deploy fails partway through, just run it again — each deploy wipes and
re-uploads the whole site, so running it twice is harmless.

For anything deeper — how the build works, the security headers, analytics
events, the booking and tire-search widgets — see [README.md](README.md).
