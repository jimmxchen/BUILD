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

// ---------- the Site model's floating island, as low-poly SVG ----------
// Colours from siteModelApp.js ISLAND_LOOK: grass, grassEdge, dirt, rock, rockDark, leaf.
const ISLE = { grass: "#b3cd96", edge: "#98b77c", dirt: "#cdb592", rock: "#b4a593", rockDark: "#8f8273", leaf: ["#8fb879", "#a5c78a", "#7aa766"], trunk: "#b39270" };
const N_RIM = 30;
function rand(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
const pt = (p: readonly [number, number]) => `${r2(p[0])},${r2(p[1])}`;

function Island({ W, D, entrance }: { W: number; D: number; entrance: { x: number; y: number } }) {
  const cx = W / 2, cy = D / 2, RX = W / 2 + 17, RY = D / 2 + 17;
  const rnd = rand(11);
  const rim = Array.from({ length: N_RIM }, (_, i) => {
    const t = (i / N_RIM) * Math.PI * 2, j = 0.93 + rnd() * 0.12;
    return [cx + RX * j * Math.cos(t), cy + RY * j * Math.sin(t)] as const;
  });
  const top = rim.map(([x, y]) => iso(x, y));
  const mid = rim.map(([x, y]) => iso(cx + (x - cx) * 0.6, cy + (y - cy) * 0.6, -15 - rnd() * 5));
  const apex = iso(cx + 4, cy + 2, -46);
  // underside facets, back to front
  const facets: { pts: string; fill: string; z: number }[] = [];
  for (let i = 0; i < N_RIM; i++) {
    const k = (i + 1) % N_RIM, t = (i / N_RIM) * Math.PI * 2;
    const shade = Math.cos(t - 2.4) * 0.5 + 0.5;
    const z = top[i][1] + top[k][1];
    facets.push({ pts: [top[i], top[k], mid[k], mid[i]].map(pt).join(" "), fill: shade > 0.55 ? ISLE.dirt : shade > 0.25 ? ISLE.rock : ISLE.rockDark, z });
    facets.push({ pts: [mid[i], mid[k], apex].map(pt).join(" "), fill: shade > 0.5 ? ISLE.rock : ISLE.rockDark, z: z - 40 });
  }
  facets.sort((a, b) => a.z - b.z);
  const capPts = top.map(pt).join(" ");
  const lipPts = top.map(([x, y]) => pt([x, y + 1.6])).join(" ");
  // stepping stones from the front door to the rim
  const stones = Array.from({ length: 6 }, (_, i) => ({ x: entrance.x + (i % 2 ? 0.5 : -0.4), y: entrance.y + 3 + i * 2.6 }));
  return (
    <g className="bl-isle">
      <g className="bl-isle-under">{facets.map((f, i) => <polygon key={i} points={f.pts} fill={f.fill} />)}</g>
      <polygon points={lipPts} fill={ISLE.edge} />
      <polygon points={capPts} fill={ISLE.grass} />
      <g transform={`matrix(${C} ${S} ${-C} ${S} 0 0)`} fill="#fbfaf7" stroke="#e2dfd8" strokeWidth={0.08}>
        {stones.map((s, i) => <ellipse key={i} cx={s.x} cy={s.y} rx={1.05} ry={0.85} />)}
      </g>
    </g>
  );
}

function Tree({ x, y, s = 1, i }: { x: number; y: number; s?: number; i: number }) {
  const [bx, by] = iso(x, y);
  const leaf = ISLE.leaf[i % 3], h = 3.2 * s, r = 1.9 * s;
  const crown = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 + 0.3; return [bx + Math.cos(a) * r, by - h - r * 0.9 + Math.sin(a) * r * 0.95] as const; });
  return (
    <g className="bl-isle-tree" style={{ ["--i" as string]: i }}>
      <ellipse cx={bx} cy={by} rx={1.6 * s} ry={0.8 * s} fill="rgba(70,90,50,.18)" />
      <line x1={bx} y1={by} x2={bx} y2={by - h} stroke={ISLE.trunk} strokeWidth={0.45 * s} />
      <polygon points={crown.map(pt).join(" ")} fill={leaf} />
      <polygon points={[crown[3], crown[4], crown[5], crown[0]].map(pt).join(" ")} fill="rgba(255,255,255,.18)" />
    </g>
  );
}

export function IsoHouse({ layout, title, island = false }: { layout: Layout; title: string; island?: boolean }) {
  const { width_ft: W, depth_ft: D } = layout.footprint;
  const ps = pieces(layout);
  let minX = iso(0, D)[0] - 2, maxX = iso(W, 0)[0] + 3;
  let minY = -CUT - 1.5, maxY = iso(W, D)[1] + 4;
  if (island) {
    const RX = W / 2 + 17 * 1.06, RY = D / 2 + 17 * 1.06;
    const ext = Array.from({ length: 72 }, (_, i) => { const t = (i / 72) * Math.PI * 2; return iso(W / 2 + RX * Math.cos(t), D / 2 + RY * Math.sin(t)); });
    minX = Math.min(...ext.map((p) => p[0])) - 1; maxX = Math.max(...ext.map((p) => p[0])) + 1;
    minY = Math.min(...ext.map((p) => p[1])) - 6; maxY = iso(W / 2, D / 2, -48)[1];
  }
  const trees = island ? [
    { x: -8, y: 4, s: 1.1 }, { x: -6, y: 18, s: 0.8 }, { x: 8, y: -9, s: 1 }, { x: 40, y: -10, s: 0.9 },
    { x: 66, y: 4, s: 1.15 }, { x: 70, y: 20, s: 0.85 }, { x: 52, y: 37, s: 1 }, { x: 30, y: 40, s: 0.75 },
  ] : [];
  const behind = trees.filter((t) => t.x + t.y < W / 2 + D / 2), front = trees.filter((t) => t.x + t.y >= W / 2 + D / 2);
  const plane = `matrix(${C} ${S} ${-C} ${S} 0 0)`;
  return (
    <svg className="bl-iso" viewBox={`${r2(minX)} ${r2(minY)} ${r2(maxX - minX)} ${r2(maxY - minY)}`} role="img" aria-label={title}>
      <title>{title}</title>
      {island && <Island W={W} D={D} entrance={layout.entrance} />}
      {behind.map((t, i) => <Tree key={i} {...t} i={i} />)}
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
      {front.map((t, i) => <Tree key={i} {...t} i={i + 3} />)}
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
