"""
Build the bayzl favicon set from assets/favicon-source.png — a basil seed
silhouette (striped/ridged, in the site's sage-green palette) with a real
alpha channel already baked in.

Each output is the seed scaled to fill its square canvas as large as
possible while staying fully visible (fit-to-contain, not crop-to-cover),
centered with a small margin.

Exception: apple-touch-icon.png gets a solid paper-color square behind the
seed. iOS renders transparency in touch icons as flat black, so a filled
square is the correct treatment there — it isn't a stylistic square, it's
what that one icon type needs to not look broken on a home screen.
"""
from PIL import Image

SRC = "assets/favicon-source.png"
PAPER = (244, 242, 234, 255)  # --paper

def fit_on_square(im, size, margin_frac=0.04):
    inner = round(size * (1 - margin_frac * 2))
    ratio = min(inner / im.width, inner / im.height)
    w, h = round(im.width * ratio), round(im.height * ratio)
    resized = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size - w) // 2, (size - h) // 2))
    return canvas

src = Image.open(SRC).convert("RGBA")

sizes = [16, 32, 48]
icos = [fit_on_square(src, sz) for sz in sizes]
icos[0].save("assets/favicon.ico", format="ICO", sizes=[(sz, sz) for sz in sizes], append_images=icos[1:])

fit_on_square(src, 32).save("assets/favicon-32.png")

apple = Image.new("RGBA", (180, 180), PAPER)
seed = fit_on_square(src, 180, margin_frac=0.14)
apple.alpha_composite(seed)
apple.convert("RGB").save("assets/apple-touch-icon.png")

print("done:", sizes, "+ apple-touch-icon 180x180")
