"""
Build the bayzl favicon: a single basil seed silhouette, in the site's own
brand colors, on a fully transparent background (no square/badge backdrop —
the seed's own outline is the icon shape). Drawn directly with Pillow by
sampling the same Bezier curves you'd write in an SVG, at 4x supersampling
for clean anti-aliased edges without needing a native SVG renderer.

Exception: apple-touch-icon.png gets a solid paper-color square behind the
seed. iOS renders transparency in touch icons as flat black, so a filled
square is the correct treatment there — it isn't a stylistic square, it's
what that one icon type needs to not look broken on a home screen.
"""
import math
from PIL import Image, ImageDraw

SS = 4          # supersample factor
CANVAS = 100    # local design units

# Site palette (from index.html :root)
INK = (33, 54, 42, 255)        # --ink
SAGE_DEEP = (126, 154, 124, 255)  # --sage-deep, subtle highlight

def cubic_bezier(p0, p1, p2, p3, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0]
        y = mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts

def rotate(pt, deg, cx, cy):
    rad = math.radians(deg)
    x, y = pt[0] - cx, pt[1] - cy
    return (x*math.cos(rad) - y*math.sin(rad) + cx, x*math.sin(rad) + y*math.cos(rad) + cy)

def s(pt):
    return (pt[0] * SS, pt[1] * SS)

CX, CY, ANGLE = 50, 52, -16  # slight tilt, matches the casual scatter on the label art

# A basil seed: slim and elongated with sharp tapered tips (a grain, not a
# pebble) — control points stay close to each tip so the curve comes to a
# real point instead of rounding off, then flares out to the widest point
# a little below center, tapering longer toward the bottom tip.
outline = []
outline += cubic_bezier((50,6),  (58,10), (65,22), (64,44))
outline += cubic_bezier((64,44), (63,66), (58,88), (50,98))
outline += cubic_bezier((50,98), (42,88), (37,66), (36,44))
outline += cubic_bezier((36,44), (35,22), (42,10), (50,6))
outline = [s(rotate(p, ANGLE, CX, CY)) for p in outline]

# Subtle center ridge for a touch of dimension at larger sizes.
ridge = [s(rotate(p, ANGLE, CX, CY)) for p in cubic_bezier((50,14), (47,40), (47,66), (50,92))]

canvas_px = CANVAS * SS
img = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.polygon(outline, fill=INK)
draw.line(ridge, fill=SAGE_DEEP, width=round(2.2*SS), joint="curve")
for x, y in [ridge[0], ridge[-1]]:
    r = 2.2*SS/2
    draw.ellipse([x-r, y-r, x+r, y+r], fill=SAGE_DEEP)

# Trim to content with a small margin so the seed fills the frame (the
# earlier version had the shape floating small inside a big square — this
# crops tight so it reads large in a 16-32px tab icon).
bbox = img.getbbox()
pad = 8
x0 = max(bbox[0]-pad, 0); y0 = max(bbox[1]-pad, 0)
x1 = min(bbox[2]+pad, canvas_px); y1 = min(bbox[3]+pad, canvas_px)
img = img.crop((x0, y0, x1, y1))

master = img.resize((512, 512), Image.LANCZOS)
master.save("assets/favicon-source.png", optimize=True)

sizes = [16, 32, 48]
icos = [img.resize((sz, sz), Image.LANCZOS) for sz in sizes]
icos[0].save("assets/favicon.ico", format="ICO", sizes=[(sz, sz) for sz in sizes], append_images=icos[1:])

img.resize((32, 32), Image.LANCZOS).save("assets/favicon-32.png")

# apple-touch-icon: solid paper-color square background (iOS requirement),
# seed centered and sized to leave standard icon padding.
PAPER = (244, 242, 234, 255)
apple = Image.new("RGBA", (180, 180), PAPER)
seed_on_apple = img.resize((132, 132), Image.LANCZOS)
apple.alpha_composite(seed_on_apple, ((180-132)//2, (180-132)//2))
apple.convert("RGB").save("assets/apple-touch-icon.png")

print("done:", img.size, "-> ico", sizes, "apple 180x180")
