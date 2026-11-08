// Plan geometry shared by the DXF and PDF exports. Everything here is in plan coordinates
// (feet, origin = footprint top-left, x east, y south), straight from the layout JSON.
import type { Door, Layout, Point, Room, Window } from "../types";
import { buildWalls, WALL_THICKNESS_FT, type WallSeg } from "../walls";

export { WALL_THICKNESS_FT };
export type { WallSeg };

export interface Seg { x1: number; y1: number; x2: number; y2: number }

/** A door opening, resolved to its wall orientation and the side the leaf swings into. */
export interface DoorGeom {
  door: Door;
  horizontal: boolean; // opening lies on a horizontal (east-west) wall
  /** hinge point, the leaf's open end, and the closed end (other jamb) of the opening */
  hinge: Point; leafEnd: Point; jamb: Point;
  /** swing arc: centre = hinge, radius = width, from jamb to leafEnd */
  radius: number;
  /** wider than a single leaf: a cased opening, drawn without a leaf or swing */
  opening: boolean;
}

/** Openings wider than this are drawn as cased openings, not swinging doors. */
export const MAX_LEAF_FT = 4;

export const ftIn = (ft: number) => {
  let f = Math.floor(ft + 1e-9), i = Math.round((ft - f) * 12);
  if (i === 12) { f += 1; i = 0; }
  return i ? `${f}'-${i}"` : `${f}'-0"`;
};

export const roomArea = (r: Room) => r.w * r.h;

const inRoom = (layout: Layout, p: Point) =>
  layout.rooms.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);

/** Shoelace area of an orthogonal ring. */
const ringArea = (pts: Point[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

/**
 * Total heated area: the union of room rectangles (rooms never overlap in a checked plan, so
 * this is the sum), which CONTRACTS.md defines as the building area. Holes are courtyards and
 * are never covered by rooms, so they are already excluded.
 */
export function totalSqft(layout: Layout): number {
  return layout.rooms.reduce((s, r) => s + roomArea(r), 0);
}

/** Footprint boundary rings: the outline (or bounding rectangle) plus any courtyard holes. */
export function footprintRings(layout: Layout): { outer: Point[]; holes: Point[][] } {
  const { width_ft: W, depth_ft: D, outline, holes } = layout.footprint;
  const outer = outline && outline.length >= 3
    ? outline
    : [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }];
  return { outer, holes: (holes ?? []).filter((h) => h.length >= 3) };
}

export function footprintArea(layout: Layout): number {
  const { outer, holes } = footprintRings(layout);
  return ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0);
}

/**
 * Wall centre lines with door gaps already cut (same builder the 3D view uses). The site-model app
 * may add a client-side `open: [roomId, roomId][]` list (open-plan pairs with no wall between
 * them; not part of the layout contract): when present, those shared walls are left out too.
 */
export function walls(layout: Layout): WallSeg[] {
  const segs = buildWalls(layout);
  const open = (layout as Layout & { open?: unknown }).open;
  if (!Array.isArray(open) || !open.length) return segs;

  // shared edges of each open pair: { horizontal, line, a, b }
  const byId = new Map(layout.rooms.map((r) => [r.id, r]));
  const cuts: { horizontal: boolean; line: number; a: number; b: number }[] = [];
  const eq = (u: number, v: number) => Math.abs(u - v) < 1e-6;
  for (const pair of open) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const p = byId.get(String(pair[0])), q = byId.get(String(pair[1]));
    if (!p || !q) continue;
    for (const [r, o] of [[p, q], [q, p]] as const) {
      if (eq(r.y + r.h, o.y)) {
        const a = Math.max(r.x, o.x), b = Math.min(r.x + r.w, o.x + o.w);
        if (b > a) cuts.push({ horizontal: true, line: o.y, a, b });
      }
      if (eq(r.x + r.w, o.x)) {
        const a = Math.max(r.y, o.y), b = Math.min(r.y + r.h, o.y + o.h);
        if (b > a) cuts.push({ horizontal: false, line: o.x, a, b });
      }
    }
  }
  const out: WallSeg[] = [];
  for (const s of segs) {
    const horizontal = eq(s.y1, s.y2);
    const line = horizontal ? s.y1 : s.x1;
    let pieces: [number, number][] = [horizontal ? [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)] : [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)]];
    for (const c of cuts) {
      if (c.horizontal !== horizontal || !eq(c.line, line)) continue;
      pieces = pieces.flatMap(([a, b]): [number, number][] => {
        if (c.b <= a || c.a >= b) return [[a, b]];
        return ([[a, c.a], [c.b, b]] as [number, number][]).filter(([u, v]) => v - u > 1e-6);
      });
    }
    for (const [a, b] of pieces) {
      out.push(horizontal ? { ...s, x1: a, y1: line, x2: b, y2: line } : { ...s, x1: line, y1: a, x2: line, y2: b });
    }
  }
  return out;
}

/**
 * Is a door on a horizontal wall? Mirrors walls.ts: horizontal when some room's north or south
 * edge runs through the door centre.
 */
function doorHorizontal(layout: Layout, d: Door): boolean {
  const eps = 1e-6;
  return layout.rooms.some((r) =>
    (Math.abs(r.y - d.y) < eps || Math.abs(r.y + r.h - d.y) < eps) && d.x > r.x - eps && d.x < r.x + r.w + eps,
  );
}

export function doorGeoms(layout: Layout): DoorGeom[] {
  return layout.doors.map((door) => {
    const horizontal = doorHorizontal(layout, door);
    const half = door.width_ft / 2;
    // Swing into the room on the +side (south / east) if there is one, else the -side. For the
    // front door that is always the inside of the house.
    const probe = 0.75;
    const sign = horizontal
      ? (inRoom(layout, { x: door.x, y: door.y + probe }) ? 1 : -1)
      : (inRoom(layout, { x: door.x + probe, y: door.y }) ? 1 : -1);
    const hinge = horizontal ? { x: door.x - half, y: door.y } : { x: door.x, y: door.y - half };
    const jamb = horizontal ? { x: door.x + half, y: door.y } : { x: door.x, y: door.y + half };
    const leafEnd = horizontal
      ? { x: hinge.x, y: door.y + sign * door.width_ft }
      : { x: door.x + sign * door.width_ft, y: hinge.y };
    return { door, horizontal, hinge, leafEnd, jamb, radius: door.width_ft, opening: door.width_ft > MAX_LEAF_FT };
  });
}

/** A window as a segment on its room's wall. */
export function windowSeg(layout: Layout, w: Window): Seg | null {
  const r = layout.rooms.find((x) => x.id === w.room);
  if (!r) return null;
  if (w.wall === "north" || w.wall === "south") {
    const y = w.wall === "north" ? r.y : r.y + r.h;
    return { x1: r.x + w.offset_ft, y1: y, x2: r.x + w.offset_ft + w.width_ft, y2: y };
  }
  const x = w.wall === "west" ? r.x : r.x + r.w;
  return { x1: x, y1: r.y + w.offset_ft, x2: x, y2: r.y + w.offset_ft + w.width_ft };
}

/** Plan extents (feet) of everything drawn, so door swings outside the footprint still fit. */
export function extents(layout: Layout) {
  const { outer } = footprintRings(layout);
  let minX = 0, minY = 0, maxX = layout.footprint.width_ft, maxY = layout.footprint.depth_ft;
  for (const p of outer) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  for (const g of doorGeoms(layout)) for (const p of g.opening ? [g.jamb, g.hinge] : [g.leafEnd, g.jamb, g.hinge]) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
