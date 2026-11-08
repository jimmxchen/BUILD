// Layout JSON -> one-page printable plan sheet (PDF 1.4, US Letter landscape), no dependencies.
// The plan is drawn as vectors at a true architectural scale (the largest of 1/4", 3/16", 1/8",
// 3/32", 1/16", 1/32" = 1'-0" that fits), with a scale bar, north arrow, room schedule and total
// square footage. An exterior photo (JPEG) can be placed in the title block.
import type { Layout, Point } from "../types";
import { doorGeoms, extents, footprintRings, ftIn, roomArea, totalSqft, walls, windowSeg, WALL_THICKNESS_FT } from "./geometry";

export interface JpegImage { bytes: Uint8Array; width: number; height: number }
export interface PdfOptions { title?: string; subtitle?: string; photo?: JpegImage | null; date?: Date }

// ---------- tiny PDF writer ----------

// Helvetica advance widths (1/1000 em) for ASCII 32..126 (WinAnsiEncoding).
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// Helvetica-Bold, same range.
const HELVB = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Keep Latin-1 (WinAnsi agrees with it for printable 0xA0-0xFF); anything else becomes '?'. */
const latin = (s: string) => [...s].map((c) => {
  const cp = c.codePointAt(0)!;
  return (cp >= 32 && cp < 127) || (cp >= 0xa0 && cp <= 0xff) ? c : "?";
}).join("");

export function textWidth(s: string, size: number, bold = false) {
  const t = bold ? HELVB : HELV;
  let w = 0;
  for (const c of latin(s)) { const cp = c.charCodeAt(0); w += cp >= 32 && cp < 127 ? t[cp - 32] : 556; }
  return (w / 1000) * size;
}

const esc = (s: string) => latin(s).replace(/[\\()]/g, (m) => `\\${m}`);
const n = (v: number) => (Math.round(v * 100) / 100).toString();

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;

class Page {
  ops: string[] = [];
  push(s: string) { this.ops.push(s); }
  stroke(c: Rgb) { this.push(`${c.map(n).join(" ")} RG`); }
  fill(c: Rgb) { this.push(`${c.map(n).join(" ")} rg`); }
  lw(w: number) { this.push(`${n(w)} w`); }
  cap(c: 0 | 1 | 2) { this.push(`${c} J`); }
  line(x1: number, y1: number, x2: number, y2: number) { this.push(`${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`); }
  rect(x: number, y: number, w: number, h: number, op: "S" | "f" | "B") { this.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${op}`); }
  poly(pts: [number, number][], op: "S" | "f" | "B" | "s") {
    this.push(pts.map(([x, y], i) => `${n(x)} ${n(y)} ${i ? "l" : "m"}`).join(" ") + (op === "S" ? " S" : ` h ${op === "s" ? "S" : op}`));
  }
  /** Quarter arc centred at (cx, cy) from angle a0 to a1 (radians, |a1-a0| <= pi/2) as one Bezier. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number) {
    const k = (4 / 3) * Math.tan((a1 - a0) / 4);
    const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p3 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const p1 = [p0[0] - k * r * Math.sin(a0), p0[1] + k * r * Math.cos(a0)];
    const p2 = [p3[0] + k * r * Math.sin(a1), p3[1] - k * r * Math.cos(a1)];
    this.push(`${n(p0[0])} ${n(p0[1])} m ${[p1, p2, p3].map((p) => `${n(p[0])} ${n(p[1])}`).join(" ")} c S`);
  }
  text(x: number, y: number, size: number, s: string, { bold = false, align = "left" as "left" | "center" | "right", color = [0, 0, 0] as Rgb } = {}) {
    const w = textWidth(s, size, bold);
    const dx = align === "center" ? -w / 2 : align === "right" ? -w : 0;
    this.push(`BT ${color.map(n).join(" ")} rg /${bold ? "F2" : "F1"} ${n(size)} Tf ${n(x + dx)} ${n(y)} Td (${esc(s)}) Tj ET`);
  }
  image(x: number, y: number, w: number, h: number) { this.push(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(y)} cm /Im1 Do Q`); }
}

