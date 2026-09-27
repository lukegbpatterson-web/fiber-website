# bayzl — landing pages (basilseedfiber.com)

Three static landing-page variants for the bayzl lemon-lime fiber blend, used to
test different mockups and looks against the same copy and layout. Served by
GitHub Pages at **basilseedfiber.com** (the `CNAME` file), straight from `main`.
No build step.

| Page | URL | File | Look |
|------|-----|------|------|
| 1 | `basilseedfiber.com/` | `index.html` | Sage/earthy, "crunchy 2" mockup, drifting citrus dust |
| 2 | `basilseedfiber.com/2/` | `2/index.html` | Lemon-cream/leaf green, "medium 3" mockup, floating citrus slices |
| 3 | `basilseedfiber.com/3/` | `3/index.html` | Sunny "treat" look, "modern stick 2" mockup, fizz bubbles |

Page 1 is the public/indexed page. Pages 2 and 3 are `noindex` test variants
reached by their direct links.

**Switching pages:** there's no visible menu. Click the tagline at the very
bottom of any page ("Nature's blueprint for better eating.") to reveal links to
1, 2 and 3.

The site that was live before this (basil-seed version) is preserved at the
tag [`v1-bayzl-landing`](https://github.com/lukegbpatterson-web/fiber-website/tree/v1-bayzl-landing).

## What's here

- `index.html`, `2/index.html`, `3/index.html` — the three pages (identical copy
  and structure).
- `assets/styles.css`, `assets/nav.js`, `assets/main.js` — shared. `nav.js` is
  the footer page switcher; `main.js` is the waitlist form, ingredient
  tooltips on touch, and scroll reveals.
- Per-page look: `assets/theme-zest.css` (page 2) and `assets/theme-treat.css`
  (page 3) only redefine color tokens and a few styles on top of `styles.css`.
  Page 1 uses the defaults.
- Per-page background (Three.js): `assets/bg-dust.js` (1), `assets/bg-slices.js`
  (2), `assets/bg-bubbles.js` (3).
- `assets/product-hero.webp`, `product-hero-2.webp`, `product-hero-3.webp` — the
  three transparent mockups, cropped to their visible area.
- `google-apps-script/waitlist.gs` — Apps Script that receives waitlist
  submissions and appends them to a Google Sheet (see below).
- `CNAME`, `robots.txt`, `sitemap.xml` — domain and search-engine files.

## Preview locally
```bash
cd path/to/this/folder
python -m http.server 8137
# open http://localhost:8137  (and /2/, /3/)
```

## What to fill in
Search the pages for `EDIT:` comments. The main ones:

1. **Mission + bios.** In the About section — drafted placeholders; replace
   with your own words whenever you're ready. Edit all three pages.
2. **Founder photos.** `assets/founder-luke.jpg` and `assets/founder-will.jpg`.
   A missing file falls back to a soft silhouette.
3. **Product mockups.** Swap a `product-hero*` file under the same name. Page 1
   adapts to any aspect ratio; pages 2 and 3 set theirs via `--product-ratio`
   in their theme file.

## Waitlist
The forms post to a Google Apps Script web app (`FORM_ENDPOINT` at the top of
`assets/main.js`), which appends a row to a Google Sheet: timestamp, email, and
the page URL it came from — so the **Source** column shows whether a signup
came from `/`, `/2/` or `/3/`. One endpoint serves every page. It's currently
the same endpoint (and sheet) the previous basilseedfiber.com site used.

To point it at a different sheet:

1. Create a Google Sheet, then **Extensions > Apps Script**.
2. Paste in `google-apps-script/waitlist.gs`.
3. **Deploy > New deployment** → gear icon → **Web app** (Execute as: **Me**,
   Who has access: **Anyone**), authorize, and copy the `/exec` URL.
4. Paste it into `FORM_ENDPOINT` in `assets/main.js`.

If you edit the script after the first deploy, use **Manage deployments > Edit >
New version** — saving alone doesn't update the live `/exec` URL.

## Analytics
All three pages carry the existing Google Analytics 4 tag (`G-0LE6VK6ZT3`), so
traffic and conversions can be compared per page path (`/`, `/2/`, `/3/`).

## Deploy
Push to `main` — GitHub Pages republishes automatically (about a minute).

## Notes
- Respects `prefers-reduced-motion` (animations and hero backgrounds turn off).
- Responsive down to mobile; keyboard-focusable with visible focus rings.
- The hero backgrounds are subtle by design and kept behind the content.
