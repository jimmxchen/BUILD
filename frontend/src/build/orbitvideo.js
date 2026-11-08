// Browser half of the photoreal 360 orbit. Everything heavy happens here so the server route stays a
// thin, stateless Gemini proxy (Vercel functions cap request/response bodies at 4.5 MB and have no
// ffmpeg or writable disk).
//
// The orbit can be filmed as PARTS overlapping arcs at the same time. Measured 2026-11-08: one 10 s
// clip takes ~60 s at 360p or 720p; 4 parallel 3 s quarters took 36-45 s, but Omni drifts at each
// clip's start and end, so the overlaps don't line up and the joins show a double house. So PARTS
// is 1: one clip whose guide runs OVERLAP frames past 360 deg, so the loop closes by blending two
// films of the same views:
//
//   1. encodeGuides: one pass over the 3D-model orbit frames feeds PARTS H.264 encoders
//      (WebCodecs + mp4-muxer). Part q is frames [q*SEG, q*SEG + SEG + OVERLAP), wrapping round.
//   2. filmOrbit (x PARTS, in parallel): POST /api/orbit { video, seconds } -> { file, size }
//      (server: Gemini Omni restyles that arc photoreal, 720p)
//   3. downloadOrbit: GET /api/orbit/video?f=&start=&end= in <4 MB slices -> each clip as a Blob
//   4. joinRing: frame k of part q, cross-faded over the first OVERLAP frames with the end of part
//      q-1 (which filmed the same views). The guide is a closed loop, so the ring needs no extra
//      loop fix: the last part overlaps the first.
//
// mp4-muxer comes from npm (package.json).
const SLICE = 3 * 1024 * 1024; // under Vercel's 4.5 MB response cap

/** The orbit split: TOTAL guide frames, PARTS arcs of SEG frames, each filmed with OVERLAP extra. */
export const ORBIT = { TOTAL: 216, PARTS: 1, SEG: 216, OVERLAP: 24, FPS: 24 }; // (SEG + OVERLAP) / FPS = 10 s, Omni's max

/**
 * Encode the orbit into one mp4 per part. `render(each)` must call `each(canvas, i)` once per frame
 * (i = 0..total-1), synchronously right after drawing it: a WebGL canvas is only readable in the
 * same task as the draw.
 */
export async function encodeGuides(render, { width, height, fps = ORBIT.FPS, bitrate = 1_500_000, total = ORBIT.TOTAL, parts = ORBIT.PARTS, seg = ORBIT.SEG, overlap = ORBIT.OVERLAP } = {}) {
  if (typeof VideoEncoder === "undefined") throw new Error("this browser can't encode video (WebCodecs)");
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  let codec = null;
  for (const c of ["avc1.4d0028", "avc1.42e028", "avc1.640028"]) {
    const s = await VideoEncoder.isConfigSupported({ codec: c, width, height, bitrate, framerate: fps }).catch(() => null);
    if (s?.supported) { codec = c; break; }
  }
  if (!codec) throw new Error("no H.264 encoder available");
  let failure = null;
  const step = 1e6 / fps;
  const segs = Array.from({ length: parts }, (_, q) => {
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width, height, frameRate: fps }, fastStart: "in-memory" });
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
    enc.configure({ codec, width, height, bitrate, framerate: fps, avc: { format: "avc" } });
    return { start: q * seg, len: seg + overlap, muxer, enc, later: [] };
  });
  const put = (s, f, l) => { s.enc.encode(f, { keyFrame: l % fps === 0 }); f.close(); };
  render((canvas, i) => {
    const frame = new VideoFrame(canvas, { timestamp: 0 });
    for (const s of segs) {
      // a frame can belong to a part twice when the part runs past 360 deg back over its own start
      for (let l = (i - s.start + total) % total; l < s.len; l += total) {
        const f = new VideoFrame(frame, { timestamp: Math.round(l * step), duration: Math.round(step) });
        if (i < s.start || l >= total) s.later.push([f, l]); // wrapped tail: encode in order, after
        else put(s, f, l);
      }
    }
    frame.close();
  });
  return Promise.all(segs.map(async (s) => {
    for (const [f, l] of s.later.sort((x, y) => x[1] - y[1])) put(s, f, l);
    await s.enc.flush();
    s.enc.close();
    if (failure) throw failure;
    s.muxer.finalize();
    return new Blob([s.muxer.target.buffer], { type: "video/mp4" });
  }));
}

