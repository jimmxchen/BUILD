// Dev server for the design mockups: static files + POST /api/render (photoreal shots).
//
//   node design-mockups/serve.mjs            -> http://localhost:3102
//
// /api/render takes { image: dataURL, prompt } and returns { image: dataURL } from Gemini's
// image-edit model. The Gemini key stays here on the server: set GEMINI_API_KEY in the
// environment or in design-mockups/.env.local (git-ignored). Optional GEMINI_IMAGE_MODEL.
// No dependencies (Node 18+).
import { createServer } from "node:http";
import { readFile, stat, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3102);

function loadEnvFile() {
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* optional */ }
}
loadEnvFile();
const KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
// Cheaper/faster model for the extra coverage views (sides, back).
const LITE_MODEL = process.env.GEMINI_IMAGE_MODEL_LITE || "gemini-3.1-flash-lite-image";
const MODELS = { main: MODEL, lite: LITE_MODEL };
// Seamless 360: Gemini Omni (video) fills the gap between each pair of neighboring photos.
// Billed per second of output video (~$0.10/s at 720p), so: short clips, one pass, cached on disk.
const OMNI_MODEL = process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.1-flash";
const OMNI_RES = process.env.SPIN_RESOLUTION || "720p";
// 3 s clips often stop short of the last frame; 5 s reliably reach it (10 s also cut more often).
const SPIN_SECONDS = Number(process.env.SPIN_SECONDS || 5);
const run = promisify(execFile);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const PRIVATE = new Set([".env.local", "serve.mjs"]);

async function readBody(req, limit = 12 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error("Request too large"); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function render(req, res) {
  if (!KEY) return send(res, 503, { error: "No GEMINI_API_KEY. Add it to design-mockups/.env.local and restart serve.mjs." });
  const { image, prompt, tier = "main", reference } = await readBody(req);
  const dataUrl = (u) => typeof u === "string" && u.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  const m = dataUrl(image), ref = reference ? dataUrl(reference) : null;
  if (!m || typeof prompt !== "string" || prompt.length > 4000 || !MODELS[tier] || (reference && !ref)) {
    return send(res, 400, { error: "Expected { image: data URL, prompt, tier?: 'main'|'lite', reference?: data URL }" });
  }
  const model = MODELS[tier];
  // Optional reference photo (an already-rendered view) keeps materials consistent across views.
  const reqParts = [{ inline_data: { mime_type: m[1], data: m[2] } }];
  if (ref) reqParts.push({ inline_data: { mime_type: ref[1], data: ref[2] } });
  reqParts.push({ text: prompt });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: reqParts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data.error?.message || `Gemini HTTP ${r.status}`;
    // Image models have a free-tier quota of 0: the key's project needs billing turned on.
    const friendly = /free_tier/.test(msg) ? "Gemini image models need billing enabled on this key's project (free tier = 0)." : msg;
    return send(res, 502, { error: friendly });
  }
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const img = parts.map((p) => p.inline_data || p.inlineData).find(Boolean);
  if (!img) {
    const why = data.candidates?.[0]?.finishReason || parts.map((p) => p.text).filter(Boolean).join(" ") || "no image returned";
    return send(res, 502, { error: `Gemini: ${why}` });
  }
  send(res, 200, { image: `data:${img.mime_type || img.mimeType};base64,${img.data}`, model });
}

