"""
Remove the smooth mint-gradient background from the bayzl product photo.

Naive color-distance keying fails here: the jar's own label has pale sage
sections that are close in color to the gradient backdrop, so simple
per-pixel thresholding punches holes *inside* the product, not just around
it. The fix is to only key out background pixels that are connected to the
image border — anything enclosed by the jar's silhouette survives even if
its color happens to match the backdrop.

Steps:
  1. Estimate a smooth per-row background color from thin strips at the far
     left/right edges of each row (always background in this composition).
  2. Build a *candidate* background mask from color distance to that estimate.
  3. Keep only the candidates connected to the image border (flood fill /
     connected-component labeling) — this is what prevents interior holes.
  4. Feather the resulting matte so the cutout edge isn't jagged.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def remove_background(in_path, out_path, thresh=32, feather=1.6, pad=48):
    img = Image.open(in_path).convert("RGB")
    arr = np.asarray(img).astype(np.float32)
    h, w, _ = arr.shape

    # Per-row background estimate from edge strips (robust to the vertical
    # gradient — each row's own edges are always pure background here).
    strip = 14
    row_bg = np.concatenate([arr[:, :strip, :], arr[:, -strip:, :]], axis=1).mean(axis=1)
    dist = np.sqrt(((arr - row_bg[:, None, :]) ** 2).sum(axis=2))

    candidate_bg = dist < thresh

    # Only keep background candidates reachable from the border — this is
    # the key step that stops pale label pixels *inside* the jar from being
    # mistaken for background just because the color is similar.
    labeled, _ = ndimage.label(candidate_bg)
    border_labels = set(labeled[0, :]) | set(labeled[-1, :]) | set(labeled[:, 0]) | set(labeled[:, -1])
    border_labels.discard(0)
    border_connected = np.isin(labeled, list(border_labels))

    alpha = np.where(border_connected, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(feather))

    out = img.convert("RGBA")
    out.putalpha(alpha_img)

    # Crop tightly to the opaque content with a little breathing room, so the
    # export isn't mostly empty transparent canvas.
    a = np.asarray(alpha_img)
    ys, xs = np.where(a > 10)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, w)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, h)
    out = out.crop((x0, y0, x1, y1))

    out.save(out_path)
    print(f"Saved {out_path} ({out.size[0]}x{out.size[1]})")

if __name__ == "__main__":
    remove_background(sys.argv[1], sys.argv[2])
