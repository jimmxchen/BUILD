// One-clip photoreal 360 orbit: { video: mp4 data URL } -> { file, size }. Ported from
// design-mockups/serve.mjs. The browser renders our 3D house (wearing the Gemini photos) orbiting
// once and encodes it as a small guide mp4 (src/build/orbitvideo.js); Gemini Omni repaints it
// photoreal in one call (~60 s, ~$1 at 720p) and leaves the clip as a Gemini file, which the
// browser pulls back in slices through /api/orbit/video. Stateless: no disk, no ffmpeg, and every
// body stays under Vercel's 4.5 MB cap.
import { GEMINI_KEY } from "@/lib/gemini";

export const maxDuration = 300;
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.1-flash";
const RESOLUTION = process.env.ORBIT_RESOLUTION || "720p"; // 720p ~$1.01 per 10 s; 360p ~$0.34 but soft
const LIMIT = 4.4 * 1024 * 1024;
const PROMPT =
  "Restyle this 10-second 3D architectural animation as a photorealistic architectural visualization of the same house. " +
  "Keep the camera motion exactly as in the video: one smooth orbit all the way around the house at constant speed, same height and distance, ending where it started. " +
  "Keep the house shape, size and position in the frame exactly as in the video. " +
  "Keep the house's siding, trim, roof, windows, doors and colors as shown, made photorealistic. Add a real green lawn, mature trees and softly out-of-focus neighboring houses, consistent all the way round, in late-afternoon light. " +
  "High detail and sharp focus on the house: crisp siding lines, trim, window frames and glass reflections, clean roof edges, true straight walls; stable, no flicker or shimmer. " +
  "Replace the plain gray backdrop and ground with that real yard and neighborhood. Nothing moves except the camera. No cuts, no zoom, no morphing, no people, no cars, no text.";

type Step = { content?: { type?: string; uri?: string }[] };

export async function POST(request: Request) {
  if (!GEMINI_KEY) return Response.json({ error: "No GEMINI_API_KEY" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > LIMIT) return Response.json({ error: "Guide video too large (keep it under 4 MB)" }, { status: 413 });
  let video: unknown;
  try { ({ video } = JSON.parse(raw)); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const m = typeof video === "string" ? video.match(/^data:video\/mp4;base64,(.+)$/) : null;
  if (!m) return Response.json({ error: "Expected { video: mp4 data URL }" }, { status: 400 });

  const t0 = Date.now();
  const r = await fetch(`${GEMINI}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(285_000),
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: "video", mime_type: "video/mp4", data: m[1] }, { type: "text", text: PROMPT }],
      response_format: { type: "video", resolution: RESOLUTION, aspect_ratio: "16:9", delivery: "uri" },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg: string = (Array.isArray(d) ? d[0] : d)?.error?.message || `Omni HTTP ${r.status}`;
    return Response.json({ error: r.status === 402 ? "Gemini prepaid credits are used up: top up in AI Studio" : msg }, { status: 502 });
  }
  const uri = ((d.steps ?? []) as Step[]).flatMap((s) => s.content ?? []).find((c) => c?.type === "video" && c.uri)?.uri;
  const file = uri?.match(/\/files\/([a-z0-9-]+):download/)?.[1];
  if (!file) return Response.json({ error: "Omni returned no video" }, { status: 502 });
  const head = await fetch(`${GEMINI}/files/${file}:download?alt=media`, { headers: { "x-goog-api-key": GEMINI_KEY, Range: "bytes=0-0" } });
  const size = Number(head.headers.get("content-range")?.split("/")[1]);
  await head.body?.cancel();
  if (!size) return Response.json({ error: "orbit clip has no size" }, { status: 502 });
  console.log(`orbit: ${d.usage?.total_output_tokens ?? "?"} output tokens, ${(size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return Response.json({ file, size });
}
