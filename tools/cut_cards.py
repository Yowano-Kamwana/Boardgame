# Finds individual cards on the concept sheets (dark backgrounds) and saves each one.
import sys, os, cv2, numpy as np
from PIL import Image
src_dir, out_dir = sys.argv[1], sys.argv[2]
sheets = {
    'forest':   'Rootbound Forest Card Collection (1).png',
    'weather':  'Fantasy Weather Card Collection.png',
    'creature': 'Fantasy Forest Creature Card Sheet.png',
    'crystal':  'Crystal Fields_ Bloom and Rift.png',
    'ruins':    'Forgotten Ruins_ Light and Corruption.png',
    'shrine':   'Forest Shrine and Corrupted Grove Cards.png',
}
for key, fn in sheets.items():
    img = cv2.imread(os.path.join(src_dir, fn))
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    m = (g > 38).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    area = img.shape[0] * img.shape[1]
    boxes = [s[:4] for s in stats[1:] if s[4] > area * 0.02]
    boxes.sort(key=lambda b: (round(b[1] / 150), b[0]))
    for i, (x, y, w, h) in enumerate(boxes):
        crop = img[y:y + h, x:x + w]
        scale = min(1.0, 640 / w)
        if scale < 1:
            crop = cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(out_dir, f'{key}_{i + 1}.jpg'), crop, [cv2.IMWRITE_JPEG_QUALITY, 86])
        print(key, i + 1, w, h)
