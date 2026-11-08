// Layout JSON -> AutoCAD DXF (R12 / AC1009 ASCII, the most widely readable flavour).
// Units are feet ($INSUNITS = 2). Plan y grows south, DXF y grows north, so y is flipped
// (Y = depth - y) and the drawing reads the same way as the on-screen plan, north up.
//
// Layers (AIA-style names):
//   A-WALL       wall centre lines drawn as 0.33 ft wide polylines, door gaps cut
//   A-DOOR       door leaves (lines) and 90 degree swing arcs
//   A-GLAZ       windows: two parallel glass lines plus jamb ticks
//   A-AREA       room outlines (closed polylines)
//   A-AREA-IDEN  room names, dimensions and areas (text)
//   A-FOOT       footprint outline and courtyard holes
//   A-ANNO-TTLB  title text and entrance marker
import type { Layout, Point } from "../types";
import { doorGeoms, extents, footprintRings, ftIn, roomArea, totalSqft, walls, windowSeg, WALL_THICKNESS_FT } from "./geometry";

const LAYERS: [name: string, aciColor: number][] = [
  ["A-WALL", 7], ["A-DOOR", 3], ["A-GLAZ", 5], ["A-AREA", 8], ["A-AREA-IDEN", 2], ["A-FOOT", 1], ["A-ANNO-TTLB", 7],
];

const num = (n: number) => {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? "0.0" : Number.isInteger(r) ? `${r}.0` : String(r);
};

/** DXF text: ASCII only; anything else becomes AutoCAD's \U+XXXX escape. */
const dxfText = (s: string) =>
  [...s].map((c) => {
    const cp = c.codePointAt(0)!;
    if (cp >= 32 && cp < 127) return c;
    return cp <= 0xffff ? `\\U+${cp.toString(16).toUpperCase().padStart(4, "0")}` : "?";
  }).join("");

class Dxf {
  private out: string[] = [];
  constructor(private depth: number) {}
  g(code: number, value: string | number) { this.out.push(String(code), typeof value === "number" ? num(value) : value); }
  private X = (p: Point) => p.x;
  private Y = (p: Point) => this.depth - p.y;

  line(layer: string, a: Point, b: Point) {
    this.g(0, "LINE"); this.g(8, layer);
    this.g(10, this.X(a)); this.g(20, this.Y(a)); this.g(30, 0);
    this.g(11, this.X(b)); this.g(21, this.Y(b)); this.g(31, 0);
  }

  polyline(layer: string, pts: Point[], closed: boolean, width = 0) {
    this.g(0, "POLYLINE"); this.g(8, layer); this.g(66, "1");
    this.g(10, 0); this.g(20, 0); this.g(30, 0);
    this.g(70, closed ? "1" : "0");
    if (width) { this.g(40, width); this.g(41, width); }
    for (const p of pts) {
      this.g(0, "VERTEX"); this.g(8, layer);
      this.g(10, this.X(p)); this.g(20, this.Y(p)); this.g(30, 0);
      if (width) { this.g(40, width); this.g(41, width); }
    }
    this.g(0, "SEQEND"); this.g(8, layer);
  }

  /** Quarter arc around `c` from point `a` to point `b` (both at distance r), the short way. */
  arc(layer: string, c: Point, r: number, a: Point, b: Point) {
    const ang = (p: Point) => (Math.atan2(this.Y(p) - this.Y(c), this.X(p) - this.X(c)) * 180) / Math.PI;
    let s = ang(a), e = ang(b);
    const ccw = (((e - s) % 360) + 360) % 360;
    if (ccw > 180) [s, e] = [e, s]; // DXF arcs run counter-clockwise from start to end
    const norm = (d: number) => ((d % 360) + 360) % 360;
    this.g(0, "ARC"); this.g(8, layer);
    this.g(10, this.X(c)); this.g(20, this.Y(c)); this.g(30, 0);
    this.g(40, r); this.g(50, norm(s)); this.g(51, norm(e));
  }

  circle(layer: string, c: Point, r: number) {
    this.g(0, "CIRCLE"); this.g(8, layer);
    this.g(10, this.X(c)); this.g(20, this.Y(c)); this.g(30, 0); this.g(40, r);
  }

  /** Text centred (horizontally and vertically) on `p`. */
  text(layer: string, p: Point, height: number, value: string) {
    this.g(0, "TEXT"); this.g(8, layer);
    this.g(10, this.X(p)); this.g(20, this.Y(p)); this.g(30, 0);
    this.g(40, height); this.g(1, dxfText(value));
    this.g(72, "1"); // centre
    this.g(11, this.X(p)); this.g(21, this.Y(p)); this.g(31, 0);
    this.g(73, "2"); // middle
  }

