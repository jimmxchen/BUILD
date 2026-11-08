// A slice of a finished orbit clip: ?f=<gemini file>&start=<byte>&end=<byte> -> video/mp4 bytes.
// The clip (~8 MB at 720p) is over Vercel's 4.5 MB response cap, so the browser fetches it in
// slices under 4 MB and joins them (src/build/orbitvideo.js). The Gemini key stays on the server.
import { GEMINI_KEY } from "@/lib/gemini";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!GEMINI_KEY) return Response.json({ error: "No GEMINI_API_KEY" }, { status: 503 });
  const sp = new URL(request.url).searchParams;
  const f = sp.get("f") ?? "", a = Number(sp.get("start")), b = Number(sp.get("end"));
  if (!/^[a-z0-9-]{4,64}$/.test(f) || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a || b - a >= 4 * 1024 * 1024) {
    return Response.json({ error: "Expected ?f=<file>&start=<byte>&end=<byte> (under 4 MB)" }, { status: 400 });
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${f}:download?alt=media`, {
    headers: { "x-goog-api-key": GEMINI_KEY, Range: `bytes=${a}-${b}` },
  });
  if (!r.ok) return Response.json({ error: `Gemini file HTTP ${r.status}` }, { status: 502 });
  const buf = await r.arrayBuffer();
  return new Response(buf, { headers: { "Content-Type": "video/mp4", "Cache-Control": "private, max-age=86400" } });
}
