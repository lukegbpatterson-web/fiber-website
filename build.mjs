// Generates the three variant pages (/, /2/, /3/) and /privacy/ from src/*.html + variants.config.json.
// Usage: node build.mjs
// The generated index.html files are committed; GitHub Pages serves them as-is (no build on the server).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(root, "variants.config.json"), "utf8"));
const page = readFileSync(join(root, "src/page.html"), "utf8");
const privacy = readFileSync(join(root, "src/privacy.html"), "utf8");
const manifestPath = join(root, "assets/hero/manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

// width/height of a .webp, read from the header (VP8, VP8L or VP8X) so <img> can reserve its space.
function webpSize(file) {
  const b = readFileSync(file);
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error("Not a webp: " + file);
}

function render(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error("Missing template var: " + k);
    return vars[k];
  });
}

function write(rel, html) {
  const out = join(root, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

// The email form (with its success state) appears twice per page; one partial keeps both identical.
const joinTpl = readFileSync(join(root, "src/join.html"), "utf8");
const joins = { join_hero: render(joinTpl, { id: "hero" }), join_final: render(joinTpl, { id: "final" }) };

const nav = cfg.variants.map((v) => v.id).join("/");
for (const v of cfg.variants) {
  const source = v.heroImage.find((p) => existsSync(join(root, p)));
  if (!source) throw new Error(`Variant ${v.id}: none of ${v.heroImage.join(", ")} exist`);
  // Prefer the web-optimized copy (scripts/optimize-images.py) when it was made from this exact source file.
  const m = manifest[v.id];
  const fresh = m && m.source === source && existsSync(join(root, m.out)) &&
    createHash("sha1").update(readFileSync(join(root, source))).digest("hex") === m.sha1;
  if (m && !fresh) console.warn(`  NOTE ${v.id}: assets/hero is stale for ${source}; run: python scripts/optimize-images.py`);
  const img = fresh ? m.out : source;
  const { w, h } = webpSize(join(root, img));
  const kb = Math.round(statSync(join(root, img)).size / 1024);
  console.log(`${v.id}: /${v.path}  hero=${img} ${w}x${h} ${kb}KB${source === v.heroImage[0] ? "" : "  (fallback source: " + source + ")"}`);
  if (kb > 200) console.warn(`  WARNING: ${img} is ${kb} KB, over the 200 KB budget`);

  const base = v.path ? "../" : "";
  write(join(v.path, "index.html"), render(page, {
    ...joins,
    variant: v.id,
    base,
    robots: v.robots,
    canonical: `${cfg.site.url}/${v.path ? v.path + "/" : ""}`,
    theme: v.theme,
    heroImage: img,
    heroW: String(w),
    heroH: String(h),
    heroAlt: v.heroAlt,
    fontsHref: v.fonts,
    themeLink: v.theme ? `<link rel="stylesheet" href="${base}${v.theme}" />` : "",
    bgScript: v.background ? base + v.background : "",
  }));
}

write("privacy/index.html", render(privacy, {
  base: "../",
  fontsHref: cfg.variants[0].fonts,
  robots: "noindex, nofollow",
}));
console.log("built", nav, "+ privacy");
