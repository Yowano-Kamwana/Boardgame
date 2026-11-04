# Cuts the six simple pointy-top biome tiles from a reference sheet on parchment and fits each
# into a flat-top hex texture (the largest flat-top hex inside the pointy one).
# Usage: python3 -I cut_simple_tiles.py <sheet.png> <out dir>
import sys, os, math, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
if img.shape[2] == 4:
    img = img[..., :3]
# Tile centres and circumradius, measured on the 405x276 reference sheet (pointy-top hexes).
TILES = {
    'forest':    (188 / 3, 173 / 3, 212 / 3), 'ruins':     (598 / 3, 173 / 3, 212 / 3),
    'crystal':   (1010 / 3, 173 / 3, 213 / 3), 'swamp':     (183 / 3, 646 / 3, 206 / 3),
    'highlands': (588 / 3, 645 / 3, 205 / 3), 'corrupted': (982 / 3, 645 / 3, 206 / 3),
}
for name, (cx, cy, R) in TILES.items():
    r = 0.866 * R * 0.97                 # largest flat-top hex inside, slightly inset
    box_w, box_h = 2 * r, math.sqrt(3) * r
    # sub-pixel crop via affine warp, then upscale
    OW, OH = 768, 666
    M = np.float32([[box_w / OW, 0, cx - box_w / 2], [0, box_h / OH, cy - box_h / 2]])
    t = cv2.warpAffine(img, M, (OW, OH), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    t = cv2.bilateralFilter(t, 7, 28, 7)                         # smooth upscale blockiness, keep edges
    blur = cv2.GaussianBlur(t, (0, 0), 2.2)
    t = cv2.addWeighted(t, 1.55, blur, -0.55, 0)                 # unsharp
    cv2.imwrite(os.path.join(out, f'{name}_1.jpg'), t, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(name, 'ok')
