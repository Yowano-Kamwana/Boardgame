# Builds every game asset for the Rootbound playtest app from the concept-art zips.
# Usage: python3 -I build_assets.py <Game Graphics dir> <Cards Designs dir> <out assets dir>
import os, sys, cv2, numpy as np
from PIL import Image, ImageFilter

GFX, CARDS, OUT = sys.argv[1:4]
for d in ('tiles', 'cards', 'ui'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

def save_jpg(img, path, q=86):
    img.convert('RGB').save(os.path.join(OUT, path), quality=q, optimize=True, progressive=True)

def save_png(img, path):
    img.save(os.path.join(OUT, path), optimize=True)

# ---------- Biome tiles (flat-top hex textures; UVs map the hex into the rect) ----------
comp = cv2.imread(os.path.join(GFX, 'Fantasy Biome Tile Compendium.png'))
biomes = ['forest', 'ruins', 'crystal', 'swamp', 'highlands', 'corrupted']
cols = [145, 416, 660, 904, 1156, 1410]
label_y = [262, 504, 749]
W, H, OW, OH = 236, 204, 512, 444
yy, xx = np.mgrid[0:OH, 0:OW]
# distance-to-edge band inside the hex (flat-top): outer 22% is where background leaks in
cx, cy = OW / 2, OH / 2
dx, dy = np.abs(xx - cx) / (OW / 2), np.abs(yy - cy) / (OH / 2)
hexd = np.maximum(dy, dx + dy / 2)  # 1.0 on the flat-top hex boundary
band = (hexd > 0.72) & (yy < OH * 0.5)  # leaks only happen in the upper corners
for r, ly in enumerate(label_y):
    for b, cxs in zip(biomes, cols):
        bottom = ly - 6
        crop = comp[bottom - H:bottom, cxs - W // 2:cxs + W // 2]
        t = cv2.resize(crop, (OW, OH), interpolation=cv2.INTER_CUBIC)
        hsv = cv2.cvtColor(t, cv2.COLOR_BGR2HSV)
        # the sheet's dark-brown backdrop: low value, low-ish saturation
        bg = ((hsv[..., 2] < 55) & (hsv[..., 1] < 160)) & band
        bg = cv2.dilate(bg.astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
        t = cv2.inpaint(t, bg, 9, cv2.INPAINT_TELEA)
        t = cv2.detailEnhance(t, sigma_s=6, sigma_r=0.12)
        cv2.imwrite(os.path.join(OUT, 'tiles', f'{b}_{r + 1}.jpg'), t, [cv2.IMWRITE_JPEG_QUALITY, 86])

# Workshop hub (already a flat-top hex with a stone rim) and the compass tile back
hub = Image.open(os.path.join(GFX, 'Enchanted Mushroom Workshop Hub.png'))
save_jpg(hub.crop((48, 42, 1294, 1088)).resize((1024, 888), Image.LANCZOS), 'tiles/workshop.jpg', 88)
back = Image.open(os.path.join(GFX, 'Hexagonal Compass Game Tile.png'))
save_jpg(back.crop((146, 113, 1202, 979)).resize((512, 444), Image.LANCZOS), 'tiles/back.jpg', 84)

# ---------- Cards ----------
CARD_NAMES = {
    'forest': ['discovery-trail', 'corrupted-grove-s', 'mushroom-forge', 'whispering-spirit', 'ancient-ruin',
               'supply-cache', 'luminous-fields', 'forest-wraith', 'hidden-village', 'crystal-vein',
               'night-journey', 'ancient-monolith', 'root-ambush', 'forest-relic', 'rootbound'],
    'weather': ['clear-skies', 'gentle-rain', 'fog', 'strong-winds', 'thunderstorm',
                'heatwave', 'heavy-snow', 'magical-bloom', 'corrupting-mists', 'eclipse'],
    'creature': ['mushroom-scout', 'forest-stag', 'stone-guardian', 'glade-spirit', 'ancient-treant',
                 'corrupted-wolf', 'blighted-mushroom', 'shadow-stalker', 'crystal-husk', 'root-king'],
    'crystal': ['crystal-bloom', 'shadow-rift'],
    'ruins': ['forgotten-workshop', 'ruined-gateway'],
    'shrine': ['forest-shrine', 'corrupted-grove'],
}
SHEETS = {
    'forest': 'Rootbound Forest Card Collection (1).png', 'weather': 'Fantasy Weather Card Collection.png',
    'creature': 'Fantasy Forest Creature Card Sheet.png', 'crystal': 'Crystal Fields_ Bloom and Rift.png',
    'ruins': 'Forgotten Ruins_ Light and Corruption.png', 'shrine': 'Forest Shrine and Corrupted Grove Cards.png',
}
for key, fn in SHEETS.items():
    img = cv2.imread(os.path.join(CARDS, fn))
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    m = (g > 38).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    area = img.shape[0] * img.shape[1]
    boxes = sorted([s[:4] for s in stats[1:] if s[4] > area * 0.02], key=lambda b: (round(b[1] / 150), b[0]))
    assert len(boxes) == len(CARD_NAMES[key]), (key, len(boxes))
    for name, (x, y, w, h) in zip(CARD_NAMES[key], boxes):
        crop = img[y:y + h, x:x + w]
        if w > 520:
            crop = cv2.resize(crop, (520, int(h * 520 / w)), interpolation=cv2.INTER_AREA)
        elif w < 400:  # small sheet cards: upscale a little so text stays legible when zoomed
            crop = cv2.resize(crop, (int(w * 1.5), int(h * 1.5)), interpolation=cv2.INTER_CUBIC)
            crop = cv2.detailEnhance(crop, sigma_s=4, sigma_r=0.1)
        cv2.imwrite(os.path.join(OUT, 'cards', f'{name}.jpg'), crop, [cv2.IMWRITE_JPEG_QUALITY, 84])

# ---------- Resource tokens (remove the parchment backdrop) ----------
tok = Image.open(os.path.join(GFX, 'openart-1792725598_1895569f_1792725600960_9ca6f92b.png')).convert('RGB')
k = 2048 / 1932
boxes = {'food': (45, 235, 665, 800), 'wood': (690, 285, 1145, 740), 'metal': (1285, 265, 1760, 755),
         'crystal': (120, 1010, 545, 1625), 'essence': (680, 1075, 1150, 1565), 'artifact': (1265, 1055, 1775, 1610)}
for name, b in boxes.items():
    c = np.array(tok.crop(tuple(int(v * k) for v in b)))
    bgr = cv2.cvtColor(c, cv2.COLOR_RGB2BGR)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.int32)
    ref = lab[4:12, 4:12].reshape(-1, 3).mean(0)
    dist = np.sqrt(((lab - ref) ** 2).sum(-1))
    fg = (dist > 22).astype(np.uint8)
    # keep the largest connected blob (the token), drop specks and shadow fringes
    n, l, st, _ = cv2.connectedComponentsWithStats(fg)
    keep = np.zeros_like(fg)
    for i in range(1, n):
        if st[i, 4] > st[1:, 4].max() * 0.04:
            keep[l == i] = 1
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    alpha = cv2.GaussianBlur(keep.astype(np.float32), (5, 5), 0)
    rgba = np.dstack([c, (alpha * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, 'RGBA')
    im = im.crop(im.getbbox())
    im.thumbnail((192, 192), Image.LANCZOS)
    save_png(im, f'ui/token-{name}.png')

# ---------- Characters, creatures, logo, cover ----------
sheet = Image.open(os.path.join(GFX, 'Designer (36).png')).convert('RGB')
portraits = {'mushy': (560, 34, 712, 215), 'bramblecap': (702, 25, 868, 215), 'morella': (858, 12, 1004, 215),
             'sporewick': (995, 18, 1160, 215), 'root-king-art': (1205, 330, 1525, 470),
             'wind-nymph': (1205, 495, 1340, 630), 'shadow-stalker-art': (1365, 505, 1525, 630),
             'sporelings': (1205, 690, 1345, 770), 'forest-giant': (1335, 665, 1525, 770),
             'skyship': (742, 838, 876, 990), 'weather-engine': (882, 838, 1016, 990),
             'monster-cage': (1022, 838, 1158, 990), 'portal-stabilizer': (1166, 838, 1302, 990)}
for name, b in portraits.items():
    im = sheet.crop(b)
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.5, 70, 2))
    save_jpg(im, f'ui/{name}.jpg', 86)
cover = Image.open(os.path.join(GFX, 'opengen-372caa3d-fb56-41f4-a3ab-e69ace21f5ba.jpg')).convert('RGB')
save_jpg(cover, 'ui/cover.jpg', 82)
save_jpg(cover.crop((28, 30, 800, 262)), 'ui/logo.jpg', 88)
print('done')
