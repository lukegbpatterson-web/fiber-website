"""Resize each variant's hero image for the web: max 800 px wide, WebP, alpha kept.
Run after dropping in a new assets/product-hero-{a,b,c}.webp, then run `node build.mjs`.
Needs Pillow:  pip install pillow
Writes assets/hero/<id>.webp and assets/hero/manifest.json (build.mjs only trusts an optimized
file whose recorded source hash matches the current source, so a stale one is never served)."""
import hashlib, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_W, BUDGET_KB = 800, 200
cfg = json.load(open(os.path.join(ROOT, "variants.config.json"), encoding="utf8"))
os.makedirs(os.path.join(ROOT, "assets", "hero"), exist_ok=True)
manifest = {}
for v in cfg["variants"]:
    src = next((p for p in v["heroImage"] if os.path.exists(os.path.join(ROOT, p))), None)
    if not src:
        continue
    src_path = os.path.join(ROOT, src)
    im = Image.open(src_path)
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    out_rel = f"assets/hero/{v['id'].lower()}.webp"
    for q in (84, 78, 72, 66, 60):
        im.save(os.path.join(ROOT, out_rel), "WEBP", quality=q, method=6)
        kb = os.path.getsize(os.path.join(ROOT, out_rel)) / 1024
        if kb <= BUDGET_KB:
            break
    manifest[v["id"]] = {"source": src, "sha1": hashlib.sha1(open(src_path, "rb").read()).hexdigest(), "out": out_rel}
    print(f"{v['id']}: {src} -> {out_rel}  {im.width}x{im.height}  {kb:.0f} KB (q{q})")
json.dump(manifest, open(os.path.join(ROOT, "assets", "hero", "manifest.json"), "w"), indent=1)
