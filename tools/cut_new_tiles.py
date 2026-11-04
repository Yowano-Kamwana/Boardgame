# Crops the top-down biome tiles (one per biome) off their wooden backdrops.
# Usage: python3 -I cut_new_tiles.py <Tiles dir> <assets/tiles dir>
import sys, os, glob, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
names = {'08_41_25': 'swamp', '08_41_34': 'ruins', '08_41_40': 'crystal',
         '08_41_46': 'highlands', '08_41_58': 'corrupted', '08_42_10': 'forest'}
for f in sorted(glob.glob(os.path.join(src, 'ChatGPT*.png'))):
    biome = next(v for k, v in names.items() if k in f)
    img = cv2.imread(f, cv2.IMREAD_UNCHANGED)
    if img.shape[2] == 4:
        a = img[..., 3]
        img = img[..., :3].copy()
        img[a < 10] = 0
    # wood backdrop colour = mean of the four corner patches; the tile differs from it
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    H0, W0 = img.shape[:2]
    c = 6
    ref = np.concatenate([lab[:c, :c].reshape(-1, 3), lab[:c, -c:].reshape(-1, 3),
                          lab[-c:, :c].reshape(-1, 3), lab[-c:, -c:].reshape(-1, 3)]).mean(0)
    d = np.sqrt(((lab - ref) ** 2).sum(-1))
    # Walk in from each side along the centre row/column until the coloured rim begins.
    hit = d > 38
    def first(line):
        for i in range(len(line) - 4):
            if line[i:i + 4].all():
                return i
        return 0
    row, col = hit[H0 // 2], hit[:, W0 // 2]
    x0, x1 = first(row), W0 - first(row[::-1])
    y0, y1 = first(col), H0 - first(col[::-1])
    x, y, w, h = x0, y0, x1 - x0, y1 - y0
    crop = img[y:y + h, x:x + w]
    crop = cv2.resize(crop, (1024, 888), interpolation=cv2.INTER_LANCZOS4)
    crop = cv2.detailEnhance(crop, sigma_s=5, sigma_r=0.1)
    cv2.imwrite(os.path.join(out, f'{biome}_1.jpg'), crop, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(biome, (x, y, w, h), img.shape[:2], round(w / h, 3))