function buildPdf(content: string, photo: JpegImage | null, pageW: number, pageH: number, info: { title: string }): Uint8Array {
  const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
  const chunks: Uint8Array[] = [];
  let len = 0;
  const offsets: number[] = [];
  const add = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc(b) : b; chunks.push(u); len += u.length; };
  const obj = (id: number, body: (Uint8Array | string)[]) => { offsets[id] = len; add(`${id} 0 obj\n`); body.forEach(add); add("\nendobj\n"); };

  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const xobj = photo ? " /XObject << /Im1 7 0 R >>" : "";
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  obj(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${xobj} >> /Contents 6 0 R >>`]);
  obj(4, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"]);
  obj(5, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"]);
  const body = enc(content);
  obj(6, [`<< /Length ${body.length} >>\nstream\n`, body, "\nendstream"]);
  let count = 7;
  if (photo) {
    obj(7, [`<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${photo.bytes.length} >>\nstream\n`, photo.bytes, "\nendstream"]);
    count = 8;
  }
  obj(count, [`<< /Title (${esc(info.title)}) /Producer (Walkthru) >>`]);
  const xref = len;
  add(`xref\n0 ${count + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= count; i++) add(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Size ${count + 1} /Root 1 0 R /Info ${count} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Read width/height from a baseline or progressive JPEG's SOF marker; null if not a JPEG. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
    const segLen = (b[i + 2] << 8) | b[i + 3];
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      if (b[i + 9] !== 3) return null; // only 3-channel (RGB/YCbCr) JPEGs are embedded as DeviceRGB
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + segLen;
  }
  return null;
}

// ---------- the plan sheet ----------

const FILL: Record<string, string> = {
  living: "#f3efe6", kitchen: "#fdf1d6", dining: "#f7e7d3", bedroom: "#e4ecf7",
  primary_bedroom: "#dbe5f5", bathroom: "#ddf1f0", office: "#ece6f5", laundry: "#eeeeee",
  hall: "#fafafa", entry: "#f3efe6", closet: "#eeeeee",
};

// Architectural scales, inches on paper per foot.
const SCALES: [inPerFt: number, label: string][] = [
  [1 / 4, '1/4" = 1\'-0"'], [3 / 16, '3/16" = 1\'-0"'], [1 / 8, '1/8" = 1\'-0"'],
  [3 / 32, '3/32" = 1\'-0"'], [1 / 16, '1/16" = 1\'-0"'], [1 / 32, '1/32" = 1\'-0"'],
];

const INK: Rgb = [0.1, 0.1, 0.11], MUTED: Rgb = [0.42, 0.42, 0.45], RULE: Rgb = [0.78, 0.78, 0.8], GLASS: Rgb = hex("#4a90d9");

