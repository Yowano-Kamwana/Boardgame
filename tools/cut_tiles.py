# Cuts biome hex textures out of the tile compendium sheet.
import sys, math
from PIL import Image, ImageDraw, ImageFilter
src = Image.open(sys.argv[1]).convert('RGB')
out = sys.argv[2]
biomes = ['forest','ruins','crystal','swamp','highlands','corrupted']
cols = [145, 416, 660, 904, 1156, 1410]
label_y = [262, 504, 749]
W, H = 236, 204            # source hex footprint (flat-top)
OW, OH = 512, 444          # output: regular flat-top hex
def hexmask(w, h):
    m = Image.new('L', (w*4, h*4), 0)
    pts = [(0, h*2), (w, 0), (w*3, 0), (w*4, h*2), (w*3, h*4), (w, h*4)]
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.resize((w, h), Image.LANCZOS)
mask = hexmask(OW, OH)
sheet = Image.new('RGB', (OW*6//2, OH*3//2), (30, 25, 20))
for r, ly in enumerate(label_y):
    for c, (b, cx) in enumerate(zip(biomes, cols)):
        bottom = ly - 6
        box = (cx - W//2, bottom - H, cx + W//2, bottom)
        t = src.crop(box).resize((OW, OH), Image.LANCZOS)
        t = t.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        t.putalpha(mask)
        t.save(f'{out}/{b}_{r+1}.png')
        sheet.paste(t.resize((OW//2, OH//2)), (c*OW//2, r*OH//2), t.resize((OW//2, OH//2)))
sheet.save(f'{out}/_contact.png')
