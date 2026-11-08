// Role 5 (shared with role 4): turn a Layout into wall segments with door gaps.
// Rooms tile on a GRID-ft lattice, so we cut every room edge into unit segments,
// dedupe shared walls, remove segments a door opening covers, then merge runs.
import type { Layout } from "./types";

export const GRID = 0.5;
export const WALL_THICKNESS_FT = 0.33;

export interface WallSeg { x1: number; y1: number; x2: number; y2: number; exterior: boolean; thickness?: number }

import { buildWallSegments } from "./wallTopology";

export function buildWalls(layout: Layout): WallSeg[] {
  return buildWallSegments(layout);
}

// Axis-aligned collision boxes in plan coords (role 5 collision uses these).
export interface Box { minX: number; maxX: number; minY: number; maxY: number }
export function wallBoxes(segs: WallSeg[]): Box[] {
  return segs.map((s) => {
    const t = (s.thickness ?? WALL_THICKNESS_FT) / 2;
    return ({
    minX: Math.min(s.x1, s.x2) - t, maxX: Math.max(s.x1, s.x2) + t,
    minY: Math.min(s.y1, s.y2) - t, maxY: Math.max(s.y1, s.y2) + t,
  }); });
}
