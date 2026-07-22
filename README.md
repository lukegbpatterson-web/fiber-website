# bayzl — landing page

A single-file, waitlist landing page for bayzl (pre-meal fiber blend). Built to be
simple, elegant, and easy to host anywhere.

- **Stack:** one `index.html` (inline CSS + JS). GSAP + ScrollTrigger + Three.js via CDN.
- **Type:** Newsreader (display) + Hanken Grotesk (body), from Google Fonts.
- **Palette:** pulled from the jar — forest ink `#21362A`, sage `#A9C1A6`, sand `#E7D6B6`, teal `#79BDB4`, warm paper `#F4F2EA`.

## Preview locally
```bash
cd path/to/this/folder
python -m http.server 8137
# open http://localhost:8137
```
(Any static server works. Opening the file directly also works, but a server is closer to production.)

## What to fill in
Search `index.html` for `EDIT:` comments. The main ones:

1. **Product photo (optional).** Drop a transparent PNG at `assets/product.png` and it
   replaces the built-in vector jar automatically. Leave it out and the vector jar shows.
2. **Founder photos.** Add `assets/tom.jpg` and `assets/brother.jpg` (portrait, ~4:5).
   Missing files fall back to a soft placeholder, so the page never looks broken.
3. **Mission + bios + names.** In the About section — replace the bracketed placeholders.
4. **Social / contact** in the footer.

## Connect the email list
By default the form runs in **demo mode** (shows a success state, sends nothing).
To collect real emails, open the `<script>` at the bottom of `index.html` and set:

```js
const FORM_ENDPOINT = "https://formspree.io/f/xxxxxxx";
```

It POSTs `{ "email": "..." }` as JSON. Works with **Formspree, Buttondown, ConvertKit,
Mailchimp** (via a hosted endpoint/Zapier), or your own handler. Swap the URL and you're live.

## Deploy
It's fully static — drag the folder into **Netlify** or **Vercel**, or push to **GitHub Pages**.
No build step.

## Notes
- Respects `prefers-reduced-motion` (animations and the seed drift turn off).
- Responsive down to mobile; keyboard-focusable with visible focus rings.
- The drifting specks behind the hero are basil seeds rendered in Three.js — subtle by design.
