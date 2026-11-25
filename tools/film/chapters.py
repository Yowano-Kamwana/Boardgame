#!/usr/bin/env python3
"""Splits the finished tutorial into web chapters, each small enough to publish as one artifact file.

usage: python3 chapters.py <tutorial.mp4> <out dir>
Reads <tutorial>.scenes.json (written by assemble.py) and writes ch1.mp4..chN.mp4, poster jpgs
and chapters.json. Each chapter is encoded to stay under LIMIT bytes.
"""
import json, os, subprocess, sys

src, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
meta = json.load(open(os.path.splitext(src)[0] + '.scenes.json'))
starts, total = meta['starts'], meta['total']
LIMIT = 14.2e6

# chapters: (title, first scene, last scene), scenes numbered from 1
CHAPTERS = [
    ('The Everdeep', 1, 2),
    ('The Goal & the Heroes', 3, 4),
    ('The Board & Your Turn', 5, 6),
    ('Search, Gather, Build', 7, 8),
    ('Corruption & Horror', 9, 9),
    ('Fight, Cleanse, Fear', 10, 11),
    ('The Root King & Victory', 12, 14),
]
info = []
for n, (title, a, b) in enumerate(CHAPTERS, 1):
    t0 = starts[a - 1]
    t1 = starts[b] if b < len(starts) else total
    length = t1 - t0
    audio_k = 128
    video_k = int(LIMIT * 8 / length / 1000 * 0.93) - audio_k   # leave room for container overhead
    video_k = min(video_k, 6000)
    path = os.path.join(out, f'ch{n}.mp4')
    for attempt in range(3):
        for p in (1, 2):
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{t0:.3f}', '-i', src, '-t', f'{length:.3f}',
                            '-c:v', 'libx264', '-preset', 'slow', '-b:v', f'{video_k}k', '-maxrate', f'{int(video_k * 1.6)}k',
                            '-bufsize', f'{video_k * 2}k', '-pass', str(p), '-passlogfile', os.path.join(out, 'pass'),
                            '-pix_fmt', 'yuv420p', '-profile:v', 'high',
                            *(['-an', '-f', 'mp4', os.devnull] if p == 1 else ['-c:a', 'aac', '-b:a', f'{audio_k}k', '-movflags', '+faststart', path])],
                           check=True)
        size = os.path.getsize(path)
        if size <= 15e6: break
        video_k = int(video_k * 0.88)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{t0 + min(3, length / 2):.3f}', '-i', src, '-frames:v', '1',
                    '-vf', 'scale=640:-1', '-q:v', '4', os.path.join(out, f'ch{n}.jpg')], check=True)
    info.append({'n': n, 'title': title, 'start': round(t0, 2), 'length': round(length, 2), 'file': f'ch{n}.mp4', 'poster': f'ch{n}.jpg'})
    print(f'ch{n} {title:26s} {length:5.1f}s  {video_k}k  {size / 1e6:.1f} MB', flush=True)
for f in os.listdir(out):
    if f.startswith('pass'): os.remove(os.path.join(out, f))
json.dump({'total': round(total, 2), 'chapters': info}, open(os.path.join(out, 'chapters.json'), 'w'), indent=1)