const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

/** Send one guide to Gemini Omni through our server; resolves when its clip exists. */
export async function filmOrbit(guide, { seconds, signal } = {}) {
  const r = await fetch("/api/orbit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video: await toDataUrl(guide), seconds }), signal });
  const job = await r.json().catch(() => ({}));
  if (!r.ok || !job.file) throw new Error(job.error || `orbit HTTP ${r.status}`);
  return job; // { file, size }
}

/** Fetch a finished clip in slices (4 at a time). */
export async function downloadOrbit({ file, size }, { signal } = {}) {
  const ranges = [];
  for (let s = 0; s < size; s += SLICE) ranges.push([s, Math.min(size, s + SLICE) - 1]);
  const parts = new Array(ranges.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, ranges.length) }, async () => {
    while (next < ranges.length) {
      const k = next++, [a, b] = ranges[k];
      const r = await fetch(`/api/orbit/video?f=${encodeURIComponent(file)}&start=${a}&end=${b}`, { signal });
      if (!r.ok) throw new Error(`orbit video HTTP ${r.status}`);
      parts[k] = await r.arrayBuffer();
    }
  }));
  return new Blob(parts, { type: "video/mp4" });
}

async function openClip(blob) {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto";
  v.src = URL.createObjectURL(blob);
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("an orbit clip would not decode")); });
  return v;
}

/**
 * Join the parts into one looping ring of SEG*PARTS frames: Image objects with blob: URLs (call
 * `release(frames)` when replacing them). `onProgress(f)` gets 0..1.
 */
export async function joinRing(clips, { fps = ORBIT.FPS, seg = ORBIT.SEG, overlap = ORBIT.OVERLAP, width = 1280, height = 720, onProgress } = {}) {
  const vids = await Promise.all(clips.map(openClip));
  try {
    const short = vids.find((v) => v.duration * fps < seg + overlap - 1.5);
    if (short) throw new Error(`an orbit clip came back too short (${short.duration.toFixed(1)} s)`);
    const seek = (v, k) => new Promise((res) => { v.onseeked = res; v.currentTime = Math.min(v.duration - 0.001, (k + 0.5) / fps); });
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const g = canvas.getContext("2d");
    const frames = [], P = vids.length, n = P * seg;
    for (let q = 0; q < P; q++) {
      const v = vids[q], prev = vids[(q + P - 1) % P];
      // the previous part's tail first (forward seeks only: jumping back and forth re-decodes)
      const tail = [];
      for (let k = 0; k < overlap; k++) { await seek(prev, seg + k); tail.push(await createImageBitmap(prev)); }
      for (let k = 0; k < seg; k++) {
        if (k < overlap) { // same view, filmed by both: fade from the previous part into this one
          g.globalAlpha = 1; g.drawImage(tail[k], 0, 0, width, height);
          await seek(v, k);
          g.globalAlpha = (k + 1) / (overlap + 1); g.drawImage(v, 0, 0, width, height);
          if (k === overlap - 1) tail.forEach((b) => b.close());
        } else {
          await seek(v, k);
          g.globalAlpha = 1; g.drawImage(v, 0, 0, width, height);
        }
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
        const im = new Image(); im.src = URL.createObjectURL(blob); frames.push(im);
        if (onProgress && frames.length % 12 === 0) onProgress(frames.length / n);
      }
    }
    await Promise.all(frames.map((im) => im.decode()));
    return frames;
  } finally {
    vids.forEach((v) => URL.revokeObjectURL(v.src));
  }
}

export const release = (frames) => frames?.forEach((im) => { if (im.src.startsWith("blob:")) URL.revokeObjectURL(im.src); });
