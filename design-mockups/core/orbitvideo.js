// Browser half of the one-clip 360 orbit. Everything heavy happens here so the server route stays a
// thin, stateless Gemini proxy (Vercel functions cap request/response bodies at 4.5 MB and have no
// ffmpeg or writable disk):
//
//   1. encodeGuide: the 3D-model orbit frames -> a small H.264 mp4 (WebCodecs + mp4-muxer), ~1.5 MB
//   2. POST /api/orbit { video }      -> { file, size }   (server: Gemini Omni restyles it, 720p, ~60 s)
//   3. downloadOrbit: GET /api/orbit/video?f=&start=&end= in <4 MB slices -> the clip as a Blob
//   4. ringFrames: split the clip into frames and close the loop (the model rarely lands exactly
//      back on its first view: the ring starts FADE frames in and its last FADE frames cross-fade
//      into the clip's first FADE frames, so wrapping around is a soft blend, never a jump)
//
// In the Next app, swap the CDN import for the npm package (`npm i mp4-muxer`).
const MUXER_URL = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm";
const SLICE = 3 * 1024 * 1024; // under Vercel's 4.5 MB response cap

/**
 * Encode frames into an mp4. `render(each)` must call `each(canvas, i)` once per frame, synchronously
 * right after drawing it (a WebGL canvas is only readable in the same task as the draw).
 */
export async function encodeGuide(render, { width, height, fps = 24, bitrate = 1_500_000 }) {
  if (typeof VideoEncoder === "undefined") throw new Error("this browser can't encode video (WebCodecs)");
  const { Muxer, ArrayBufferTarget } = await import(/* webpackIgnore: true */ MUXER_URL);
  let codec = null;
  for (const c of ["avc1.4d0028", "avc1.42e028", "avc1.640028"]) {
    const s = await VideoEncoder.isConfigSupported({ codec: c, width, height, bitrate, framerate: fps }).catch(() => null);
    if (s?.supported) { codec = c; break; }
  }
  if (!codec) throw new Error("no H.264 encoder available");
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width, height, frameRate: fps }, fastStart: "in-memory" });
  let failure = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  enc.configure({ codec, width, height, bitrate, framerate: fps, avc: { format: "avc" } });
  const step = 1e6 / fps;
  render((canvas, i) => {
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
    enc.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();
  });
  await enc.flush();
  enc.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

/** Send the guide to Gemini Omni through our server; resolves when the clip exists (~60 s). */
export async function filmOrbit(guide, { signal } = {}) {
  const r = await fetch("/api/orbit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video: await toDataUrl(guide) }), signal });
  const job = await r.json().catch(() => ({}));
  if (!r.ok || !job.file) throw new Error(job.error || `orbit HTTP ${r.status}`);
  return job; // { file, size }
}

/** Fetch the finished clip in slices (4 at a time). */
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

/**
 * Split the clip into a looping frame ring: Image objects with blob: URLs (call `release(frames)`
 * when replacing them). `onProgress(f)` gets 0..1.
 */
export async function ringFrames(clip, { fps = 24, fade = 24, width = 1280, height = 720, onProgress } = {}) {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto";
  const url = URL.createObjectURL(clip);
  v.src = url;
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("the orbit clip would not decode")); });
  const total = Math.floor(v.duration * fps + 0.01);
  if (total < fade * 3) throw new Error("orbit clip too short");
  const seek = (i) => new Promise((res) => { v.onseeked = res; v.currentTime = Math.min(v.duration - 0.001, (i + 0.5) / fps); });
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext("2d");
  const head = [];
  for (let i = 0; i < fade; i++) { await seek(i); head.push(await createImageBitmap(v)); }
  const n = total - fade, frames = [];
  for (let j = 0; j < n; j++) {
    const i = fade + j, m = i - n; // m >= 0: inside the overlap with the clip's first frames
    await seek(i);
    g.globalAlpha = 1; g.drawImage(v, 0, 0, width, height);
    if (m >= 0) { g.globalAlpha = (m + 1) / (fade + 1); g.drawImage(head[m], 0, 0, width, height); }
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    const im = new Image(); im.src = URL.createObjectURL(blob); frames.push(im);
    if (onProgress && j % 12 === 0) onProgress(j / n);
  }
  head.forEach((b) => b.close());
  URL.revokeObjectURL(url);
  await Promise.all(frames.map((im) => im.decode()));
  return frames;
}

export const release = (frames) => frames?.forEach((im) => { if (im.src.startsWith("blob:")) URL.revokeObjectURL(im.src); });
