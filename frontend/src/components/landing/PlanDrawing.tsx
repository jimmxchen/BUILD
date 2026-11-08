// A drafted floor plan rendered straight from a Layout. Layers are separate groups so a parent can
// reveal them in construction order (footprint → rooms → walls → doors → windows → labels → dims)
// by setting data-stage on an ancestor. Without a stage every layer is visible (static, SSR-safe).
import type { Layout } from "@/lib/types";
import { ROOM_FILL, area, ftIn } from "./data";
import { planParts } from "./planGeometry";

export function PlanDrawing({
  layout, title, labels = true, dims = true, highlight, className, pad = 4.5, path,
}: {
  layout: Layout; title: string; labels?: boolean; dims?: boolean; highlight?: string | null;
  className?: string; pad?: number; path?: string;
}) {
  const { walls, windows, swings } = planParts(layout);
  const { width_ft: W, depth_ft: D } = layout.footprint;
  return (
    <svg className={`bl-plan ${className ?? ""}`} viewBox={`${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2}`} role="img" aria-label={title}>
      <title>{title}</title>
      <g className="bl-pl-footprint">
        <rect x={-0.17} y={-0.17} width={W + 0.34} height={D + 0.34} fill="none" stroke="currentColor" strokeWidth={0.12} strokeDasharray="0.8 0.5" />
      </g>
      <g className="bl-pl-rooms">
        {layout.rooms.map((r, i) => (
          <rect key={r.id} style={{ ["--i" as string]: i }} x={r.x} y={r.y} width={r.w} height={r.h}
            fill={highlight === r.id ? "var(--leaf-200)" : ROOM_FILL[r.type] ?? "#eee"} className={highlight === r.id ? "is-hl" : undefined} />
        ))}
      </g>
      <g className="bl-pl-walls" stroke="var(--ink)" strokeLinecap="square">
        {walls.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={s.exterior ? 0.55 : 0.33} pathLength={1} />
        ))}
      </g>
      <g className="bl-pl-doors" fill="none" stroke="var(--ink)" strokeWidth={0.09}>
        {swings.filter((s) => !s.wide).map((s, i) => {
          const r = s.opening.width_ft;
          return (
            <g key={i}>
              <line x1={s.hinge[0]} y1={s.hinge[1]} x2={s.leaf[0]} y2={s.leaf[1]} strokeWidth={0.14} />
              <path d={`M${s.leaf[0]} ${s.leaf[1]} A${r} ${r} 0 0 ${s.sweep} ${s.end[0]} ${s.end[1]}`} strokeDasharray="0.25 0.2" opacity={0.75} />
            </g>
          );
        })}
      </g>
      <g className="bl-pl-windows">
        {windows.map((w, i) => w.horizontal
          ? <g key={i}><rect x={w.a} y={w.line - 0.28} width={w.b - w.a} height={0.56} fill="#fff" stroke="var(--ink)" strokeWidth={0.07} /><line x1={w.a} y1={w.line} x2={w.b} y2={w.line} stroke="var(--glass)" strokeWidth={0.12} /></g>
          : <g key={i}><rect x={w.line - 0.28} y={w.a} width={0.56} height={w.b - w.a} fill="#fff" stroke="var(--ink)" strokeWidth={0.07} /><line x1={w.line} y1={w.a} x2={w.line} y2={w.b} stroke="var(--glass)" strokeWidth={0.12} /></g>)}
        <path d={`M${layout.entrance.x - 1} ${layout.entrance.y + 1.6} L${layout.entrance.x} ${layout.entrance.y + 0.7} L${layout.entrance.x + 1} ${layout.entrance.y + 1.6}`} fill="none" stroke="var(--leaf-700)" strokeWidth={0.22} strokeLinejoin="round" />
      </g>
      {labels && (
        <g className="bl-pl-labels" textAnchor="middle">
          {layout.rooms.filter((r) => r.type !== "hall").map((r) => {
            const vertical = r.w < 7 && r.h > r.w;
            const size = Math.min(1.05, Math.max(0.62, Math.min(r.w, r.h) / 7.5));
            return (
              <g key={r.id} transform={`translate(${r.x + r.w / 2} ${r.y + r.h / 2})${vertical ? " rotate(-90)" : ""}`}>
                <text y={-0.2} fontSize={size} fontWeight={600} fill="var(--ink)">{r.name}</text>
                <text y={size + 0.15} fontSize={size * 0.78} fill="var(--muted)" className="bl-num">{ftIn(r.w)} × {ftIn(r.h)} · {area(r)} ft²</text>
              </g>
            );
          })}
          <text x={layout.rooms.find((r) => r.type === "hall")!.x + 2} y={layout.rooms.find((r) => r.type === "hall")!.y + 2.3} fontSize={0.8} fill="var(--muted)" textAnchor="start">Hall</text>
        </g>
      )}
      {dims && (
        <g className="bl-pl-dims" stroke="var(--muted)" strokeWidth={0.06} fill="var(--muted)">
          <line x1={0} y1={-2.2} x2={W} y2={-2.2} />
          <line x1={0} y1={-2.9} x2={0} y2={-1.5} /><line x1={W} y1={-2.9} x2={W} y2={-1.5} />
          <line x1={-0.35} y1={-1.85} x2={0.35} y2={-2.55} strokeWidth={0.1} /><line x1={W - 0.35} y1={-1.85} x2={W + 0.35} y2={-2.55} strokeWidth={0.1} />
          <text x={W / 2} y={-2.6} fontSize={0.95} textAnchor="middle" stroke="none" className="bl-num">{ftIn(W)}–0″</text>
          <line x1={-2.2} y1={0} x2={-2.2} y2={D} />
          <line x1={-2.9} y1={0} x2={-1.5} y2={0} /><line x1={-2.9} y1={D} x2={-1.5} y2={D} />
          <line x1={-1.85} y1={0.35} x2={-2.55} y2={-0.35} strokeWidth={0.1} /><line x1={-1.85} y1={D + 0.35} x2={-2.55} y2={D - 0.35} strokeWidth={0.1} />
          <text transform={`translate(${-2.6} ${D / 2}) rotate(-90)`} fontSize={0.95} textAnchor="middle" stroke="none" className="bl-num">{ftIn(D)}–0″</text>
        </g>
      )}
      {path && <path className="bl-pl-path" d={path} fill="none" stroke="var(--leaf-700)" strokeWidth={0.28} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 0.7" />}
    </svg>
  );
}
