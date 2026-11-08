// Plan-drawing helpers built on the app's own wall builder (src/lib/walls.ts).
// Units: feet, origin top-left, x east, y south (docs/CONTRACTS.md).
import type { Door, Layout, Room } from "@/lib/types";
import { buildWalls, type WallSeg } from "@/lib/walls";

export interface WindowLine { horizontal: boolean; line: number; a: number; b: number; room: string }
export interface Swing { hinge: [number, number]; leaf: [number, number]; end: [number, number]; sweep: 0 | 1; opening: Door; wide: boolean }

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

export function windowLines(layout: Layout): WindowLine[] {
  return layout.windows.flatMap((w) => {
    const r = layout.rooms.find((x) => x.id === w.room);
    if (!r) return [];
    const horizontal = w.wall === "north" || w.wall === "south";
    const line = horizontal ? (w.wall === "north" ? r.y : r.y + r.h) : w.wall === "west" ? r.x : r.x + r.w;
    const a = (horizontal ? r.x : r.y) + w.offset_ft;
    return [{ horizontal, line, a, b: a + w.width_ft, room: w.room }];
  });
}

/** True when the door sits on a horizontal (east-west) wall. Mirrors walls.ts. */
export function doorIsHorizontal(layout: Layout, d: Door) {
  return layout.rooms.some((r) => (near(r.y, d.y) || near(r.y + r.h, d.y)) && d.x > r.x - 0.01 && d.x < r.x + r.w + 0.01)
    && !layout.rooms.some((r) => (near(r.x, d.x) || near(r.x + r.w, d.x)) && d.y > r.y + 0.01 && d.y < r.y + r.h - 0.01);
}

const contains = (r: Room, x: number, y: number) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

/** Door leaves + swing arcs. Openings wider than 4 ft are drawn as cased openings (no leaf). */
export function doorSwings(layout: Layout): Swing[] {
  return layout.doors.map((d) => {
    const horizontal = doorIsHorizontal(layout, d);
    const half = d.width_ft / 2;
    // swing into the room that is not the hall / outside
    const pref = d.between.find((id) => id !== "hall" && id !== "exterior") ?? d.between[0];
    const room = layout.rooms.find((r) => r.id === pref);
    let dir = 1;
    if (room) dir = horizontal ? (contains(room, d.x, d.y + 1) ? 1 : -1) : contains(room, d.x + 1, d.y) ? 1 : -1;
    if (d.between.includes("exterior")) {
      const inner = layout.rooms.find((r) => d.between.includes(r.id));
      if (inner) dir = horizontal ? (contains(inner, d.x, d.y + 1) ? 1 : -1) : contains(inner, d.x + 1, d.y) ? 1 : -1;
    }
    const hinge: [number, number] = horizontal ? [d.x - half, d.y] : [d.x, d.y - half];
    const leaf: [number, number] = horizontal ? [d.x - half, d.y + dir * d.width_ft] : [d.x + dir * d.width_ft, d.y - half];
    const end: [number, number] = horizontal ? [d.x + half, d.y] : [d.x, d.y + half];
    const sweep: 0 | 1 = horizontal ? (dir > 0 ? 0 : 1) : dir > 0 ? 1 : 0;
    return { hinge, leaf, end, sweep, opening: d, wide: d.width_ft > 4 };
  });
}

export function planParts(layout: Layout) {
  const walls: WallSeg[] = buildWalls(layout);
  return { walls, windows: windowLines(layout), swings: doorSwings(layout) };
}