  toString() { return this.out.join("\n") + "\n"; }
}

export function layoutToDxf(layout: Layout, { title = "Walkthru floor plan" }: { title?: string } = {}): string {
  const D = layout.footprint.depth_ft;
  const ext = extents(layout);
  const d = new Dxf(D);

  // HEADER
  d.g(0, "SECTION"); d.g(2, "HEADER");
  d.g(9, "$ACADVER"); d.g(1, "AC1009");
  d.g(9, "$INSUNITS"); d.g(70, "2"); // feet
  d.g(9, "$EXTMIN"); d.g(10, ext.minX - 2); d.g(20, D - ext.maxY - 6); d.g(30, 0);
  d.g(9, "$EXTMAX"); d.g(10, ext.maxX + 2); d.g(20, D - ext.minY + 2); d.g(30, 0);
  d.g(0, "ENDSEC");

  // TABLES: linetype + layers
  d.g(0, "SECTION"); d.g(2, "TABLES");
  d.g(0, "TABLE"); d.g(2, "LTYPE"); d.g(70, "1");
  d.g(0, "LTYPE"); d.g(2, "CONTINUOUS"); d.g(70, "0"); d.g(3, "Solid line"); d.g(72, "65"); d.g(73, "0"); d.g(40, 0);
  d.g(0, "ENDTAB");
  d.g(0, "TABLE"); d.g(2, "LAYER"); d.g(70, String(LAYERS.length + 1));
  for (const [name, color] of [["0", 7] as [string, number], ...LAYERS]) {
    d.g(0, "LAYER"); d.g(2, name); d.g(70, "0"); d.g(62, String(color)); d.g(6, "CONTINUOUS");
  }
  d.g(0, "ENDTAB");
  d.g(0, "ENDSEC");

  // ENTITIES
  d.g(0, "SECTION"); d.g(2, "ENTITIES");

  const { outer, holes } = footprintRings(layout);
  d.polyline("A-FOOT", outer, true);
  for (const h of holes) d.polyline("A-FOOT", h, true);

  for (const r of layout.rooms) {
    d.polyline("A-AREA", [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], true);
    const h = Math.max(0.35, Math.min(1, r.w / 10, r.h / 5));
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    d.text("A-AREA-IDEN", { x: c.x, y: c.y - h * 1.1 }, h, r.name);
    d.text("A-AREA-IDEN", c, h * 0.7, `${ftIn(r.w)} x ${ftIn(r.h)}`);
    d.text("A-AREA-IDEN", { x: c.x, y: c.y + h * 1.0 }, h * 0.7, `${Math.round(roomArea(r))} SF`);
  }

  for (const s of walls(layout)) d.polyline("A-WALL", [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }], false, WALL_THICKNESS_FT);

  for (const g of doorGeoms(layout)) {
    if (g.opening) {
      // cased opening: jamb ticks across the wall at both ends
      const t2 = WALL_THICKNESS_FT / 2;
      for (const p of [g.hinge, g.jamb]) {
        d.line("A-DOOR", g.horizontal ? { x: p.x, y: p.y - t2 } : { x: p.x - t2, y: p.y }, g.horizontal ? { x: p.x, y: p.y + t2 } : { x: p.x + t2, y: p.y });
      }
      continue;
    }
    d.line("A-DOOR", g.hinge, g.leafEnd);
    d.arc("A-DOOR", g.hinge, g.radius, g.jamb, g.leafEnd);
  }

  const t = WALL_THICKNESS_FT / 2;
  for (const w of layout.windows) {
    const s = windowSeg(layout, w);
    if (!s) continue;
    const horiz = s.y1 === s.y2;
    const off = (k: number) => horiz
      ? [{ x: s.x1, y: s.y1 + k }, { x: s.x2, y: s.y2 + k }] as const
      : [{ x: s.x1 + k, y: s.y1 }, { x: s.x2 + k, y: s.y2 }] as const;
    for (const k of [-t * 0.45, t * 0.45]) { const [a, b] = off(k); d.line("A-GLAZ", a, b); }
    const [a0, b0] = off(-t), [a1, b1] = off(t);
    d.line("A-GLAZ", a0, a1); d.line("A-GLAZ", b0, b1);
  }

  d.circle("A-ANNO-TTLB", layout.entrance, 0.5);
  const sq = Math.round(totalSqft(layout)).toLocaleString("en-US");
  d.text("A-ANNO-TTLB", { x: (ext.minX + ext.maxX) / 2, y: ext.maxY + 3 }, 1.2, `${title} - ${sq} SF - units: feet`);

  d.g(0, "ENDSEC");
  d.g(0, "EOF");
  return d.toString();
}
