#!/usr/bin/env python3
"""Cuts the Rootbound tutorial together.

usage: python3 assemble.py <work dir> <vo dir> <out.mp4> [music file]

<work dir> holds frames/<shot>/f00000.jpg... (from capture.mjs) and vid/c1..c6 *.mp4 (the AI cinematics).
<vo dir> holds s01..s14 narration clips (.wav or .mp3), one per scene of reference/tutorial/script.md.
Each scene lasts as long as its narration plus a little air; shots are trimmed (or held) to fit.
Music, if given, loops under everything, is ducked under the voice and fades out at the end.
"""
import glob, os, subprocess, sys

work, vodir, out = sys.argv[1:4]
music = sys.argv[4] if len(sys.argv) > 4 else None
W, H, FPS = 1920, 1080, 24
LEAD, TAIL = 0.6, 0.9          # silence before and after each scene's narration
tmp = os.path.join(work, 'cut'); os.makedirs(tmp, exist_ok=True)

def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

def vo(i):
    return sorted(glob.glob(os.path.join(vodir, 's%02d.*' % i)))[0]

def clip(name):
    return glob.glob(os.path.join(work, 'vid', name + '*.mp4'))[0]

# Each scene: list of (source, share). Source is 'shot:<name>' (rendered frames) or 'vid:<prefix>' (cinematic).
# Shares split the scene length between sources; None = take the rest.
SCENES = {
    1: [('vid:c1', 1/3), ('vid:c2', 1/3), ('vid:c3', None)],
    2: [('vid:c6', None)],
    3: [('shot:goal', None)],
    4: [('shot:heroes', None)],
    5: [('shot:board', None)],
    6: [('shot:turn', None)],
    7: [('shot:search', None)],
    8: [('shot:gather', None)],
    9: [('vid:c4', 4.5), ('shot:corrupt', None)],
    10: [('shot:fight', None)],
    11: [('shot:cleanse', None)],
    12: [('vid:c5', 5.0), ('shot:king', None)],
    13: [('shot:win', None)],
    14: [('shot:outro', None)],
}
MIN_LEN = {2: 6.0, 14: 7.0}    # the title and the outro linger

def piece(src, length, outp):
    kind, name = src.split(':')
    fade = f"fade=t=in:st=0:d=0.35,fade=t=out:st={max(0, length - 0.35):.3f}:d=0.35"
    scale = f"scale={W}:{H}:flags=lanczos,setsar=1,fps={FPS}"
    if kind == 'vid':
        inp = ['-i', clip(name)]
        # Veo clips are 6 s: slow them down a touch if the scene needs more
        src_len = dur(clip(name)); slow = max(1.0, length / src_len)
        vf = f"setpts={slow:.4f}*PTS,{scale},tpad=stop_mode=clone:stop_duration=30,trim=0:{length:.3f},{fade}"
    else:
        inp = ['-framerate', str(FPS), '-i', os.path.join(work, 'frames', name, 'f%05d.jpg')]
        vf = f"{scale},tpad=stop_mode=clone:stop_duration=60,trim=0:{length:.3f},{fade}"
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *inp, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '18', '-pix_fmt', 'yuv420p', outp], check=True)

parts, audio_parts, t = [], [], 0.0
for i in range(1, 15):
    v = vo(i); vlen = dur(v)
    length = max(LEAD + vlen + TAIL, MIN_LEN.get(i, 0))
    fixed = sum(s for _, s in SCENES[i] if s is not None and s >= 1)
    rest = length - fixed
    for j, (src, share) in enumerate(SCENES[i]):
        seg = share if (share is not None and share >= 1) else (rest * share if share else None)
        if seg is None:
            used = sum(p[1] for p in parts if p[2] == i)
            seg = length - used
        p = os.path.join(tmp, f's{i:02d}_{j}.mp4')
        piece(src, seg, p)
        parts.append((p, seg, i))
    audio_parts.append((v, t + LEAD))
    t += length
    print(f'scene {i:2d}: {length:5.1f}s  (voice {vlen:4.1f}s)', flush=True)

with open(os.path.join(tmp, 'list.txt'), 'w') as f:
    for p, _, _ in parts: f.write(f"file '{p}'\n")
video = os.path.join(tmp, 'video.mp4')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'list.txt'), '-c', 'copy', video], check=True)
total = dur(video)

# narration track: each clip placed at its scene's start
args, chains = [], []
for k, (v, at) in enumerate(audio_parts):
    args += ['-i', v]
    ms = int(at * 1000)
    chains.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{k}]")
n = len(audio_parts)
fc = ';'.join(chains) + ';' + ''.join(f'[v{k}]' for k in range(n)) + f'amix=inputs={n}:normalize=0,apad,atrim=0:{total:.3f},loudnorm=I=-16:TP=-1.5[voice]'
if music:
    args += ['-stream_loop', '-1', '-i', music]
    fc += (f';[voice]asplit=2[vo1][vo2]'
           f';[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{total:.3f},volume=0.32,'
           f'afade=t=in:d=2,afade=t=out:st={total - 4:.3f}:d=4[mus]'
           f';[mus][vo2]sidechaincompress=threshold=0.03:ratio=8:attack=40:release=600[duck]'
           f';[vo1][duck]amix=inputs=2:normalize=0[mix]')
    outlabel = '[mix]'
else:
    outlabel = '[voice]'
audio = os.path.join(tmp, 'audio.m4a')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args, '-filter_complex', fc, '-map', outlabel, '-c:a', 'aac', '-b:a', '192k', audio], check=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], check=True)
print(f'done: {out}  {total:.1f}s')