export function layoutToPdf(layout: Layout, opts: PdfOptions = {}): Uint8Array {
  const PW = 792, PH = 612, M = 30; // Letter landscape, points
  const SIDE = 228; // title block column
  const title = opts.title ?? "Floor plan";
  const p = new Page();

  // sheet border + title block divider
  p.stroke(INK); p.lw(1.2); p.rect(M, M, PW - 2 * M, PH - 2 * M, "S");
  const sideX = PW - M - SIDE;
  p.lw(0.6); p.line(sideX, M, sideX, PH - M);

  // ---- plan area and scale ----
  const area = { x: M + 12, y: M + 50, w: sideX - M - 24, h: PH - 2 * M - 50 - 12 };
  const ext = extents(layout);
  const pad = 0.75; // ft, beyond the walls and door swings
  const spanX = ext.maxX - ext.minX + 2 * pad, spanY = ext.maxY - ext.minY + 2 * pad;
  const [inPerFt, scaleLabel] = SCALES.find(([s]) => spanX * s * 72 <= area.w && spanY * s * 72 <= area.h) ?? SCALES[SCALES.length - 1];
  const s = inPerFt * 72; // points per foot
  const ox = area.x + (area.w - spanX * s) / 2 + pad * s - ext.minX * s;
  const oyTop = area.y + area.h - (area.h - spanY * s) / 2 - pad * s + ext.minY * s;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oyTop - y * s;
  const P = (q: Point): [number, number] => [X(q.x), Y(q.y)];

  // footprint shadow + room fills
  const { outer, holes } = footprintRings(layout);
  p.fill([1, 1, 1]); p.poly(outer.map(P), "f");
  for (const r of layout.rooms) { p.fill(hex(FILL[r.type] ?? "#ffffff")); p.rect(X(r.x), Y(r.y + r.h), r.w * s, r.h * s, "f"); }
  for (const h of holes) { p.fill(hex("#e9efe4")); p.poly(h.map(P), "f"); }
  // room outlines (hairline)
  p.stroke(RULE); p.lw(0.3);
  for (const r of layout.rooms) p.rect(X(r.x), Y(r.y + r.h), r.w * s, r.h * s, "S");

  // walls at true thickness
  p.stroke(INK); p.cap(2); p.lw(Math.max(1.2, WALL_THICKNESS_FT * s));
  for (const w of walls(layout)) p.line(X(w.x1), Y(w.y1), X(w.x2), Y(w.y2));
  p.cap(0);

  // windows: knock out the wall, draw glass
  for (const w of layout.windows) {
    const g = windowSeg(layout, w);
    if (!g) continue;
    const t = Math.max(1.2, WALL_THICKNESS_FT * s) / 2;
    const horiz = g.y1 === g.y2;
    const [x1, y1, x2, y2] = [X(g.x1), Y(g.y1), X(g.x2), Y(g.y2)];
    p.fill([1, 1, 1]);
    if (horiz) p.rect(Math.min(x1, x2), y1 - t, Math.abs(x2 - x1), 2 * t, "f"); else p.rect(x1 - t, Math.min(y1, y2), 2 * t, Math.abs(y2 - y1), "f");
    p.stroke(GLASS); p.lw(0.5);
    if (horiz) { p.line(x1, y1 - t * 0.4, x2, y2 - t * 0.4); p.line(x1, y1 + t * 0.4, x2, y2 + t * 0.4); p.stroke(INK); p.line(x1, y1 - t, x1, y1 + t); p.line(x2, y2 - t, x2, y2 + t); }
    else { p.line(x1 - t * 0.4, y1, x2 - t * 0.4, y2); p.line(x1 + t * 0.4, y1, x2 + t * 0.4, y2); p.stroke(INK); p.line(x1 - t, y1, x1 + t, y1); p.line(x2 - t, y2, x2 + t, y2); }
  }

  // doors: leaf + swing
  for (const g of doorGeoms(layout)) {
    const [hx, hy] = P(g.hinge), [lx, ly] = P(g.leafEnd), [jx, jy] = P(g.jamb);
    if (g.opening) {
      const t = Math.max(1.2, WALL_THICKNESS_FT * s) / 2;
      p.stroke(INK); p.lw(0.6);
      for (const [x, y] of [[hx, hy], [jx, jy]]) {
        if (g.horizontal) p.line(x, y - t, x, y + t); else p.line(x - t, y, x + t, y);
      }
      continue;
    }
    p.stroke(INK); p.lw(0.6); p.line(hx, hy, lx, ly);
    p.stroke(MUTED); p.lw(0.35);
    const a0 = Math.atan2(jy - hy, jx - hx);
    let a1 = Math.atan2(ly - hy, lx - hx);
    if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; else if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    p.arc(hx, hy, g.radius * s, a0, a1);
  }

  // entrance marker
  const [ex, ey] = P(layout.entrance);
  p.fill(hex("#d9534f")); p.poly([[ex, ey - 7], [ex - 4, ey - 13], [ex + 4, ey - 13]], "f");

  // room labels, sized to fit the room
  for (const r of layout.rooms) {
    const cx = X(r.x + r.w / 2), cy = Y(r.y + r.h / 2), rw = r.w * s - 4, rh = r.h * s;
    const dims = `${ftIn(r.w)} x ${ftIn(r.h)}`;
    let fs = Math.min(8, rh / 3.6);
    while (fs > 3.5 && textWidth(r.name, fs, true) > rw) fs -= 0.25;
    const small = fs * 0.8;
    if (fs < 3.5 || rh < 10) continue; // too small to label legibly; it is in the schedule
    const showDims = textWidth(dims, small) <= rw && rh >= fs + small * 2.6;
    const showSf = showDims && rh >= fs + small * 4;
    const lines = 1 + (showDims ? 1 : 0) + (showSf ? 1 : 0);
    let y = cy + ((lines - 1) * small * 1.2) / 2 - fs * 0.35;
    p.text(cx, y, fs, r.name, { bold: true, align: "center", color: INK });
    if (showDims) { y -= small * 1.25; p.text(cx, y, small, dims, { align: "center", color: MUTED }); }
    if (showSf) { y -= small * 1.2; p.text(cx, y, small, `${Math.round(roomArea(r))} sf`, { align: "center", color: MUTED }); }
  }

  // ---- scale bar + north arrow (under the plan) ----
  const nice = [1, 2, 4, 5, 10, 20, 25, 50];
  const unit = nice.find((u) => u * s >= 22) ?? 50;
  const segs = 4, barY = M + 26, barX = area.x;
  p.lw(0.5); p.stroke(INK);
  for (let i = 0; i < segs; i++) { p.fill(i % 2 ? [1, 1, 1] : INK); p.rect(barX + i * unit * s, barY, unit * s, 5, "B"); }
  for (let i = 0; i <= segs; i++) p.text(barX + i * unit * s, barY - 9, 6.5, `${i * unit}'`, { align: "center", color: INK });
  p.text(barX + segs * unit * s + 10, barY - 0.5, 7.5, `SCALE  ${scaleLabel}`, { bold: true, color: INK });
  p.text(barX + segs * unit * s + 10, barY - 9.5, 6, "when printed at 100% on US Letter (11 x 8.5 in)", { color: MUTED });
  const nx = area.x + area.w - 14, ny = M + 22;
  p.fill(INK); p.poly([[nx, ny + 24], [nx - 6, ny + 6], [nx, ny + 10], [nx + 6, ny + 6]], "f");
  p.text(nx, ny - 4, 8, "N", { bold: true, align: "center", color: INK });

  // ---- title block ----
  const tx = sideX + 14, tw = SIDE - 28;
  let ty = PH - M - 14;
  if (opts.photo) {
    const ph = Math.min(150, (tw * opts.photo.height) / opts.photo.width);
    const pw = (ph * opts.photo.width) / opts.photo.height;
    ty -= ph;
    p.image(tx + (tw - pw) / 2, ty, pw, ph);
    ty -= 18;
  } else ty -= 10;
  p.text(tx, ty, 16, title, { bold: true, color: INK }); ty -= 14;
  if (opts.subtitle) { p.text(tx, ty, 7.5, opts.subtitle, { color: MUTED }); ty -= 12; }
  const total = Math.round(totalSqft(layout));
  ty -= 10;
  p.text(tx, ty, 22, `${total.toLocaleString("en-US")} sq ft`, { bold: true, color: INK }); ty -= 12;
  const bed = layout.rooms.filter((r) => r.type === "bedroom" || r.type === "primary_bedroom").length;
  const bath = layout.rooms.filter((r) => r.type === "bathroom").length;
  const fp = `${ftIn(layout.footprint.width_ft)} x ${ftIn(layout.footprint.depth_ft)} footprint`;
  p.text(tx, ty, 7.5, `${bed} bed  ·  ${bath} bath  ·  ${fp}`.replace(/·/g, "\xB7"), { color: MUTED }); ty -= 10;
  if (layout.requested_sqft) { p.text(tx, ty, 7.5, `Requested ${Math.round(layout.requested_sqft).toLocaleString("en-US")} sq ft`, { color: MUTED }); ty -= 10; }
  if (layout.checks.length) {
    const ok = layout.checks.filter((c) => c.pass).length;
    p.text(tx, ty, 7.5, `Layout rules: ${ok} of ${layout.checks.length} pass`, { color: MUTED }); ty -= 10;
  }

  // room schedule
  ty -= 10;
  p.text(tx, ty, 7, "ROOM", { bold: true, color: MUTED });
  p.text(tx + tw - 44, ty, 7, "SIZE", { bold: true, color: MUTED, align: "right" });
  p.text(tx + tw, ty, 7, "SQ FT", { bold: true, color: MUTED, align: "right" });
  ty -= 4; p.stroke(INK); p.lw(0.6); p.line(tx, ty, tx + tw, ty);
  const rooms = [...layout.rooms].sort((a, b) => roomArea(b) - roomArea(a));
  const rowH = Math.max(8, Math.min(12.5, (ty - (M + 40)) / (rooms.length + 1)));
  const fsRow = Math.min(7.5, rowH * 0.62);
  for (const r of rooms) {
    ty -= rowH;
    let name = r.name;
    if (textWidth(name, fsRow) > tw - 110) {
      while (name.length > 3 && textWidth(`${name}...`, fsRow) > tw - 110) name = name.slice(0, -1);
      name = `${name.trimEnd()}...`;
    }
    p.text(tx, ty + 2.5, fsRow, name, { color: INK });
    p.text(tx + tw - 44, ty + 2.5, fsRow, `${ftIn(r.w)} x ${ftIn(r.h)}`, { color: MUTED, align: "right" });
    p.text(tx + tw, ty + 2.5, fsRow, String(Math.round(roomArea(r))), { color: INK, align: "right" });
    p.stroke(RULE); p.lw(0.3); p.line(tx, ty, tx + tw, ty);
  }
  ty -= rowH;
  p.text(tx, ty + 2.5, fsRow, "Total", { bold: true, color: INK });
  p.text(tx + tw, ty + 2.5, fsRow, total.toLocaleString("en-US"), { bold: true, color: INK, align: "right" });

  // footer
  const date = (opts.date ?? new Date()).toISOString().slice(0, 10);
  p.stroke(INK); p.lw(0.6); p.line(sideX, M + 30, PW - M, M + 30);
  p.text(tx, M + 17, 9, "Walkthru", { bold: true, color: INK });
  p.text(tx + tw, M + 17, 7, `${date}  ·  Sheet A-101`.replace(/·/g, "\xB7"), { color: MUTED, align: "right" });
  p.text(tx, M + 8, 5.5, "Concept plan, not for construction. Dimensions in feet.", { color: MUTED });

  return buildPdf(p.ops.join("\n"), opts.photo ?? null, PW, PH, { title });
}
