// Canonical wall topology shared by the active app, SVG plan and legacy R3F view.
// Backend walls carry ownership/openings. Legacy layouts derive equivalent spans.
const EPS = 0.01;
export function canonicalWalls(layout) {
  if (layout.walls?.length) return layout.walls;
  const walls = [];
  for (const horizontal of [true, false]) {
    const lines = new Map();
    for (const room of layout.rooms) {
      for (const line of horizontal ? [room.y, room.y + room.h] : [room.x, room.x + room.w]) {
        if (!lines.has(line)) lines.set(line, []);
        lines.get(line).push({ room: room.id, lo: horizontal ? room.x : room.y, hi: horizontal ? room.x + room.w : room.y + room.h });
      }
    }
    for (const [line, edges] of lines) {
      const cuts = [...new Set(edges.flatMap(e => [e.lo, e.hi]))].sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) {
        const lo = cuts[i - 1], hi = cuts[i], mid = (lo + hi) / 2;
        const rooms = edges.filter(e => e.lo < mid && e.hi > mid).map(e => e.room).sort();
        if (!rooms.length) continue;
        const open = [...(layout.open_connections ?? []), ...(layout.open ?? [])].some(pair => pair.length === rooms.length && pair.every(r => rooms.includes(r)));
        const openings = open ? [{ type: 'open', offset_ft: 0, width_ft: hi - lo, sill_ft: 0, head_ft: 100 }] : [];
        if (!open) for (const door of layout.doors ?? []) {
          const owners = door.between.filter(r => r !== 'exterior').sort();
          if (owners.length !== rooms.length || !owners.every((r, j) => r === rooms[j])) continue;
          const at = horizontal ? door.y : door.x, center = horizontal ? door.x : door.y;
          if (door.orientation && door.orientation !== (horizontal ? 'horizontal' : 'vertical')) continue;
          if (Math.abs(at - line) < EPS && center - door.width_ft / 2 >= lo - EPS && center + door.width_ft / 2 <= hi + EPS)
            openings.push({ type: door.kind ?? 'door', offset_ft: center - door.width_ft / 2 - lo, width_ft: door.width_ft, sill_ft: 0, head_ft: 7 });
        }
        walls.push({ id: `wall_${walls.length}`, x1: horizontal ? lo : line, y1: horizontal ? line : lo,
          x2: horizontal ? hi : line, y2: horizontal ? line : hi, orientation: horizontal ? 'horizontal' : 'vertical',
          exterior: rooms.length === 1, rooms, thickness_ft: rooms.length === 1 ? .5 : .375, openings });
      }
    }
  }
  return walls;
}

export function buildWallSegments(layout) {
  const segments = [];
  for (const wall of canonicalWalls(layout)) {
    const horizontal = wall.orientation === 'horizontal';
    const start = horizontal ? wall.x1 : wall.y1, end = horizontal ? wall.x2 : wall.y2;
    const gaps = wall.openings.filter(o => o.sill_ft === 0).map(o => [Math.max(start, start + o.offset_ft), Math.min(end, start + o.offset_ft + o.width_ft)]).sort((a, b) => a[0] - b[0]);
    const push = (lo, hi) => {
      if (hi - lo <= EPS) return;
      segments.push({ x1: horizontal ? lo : wall.x1, y1: horizontal ? wall.y1 : lo,
        x2: horizontal ? hi : wall.x2, y2: horizontal ? wall.y2 : hi, exterior: wall.exterior,
        roomId: wall.rooms[0] ?? null, roomIds: wall.rooms, thickness: wall.thickness_ft });
    };
    let cursor = start;
    for (const [lo, hi] of gaps) { push(cursor, lo); cursor = Math.max(cursor, hi); }
    push(cursor, end);
  }
  return segments;
}