// OpenStreetMap buildings + streets around a point, for orienting the house like its neighbors.
// Proxied (instead of called from the page) because the browser request queues behind hundreds
// of 3D-tile downloads; Node gets it in ~2 s. Cached per rounded location; two public mirrors.
const OSM_MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const osmCache = new Map();
async function osm(req, res, url) {
  const lat = Number(url.searchParams.get("lat")), lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return send(res, 400, { error: "lat/lon required" });
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (osmCache.has(key)) return send(res, 200, osmCache.get(key));
  const q = `[out:json][timeout:20];(way(around:150,${lat},${lon})["building"];way(around:120,${lat},${lon})["highway"]["highway"!~"footway|path|cycleway|steps|pedestrian|track|service|corridor|bridleway"];);out geom;`;
  // Race the Overpass mirrors (full neighborhood) against a quick Nominatim fallback (just the
  // lot's own building + the nearest street); take Overpass if it answers within ~5 s.
  const UA = { "User-Agent": "Walkthru-hackathon-demo/0.1" };
  const fallback = nominatimFallback(lat, lon, UA).catch((e) => ({ elements: [], source: "none", error: e.message })); // in parallel
  const overpass = Promise.any(OSM_MIRRORS.map(async (m) => {
    const r = await fetch(m, { method: "POST", body: new URLSearchParams({ data: q }), headers: UA, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d.elements?.length) throw new Error("empty");
    return { ...d, source: "overpass" };
  }));
  try {
    const data = await overpass;
    osmCache.set(key, data);
    return send(res, 200, data);
  } catch { /* fall through */ }
  const data = await fallback;
  if (!data.elements.length) return send(res, 502, { error: `OSM lookups failed${data.error ? `: ${data.error}` : ""}` });
  osmCache.set(key, data);
  send(res, 200, data);
}

/** Nominatim reverse geocoding with geometry: the building at the point and the nearest road,
 *  returned in Overpass's element shape so the client parses one format. */
async function nominatimFallback(lat, lon, headers) {
  const rev = async (zoom) => {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=${zoom}&polygon_geojson=1`;
    const r = await fetch(u, { headers, signal: AbortSignal.timeout(8000) });
    return r.ok ? r.json() : null;
  };
  const toPts = (coords) => coords.map(([x, y]) => ({ lat: y, lon: x }));
  const elements = [];
  const [bld, road] = [await rev(18), await rev(16)]; // sequential: Nominatim asks for <= 1 req/s
  const g = bld?.geojson;
  if (g && (bld.category === "building" || bld.addresstype === "building" || g.type === "Polygon")) {
    const ring = g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0][0] : null;
    if (ring) elements.push({ type: "way", tags: { building: "yes" }, geometry: toPts(ring) });
  }
  const rg = road?.geojson;
  if (rg && road.category === "highway") {
    const lines = rg.type === "LineString" ? [rg.coordinates] : rg.type === "MultiLineString" ? rg.coordinates : [];
    for (const l of lines) elements.push({ type: "way", tags: { highway: road.type || "road", name: road.name }, geometry: toPts(l) });
  }
  return { elements, source: "nominatim" };
}


// ---------------------------------------------------------------------------------------------
// POST /api/spin { frames: [N data URLs, in ring order], prompt? } -> { id, status }
// GET  /api/spin/<id> -> { status: running|done|error, done, total, n, error }
// Frames: /renders/spin/<id>/f_0001.jpg ... f_<n>.jpg, evenly spaced around the house.
// Clip k interpolates frame k -> frame k+1 (last wraps to 0). Each clip is re-timed so the camera
// moves at an even speed (models ease in/out at the ends, which would read as a stutter at every
// photo), its last frame is dropped (it is the next clip's first), and all clips are joined.
// Same photos -> same id -> served from disk, never paid for twice.
const SPIN_DIR = join(ROOT, "renders", "spin");
const spinJobs = new Map();
const PER_CLIP = 72; // output frames per clip after re-timing (3 s at 24 fps)

async function startSpin(req, res) {
  if (!KEY) return send(res, 503, { error: "No GEMINI_API_KEY" });
  const { frames, prompt = "" } = await readBody(req, 40 * 1024 * 1024);
  const ok = Array.isArray(frames) && frames.length >= 3 && frames.length <= 16 &&
    frames.every((f) => typeof f === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(f));
  if (!ok || typeof prompt !== "string" || prompt.length > 3000) return send(res, 400, { error: "Expected { frames: 3-16 data URLs, prompt? }" });
  const id = createHash("sha1").update(JSON.stringify([frames, prompt, OMNI_RES, OMNI_MODEL])).digest("hex").slice(0, 16);
  const dir = join(SPIN_DIR, id);
  if (existsSync(join(dir, "done.json"))) return send(res, 200, { id, ...JSON.parse(readFileSync(join(dir, "done.json"), "utf8")), status: "done" });
  if (!spinJobs.has(id) || spinJobs.get(id).status === "error") {
    const job = { status: "running", done: 0, total: frames.length, n: 0, error: null };
    spinJobs.set(id, job);
    buildSpin(id, dir, frames, prompt, job).catch((e) => { job.status = "error"; job.error = String(e.message || e); console.error("spin", id, e); });
  }
  send(res, 200, { id, ...spinJobs.get(id) });
}

function spinStatus(res, id) {
  if (!/^[0-9a-f]{16}$/.test(id)) return send(res, 400, { error: "bad id" });
  const doneFile = join(SPIN_DIR, id, "done.json");
  if (existsSync(doneFile)) return send(res, 200, { id, ...JSON.parse(readFileSync(doneFile, "utf8")), status: "done" });
  const job = spinJobs.get(id);
  send(res, job ? 200 : 404, job ? { id, ...job } : { error: "unknown spin" });
}

async function omniClip(first, last, prompt) {
  const part = (u) => { const m = u.match(/^data:(image\/\w+);base64,(.+)$/); return { type: "image", mime_type: m[1], data: m[2] }; };
  const body = {
    model: OMNI_MODEL,
    input: [part(first), part(last), { type: "text", text: prompt }],
    response_format: { type: "video", resolution: OMNI_RES, aspect_ratio: "16:9" },
  };
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (Array.isArray(d) ? d[0] : d)?.error?.message || `Omni HTTP ${r.status}`;
      lastErr = new Error(r.status === 402 ? "Gemini prepaid credits are used up: top up in AI Studio" : msg);
      if (r.status < 500 && r.status !== 429) break; // 4xx won't fix itself: don't pay for a retry
      continue;
    }
    const vid = [d.output_video, ...(d.steps ?? []).flatMap((s) => s.content ?? [])].find((c) => c?.data && /video/.test(c.mime_type ?? "video"));
    if (vid) { console.log(`omni: ${d.usage?.total_output_tokens ?? "?"} output tokens`); return Buffer.from(vid.data, "base64"); }
    lastErr = new Error("Omni returned no video");
  }
  throw lastErr;
}

async function sceneScores(file) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-i", file, "-vf", "scale=192:-1,select='gte(scene,0)',metadata=print", "-an", "-f", "null", "-"], { maxBuffer: 1 << 24 });
  return [...stderr.matchAll(/lavfi\.scene_score=([\d.]+)/g)].map((m) => Number(m[1]));
}
/** Largest single-frame change if it looks like a cut (a camera move spreads change over many frames). */
async function hardCut(file) {
  const v = await sceneScores(file);
  const m = Math.max(...v.slice(1));
  return m > 0.12 ? m : 0;
}
/** SSIM of the clip's last frame vs the photo it should end on (1 = same view). */
async function endMatch(file, anchor, dir) {
  const last = join(dir, "_last.png"), want = join(dir, "_want.img");
  await writeFile(want, Buffer.from(anchor.split(",")[1], "base64"));
  await run("ffmpeg", ["-loglevel", "error", "-y", "-sseof", "-0.1", "-i", file, "-frames:v", "1", "-update", "1", last]);
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-i", last, "-i", want, "-lavfi", "[0]scale=320:180[x];[1]scale=320:180[y];[x][y]ssim", "-f", "null", "-"]);
  await rm(last, { force: true }); await rm(want, { force: true });
  return Number(stderr.match(/All:([\d.]+)/)?.[1] ?? 0);
}

/** Fallback segment: cross-fade the two photos (the old behavior, for this gap only). */
async function blendClip(a, b, out, dir, k) {
  const save = async (u, name) => { const p = join(dir, name); await writeFile(p, Buffer.from(u.split(",")[1], "base64")); return p; };
  const pa = await save(a, `anchor_${k}_a.img`), pb = await save(b, `anchor_${k}_b.img`);
  await run("ffmpeg", ["-loglevel", "error", "-y", "-loop", "1", "-t", "3", "-i", pa, "-loop", "1", "-t", "3", "-i", pb,
    "-filter_complex", "[0]scale=1280:720,setsar=1,fps=24[x];[1]scale=1280:720,setsar=1,fps=24[y];[x][y]xfade=transition=fade:duration=2.9:offset=0.05,format=yuv420p",
    "-t", "3", out]);
  console.log(`spin clip ${k}: blended fallback`);
}

/** Per-frame motion (ffmpeg scene score) -> indices of PER_CLIP frames at even motion steps. */
async function evenSpeedIndices(file, count) {
  const raw = await sceneScores(file);
  // scores flicker frame to frame (codec), so smooth over ~1/3 s: we want the slow speed curve
  const scores = raw.map((_, j) => { let a = 0, c = 0; for (let k = Math.max(1, j - 4); k <= Math.min(raw.length - 1, j + 4); k++) { a += raw[k]; c++; } return c ? a / c : 0; });
  const n = Math.min(count, scores.length + 1);
  const cum = [0];
  for (let j = 1; j < n; j++) cum.push(cum[j - 1] + Math.max(scores[j] ?? 0, 1e-4)); // scores[j]: change from frame j-1 to j
  const total = cum[n - 1];
  const out = [];
  for (let t = 0; t < PER_CLIP; t++) { // t / PER_CLIP of the way: the clip's last frame belongs to the next clip
    const want = (t / PER_CLIP) * total;
    let j = 0; while (j < n - 1 && cum[j + 1] <= want) j++;
    out.push(j + 1 < n && want - cum[j] > cum[j + 1] - want ? j + 1 : j);
  }
  return out;
}

async function buildSpin(id, dir, frames, prompt, job) {
  await mkdir(dir, { recursive: true });
  const text = `A single continuous ${SPIN_SECONDS}-second drone shot with no cuts. The video is ${SPIN_SECONDS} seconds long. ` +
    "The first image is the FIRST frame and the second image is the LAST frame of this one continuous shot. " +
    "The camera orbits around the house at a constant speed, at the same height and distance the whole time, moving smoothly from the first view to the last view. " +
    "The house, yard, trees, sky and lighting stay exactly the same: a still afternoon, nothing moves except the camera. " +
    "The camera keeps moving the whole time and ends EXACTLY on the last image's view: never holds still, never jumps, never cuts to the last view. " +
    "No cuts, no zoom, no morphing, no people, no cars, no text." + (prompt ? ` ${prompt}` : "");
  const N = frames.length;
  const clips = new Array(N);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(N, 8) }, async () => {
    while (next < N) {
      const k = next++;
      const f = join(dir, `clip_${String(k).padStart(2, "0")}.mp4`);
      if (!existsSync(f)) {
        // The model sometimes holds the first view and then hard-cuts to the last one. That is
        // exactly the jump we are trying to remove: retry once, then fall back to a soft blend.
        for (let attempt = 0; attempt < 2 && !existsSync(f); attempt++) {
          const tmpClip = `${f}.try${attempt}.mp4`;
          await writeFile(tmpClip, await omniClip(frames[k], frames[(k + 1) % N], text));
          const cut = await hardCut(tmpClip);
          const end = cut ? 0 : await endMatch(tmpClip, frames[(k + 1) % N], dir);
          const good = !cut && end >= 0.7;
          console.log(`spin ${id} clip ${k}: ${cut ? `hard cut (${cut.toFixed(2)})` : `continuous, end match ${end.toFixed(2)}`}${good ? "" : " -> rejected"}`);
          if (good) await run("mv", [tmpClip, f]); else await rm(tmpClip);
        }
        if (!existsSync(f)) await blendClip(frames[k], frames[(k + 1) % N], f, dir, k);
      }
      clips[k] = f; job.done++;
    }
  }));
  // Re-time and join: frame files numbered around the whole ring.
  const tmp = join(dir, "tmp"); await mkdir(tmp, { recursive: true });
  let g = 0;
  for (const f of clips) {
    await rm(tmp, { recursive: true, force: true }); await mkdir(tmp);
    await run("ffmpeg", ["-loglevel", "error", "-i", f, "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720", "-q:v", "6", join(tmp, "s_%04d.jpg")]);
    const src = (await readdir(tmp)).filter((x) => x.endsWith(".jpg")).sort();
    for (const j of await evenSpeedIndices(f, src.length)) {
      g++;
      await writeFile(join(dir, `f_${String(g).padStart(4, "0")}.jpg`), await readFile(join(tmp, src[j])));
    }
  }
  await rm(tmp, { recursive: true, force: true });
  const meta = { n: g, total: N, done: N, clips: N, resolution: OMNI_RES };
  await writeFile(join(dir, "done.json"), JSON.stringify(meta));
  Object.assign(job, meta, { status: "done" });
  console.log(`spin ${id}: ${N} clips -> ${g} frames`);
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/render" && req.method === "POST") return await render(req, res);
    if (url.pathname === "/api/osm") return await osm(req, res, url);
    if (url.pathname === "/api/spin" && req.method === "POST") return await startSpin(req, res);
    if (url.pathname.startsWith("/api/spin/")) return spinStatus(res, url.pathname.slice(10));
    if (url.pathname === "/api/render/status") return send(res, 200, { ready: Boolean(KEY), model: MODEL, lite: LITE_MODEL, video: OMNI_MODEL });
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || PRIVATE.has(path.replace(/^\//, ""))) return send(res, 404, { error: "Not found" });
    if ((await stat(file)).isDirectory()) { res.writeHead(302, { Location: url.pathname + "/" }); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(file));
  } catch (e) {
    if (e.code === "ENOENT") return send(res, 404, { error: "Not found" });
    console.error(e); send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mockups on http://localhost:${PORT}  (render: ${KEY ? MODEL : "no GEMINI_API_KEY"})`);
});
