// Axonometric model of a Layout as plain SVG: server-rendered, no WebGL, no layout shift.
// Walls are cut at CUT ft (an architectural section) so the interior stays readable.
// Every wall face scales from its base with the CSS custom property --rise (0 = plan, 1 = model),
// so a single CSS animation turns the drawn plan into the model with no script at all.
import type { Layout } from "@/lib/types";
import { buildWalls } from "@/lib/walls";
import { ROOM_FILL } from "./data";
import { windowLines } from "./planGeometry";

const C = Math.cos(Math.PI / 6), S = 0.5;
const CUT = 5, SILL = 3;
const iso = (x: number, y: number, z = 0) => [(x - y) * C, (x + y) * S - z] as const;
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Piece { x0: number; x1: number; y0: number; y1: number; h: number; south: boolean; east: boolean; glass: boolean; key: number }

function pieces(layout: Layout): Piece[] {
  const out: Piece[] = [];
  const wins = windowLines(layout);
  for (const s of buildWalls(layout)) {
    const horizontal = s.y1 === s.y2;
    const t = (s.exterior ? 0.5 : 0.33) / 2;
    const a0 = horizontal ? s.x1 : s.y1, b0 = horizontal ? s.x2 : s.y2, line = horizontal ? s.y1 : s.x1;
    const n = Math.max(1, Math.round(b0 - a0));
    const step = (b0 - a0) / n;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * step, b = a + step, mid = (a + b) / 2;
      const glass = wins.some((w) => w.horizontal === horizontal && Math.abs(w.line - line) < 0.01 && mid > w.a && mid < w.b);
      const ea = i === 0 ? a - t : a, eb = i === n - 1 ? b + t : b + 0.02; // tiny overlap hides AA seams
      const [x0, x1, y0, y1] = horizontal ? [ea, eb, line - t, line + t] : [line - t, line + t, ea, eb];
      out.push({
        x0, x1, y0, y1, h: glass ? SILL : CUT, glass,
        south: horizontal || i === n - 1, east: !horizontal || i === n - 1,
        key: (x0 + x1) / 2 + (y0 + y1) / 2,
      });
    }
  }
  return out.sort((p, q) => p.key - q.key);
}

export function IsoHouse({ layout, title }: { layout: Layout; title: string }) {
  const { width_ft: W, depth_ft: D } = layout.footprint;
  const ps = pieces(layout);
  const minX = iso(0, D)[0] - 2, maxX = iso(W, 0)[0] + 3;
  const minY = -CUT - 1.5, maxY = iso(W, D)[1] + 4;
  const plane = `matrix(${C} ${S} ${-C} ${S} 0 0)`;
  return (
    <svg className="bl-iso" viewBox={`${r2(minX)} ${r2(minY)} ${r2(maxX - minX)} ${r2(maxY - minY)}`} role="img" aria-label={title}>
      <title>{title}</title>
      {/* ground shadow + slab */}
      <g transform={plane}>
        <rect className="bl-iso-shadow" x={-1.2} y={-1.2} width={W + 4} height={D + 4} rx={0.6} />
        <rect x={-0.4} y={-0.4} width={W + 0.8} height={D + 0.8} fill="#fbfaf7" stroke="var(--line-strong)" strokeWidth={0.08} />
      </g>
      <g className="bl-iso-floors" transform={plane}>
        {layout.rooms.map((r, i) => (
          <rect key={r.id} style={{ ["--i" as string]: i }} x={r.x + 0.05} y={r.y + 0.05} width={r.w - 0.1} height={r.h - 0.1} fill={ROOM_FILL[r.type] ?? "#eee"} />
        ))}
      </g>
      <g className="bl-iso-faces">
        {ps.map((p, i) => {
          const so = iso(p.x0, p.y1), eo = iso(p.x1, p.y0);
          return (
            <g key={i}>
              {p.glass && p.south && <g transform={`matrix(${C} ${S} 0 -1 ${r2(so[0])} ${r2(so[1])})`}><rect className="bl-iso-glass" x={0} y={SILL} width={r2(p.x1 - p.x0)} height={CUT - SILL} /></g>}
              {p.glass && p.east && <g transform={`matrix(${-C} ${S} 0 -1 ${r2(eo[0])} ${r2(eo[1])})`}><rect className="bl-iso-glass" x={0} y={SILL} width={r2(p.y1 - p.y0)} height={CUT - SILL} /></g>}
              {p.south && <g transform={`matrix(${C} ${S} 0 -1 ${r2(so[0])} ${r2(so[1])})`}><rect className="bl-iso-face bl-iso-s" width={r2(p.x1 - p.x0)} height={p.h} /></g>}
              {p.east && <g transform={`matrix(${-C} ${S} 0 -1 ${r2(eo[0])} ${r2(eo[1])})`}><rect className="bl-iso-face bl-iso-e" width={r2(p.y1 - p.y0)} height={p.h} /></g>}
              {/* section-cut poché on top of each piece: at --rise 0 these read as the drawn plan */}
              <g className={p.glass ? "bl-iso-cap bl-iso-cap-sill" : "bl-iso-cap"}><g transform={plane}>
                <rect x={r2(p.x0)} y={r2(p.y0)} width={r2(p.x1 - p.x0)} height={r2(p.y1 - p.y0)} />
              </g></g>
            </g>
          );
        })}
      </g>
      <g className="bl-iso-tags">
        {layout.rooms.filter((r) => r.type !== "hall" && r.type !== "laundry").map((r, i) => {
          const [x, y] = iso(r.x + r.w / 2, r.y + r.h / 2);
          const w = r.name.length * 0.62 + 1.6;
          return (
            <g key={r.id} style={{ ["--i" as string]: i }} transform={`translate(${r2(x)} ${r2(y)})`}>
              <rect x={-w / 2} y={-1.05} width={w} height={2.1} rx={0.5} />
              <text y={0.42} textAnchor="middle">{r.name}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
