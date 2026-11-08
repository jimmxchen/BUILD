#!/usr/bin/env python3
"""Cut a cached demo spin from an Omni orbit clip into the frame ring the app plays.

Same ring as joinRing() in src/build/orbitvideo.js (PARTS = 1): SEG frames, and the first OVERLAP
frames cross-faded with the clip's tail (it films the same views past 360 deg), so the loop closes.

  python3 scripts/cut-demo-spin.py orbit.mp4 public/demo/<slug>/ --layout-key KEY --address "..."
Needs ffmpeg and Pillow.
"""
import argparse, json, os, subprocess, sys, tempfile
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("out")
ap.add_argument("--layout-key", required=True); ap.add_argument("--address", required=True)
ap.add_argument("--seg", type=int, default=216); ap.add_argument("--overlap", type=int, default=24)
ap.add_argument("--fps", type=int, default=24); ap.add_argument("--quality", type=int, default=82)
a = ap.parse_args()

with tempfile.TemporaryDirectory() as tmp:
    # one top-quality JPEG per source frame at the ring's fps and size (16:9, like the app's join);
    # JPEG rather than PNG keeps the temp set near 100 MB instead of 600
    subprocess.run(["ffmpeg", "-loglevel", "error", "-i", a.clip, "-vf", f"fps={a.fps},scale=1280:720",
                    "-q:v", "1", os.path.join(tmp, "s_%04d.jpg")], check=True)
    src = sorted(f for f in os.listdir(tmp) if f.startswith("s_"))
    need = a.seg + a.overlap
    if len(src) < need - 1: sys.exit(f"clip too short: {len(src)} frames, need {need}")
    get = lambda k: Image.open(os.path.join(tmp, src[min(k, len(src) - 1)])).convert("RGB")
    os.makedirs(a.out, exist_ok=True)
    for k in range(a.seg):
        im = get(k)
        if k < a.overlap:  # fade from the tail (same view) into the start
            im = Image.blend(get(a.seg + k), im, (k + 1) / (a.overlap + 1))
        im.save(os.path.join(a.out, f"f_{k:03d}.jpg"), quality=a.quality, optimize=True, progressive=True)

json.dump({"address": a.address, "layoutKey": a.layout_key, "frames": a.seg, "pattern": "f_%03d.jpg"},
          open(os.path.join(a.out, "meta.json"), "w"), indent=1)
print(f"wrote {a.seg} frames + meta.json to {a.out}")
