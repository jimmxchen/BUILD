"use client";
// Small client islands for the landing page. Everything here renders meaningful content on the
// server; motion is layered on after hydration and skipped under prefers-reduced-motion.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Layout, Room } from "@/lib/types";
import { Logo } from "./Logo";
import { APP_URL, EDITED_LAYOUT, EDIT_PROMPT, LAYOUT, ROOM_FILL, area, ftIn } from "./data";
import { PlanDrawing } from "./PlanDrawing";
import { planParts } from "./planGeometry";

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Marks [data-reveal] elements with data-inview once they enter the viewport. Content is visible
 *  without JS: the hidden pre-state only applies after this runs (.bl[data-motion="on"]). */
export function RevealObserver() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".bl");
    if (!root || reduced()) return;
    const els = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    const vh = window.innerHeight;
    for (const el of els) if (el.getBoundingClientRect().top < vh * 0.92) el.dataset.inview = "true";
    root.dataset.motion = "on";
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.inview = "true"; io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px" });
    els.filter((el) => !el.dataset.inview).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** Number that counts up once when scrolled into view. Server renders the final value. */
export function CountUp({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!inView || reduced()) return;
    let raf = 0; const t0 = performance.now(), dur = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      setShown(value * e);
      if (t < 1) raf = requestAnimationFrame(tick); else setShown(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className="bl-num">
      <span aria-hidden="true">{prefix}{fmt(shown ?? value)}{suffix}</span>
      <span className="bl-sr">{prefix}{fmt(value)}{suffix}</span>
    </span>
  );
}

/** Sticky nav that gains a solid surface after the hero, plus a small-screen menu. */
export function NavBar({ links }: { links: { href: string; label: string }[] }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`bl-nav ${solid ? "is-solid" : ""} ${open ? "is-open" : ""}`}>
      <a href="#top" className="bl-nav-logo" aria-label="BUILD home"><Logo size={24} /></a>
      <nav aria-label="Primary" id="bl-nav-links">
        {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
      </nav>
      <a className="bl-btn bl-btn-primary bl-btn-sm bl-nav-cta" href={APP_URL}>Try BUILD</a>
      <button type="button" className="bl-nav-toggle" aria-expanded={open} aria-controls="bl-nav-links" onClick={() => setOpen((o) => !o)}>
        <span className="bl-sr">{open ? "Close menu" : "Open menu"}</span>
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d={open ? "M5 5L15 15M15 5L5 15" : "M3 6H17M3 10H17M3 14H17"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </header>
  );
}

const STAGES = ["Footprint", "Rooms", "Walls", "Doors", "Windows", "Labels", "Dimensions"];
/** Step 02: the plan assembles in construction order when scrolled into view; stages are clickable. */
export function AssemblePlan() {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [stage, setStage] = useState(STAGES.length);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!inView || !auto || reduced()) return;
    let s = -1, id = 0;
    const step = () => { s += 1; setStage(s); if (s >= STAGES.length) window.clearInterval(id); };
    const first = requestAnimationFrame(step);
    id = window.setInterval(step, 520);
    return () => { cancelAnimationFrame(first); window.clearInterval(id); };
  }, [inView, auto]);
  return (
    <div className="bl-assemble" ref={ref} data-stage={stage}>
      <div className="bl-assemble-sheet">
        <PlanDrawing layout={LAYOUT} title="Floor plan generated from the brief, with room names and dimensions" />
      </div>
      <ol className="bl-assemble-steps" aria-label="Plan layers">
        {STAGES.map((s, i) => (
          <li key={s}>
            <button type="button" aria-pressed={stage > i} onClick={() => { setAuto(false); setStage(i + 1); }}>
              <span className="bl-num">{String(i + 1).padStart(2, "0")}</span>{s}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- step 03: before/after edit, rooms morph between two real solver outputs ----------
function lerpRoom(a: Room, b: Room, t: number): Room {
  return { ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}
function MorphPlan({ from, to, t }: { from: Layout; to: Layout; t: number }) {
  const W = Math.max(from.footprint.width_ft, to.footprint.width_ft), D = Math.max(from.footprint.depth_ft, to.footprint.depth_ft);
  const partsA = useMemo(() => planParts(from), [from]);
  const partsB = useMemo(() => planParts(to), [to]);
  const rooms = to.rooms.map((r) => lerpRoom(from.rooms.find((x) => x.id === r.id) ?? r, r, t));
  const pad = 3;
  return (
    <svg className="bl-plan bl-morph" viewBox={`${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2}`} role="img"
      aria-label={t < 0.5 ? "Plan before the edit" : "Plan after the edit: kitchen enlarged"}>
      {rooms.map((r) => <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.id === "kitchen" ? "var(--leaf-200)" : ROOM_FILL[r.type]} />)}
      {[partsA, partsB].map((parts, k) => (
        <g key={k} opacity={k === 0 ? 1 - t : t} stroke="var(--ink)" strokeLinecap="square">
          {parts.walls.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={s.exterior ? 0.55 : 0.33} />)}
        </g>
      ))}
      {rooms.filter((r) => r.type !== "hall").map((r) => {
        const vertical = r.w < 7 && r.h > r.w, size = Math.min(1.05, Math.max(0.6, Math.min(r.w, r.h) / 7.5));
        return (
          <g key={r.id} transform={`translate(${r.x + r.w / 2} ${r.y + r.h / 2})${vertical ? " rotate(-90)" : ""}`} textAnchor="middle">
            <text y={-0.15} fontSize={size} fontWeight={600} fill="var(--ink)">{r.name}</text>
            {r.id === "kitchen" && <text y={size + 0.2} fontSize={size * 0.8} fill="var(--leaf-800)" className="bl-num">{ftIn(r.w)} × {ftIn(r.h)} · {area(r)} ft²</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function EditCompare() {
  const [after, setAfter] = useState(false);
  const [t, setT] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const tRef = useRef(0);
  useEffect(() => { if (inView && !reduced()) { const id = window.setTimeout(() => setAfter(true), 900); return () => window.clearTimeout(id); } }, [inView]);
  useEffect(() => {
    const goal = after ? 1 : 0;
    let raf = 0;
    if (reduced()) { tRef.current = goal; raf = requestAnimationFrame(() => setT(goal)); return () => cancelAnimationFrame(raf); } const start = tRef.current, t0 = performance.now(), dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      tRef.current = start + (goal - start) * e; setT(tRef.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [after]);
  const kA = LAYOUT.rooms.find((r) => r.id === "kitchen")!, kB = EDITED_LAYOUT.rooms.find((r) => r.id === "kitchen")!;
  const passA = LAYOUT.checks.filter((c) => c.pass).length, passB = EDITED_LAYOUT.checks.filter((c) => c.pass).length;
  return (
    <div className="bl-edit" ref={ref}>
      <div className="bl-edit-bar">
        <span className="bl-edit-msg">{EDIT_PROMPT}</span>
        <div className="bl-seg" role="group" aria-label="Show plan">
          <button type="button" aria-pressed={!after} onClick={() => setAfter(false)}>Before</button>
          <button type="button" aria-pressed={after} onClick={() => setAfter(true)}>After</button>
        </div>
      </div>
      <div className="bl-edit-sheet"><MorphPlan from={LAYOUT} to={EDITED_LAYOUT} t={t} /></div>
      <dl className="bl-edit-facts">
        <div><dt>Kitchen</dt><dd className="bl-num">{ftIn(kA.w)} × {ftIn(kA.h)} → {ftIn(kB.w)} × {ftIn(kB.h)}</dd></div>
        <div><dt>Area</dt><dd className="bl-num">{area(kA)} → {area(kB)} ft²</dd></div>
        <div><dt>Rule checks</dt><dd className="bl-num">{after ? passB : passA} of {LAYOUT.checks.length} pass</dd></div>
      </dl>
    </div>
  );
}

/** Problem 03: move one wall and watch both rooms' dimensions change. */
export function WallShift() {
  const [ref, inView] = useInView<HTMLDivElement>(0.6);
  const [moved, setMoved] = useState(false);
  useEffect(() => { if (inView && !reduced()) { const id = window.setTimeout(() => setMoved(true), 700); return () => window.clearTimeout(id); } }, [inView]);
  const x = moved ? 15 : 12;
  return (
    <div className="bl-shift" ref={ref}>
      <svg viewBox="-2 -3 30 21" role="img" aria-label={`Two rooms share a wall. Left room ${x} by 12 feet, right room ${24 - x} by 12 feet.`}>
        <rect x={0} y={0} width={24} height={12} fill="#fbfaf7" />
        <rect x={0} y={0} width={x} height={12} fill="var(--leaf-100)" className="bl-shift-a" />
        <rect x={0} y={0} width={24} height={12} fill="none" stroke="var(--ink)" strokeWidth={0.45} />
        <g className="bl-shift-wall" style={{ transform: `translateX(${x}px)` }}>
          <line x1={0} y1={0} x2={0} y2={4.5} stroke="var(--ink)" strokeWidth={0.32} />
          <line x1={0} y1={7.5} x2={0} y2={12} stroke="var(--ink)" strokeWidth={0.32} />
          <path d="M0 4.5 L2.8 4.9" stroke="var(--ink)" strokeWidth={0.12} />
        </g>
        <g className="bl-num" fontSize={1.1} textAnchor="middle" fill="var(--muted)">
          <text x={x / 2} y={-1.1} className="bl-shift-dim">{x}′–0″</text>
          <text x={x + (24 - x) / 2} y={-1.1} className="bl-shift-dim">{24 - x}′–0″</text>
          <text x={x / 2} y={6.4} fill="var(--ink)" fontWeight={600}>{x * 12} ft²</text>
          <text x={x + (24 - x) / 2} y={6.4} fill="var(--ink)" fontWeight={600}>{(24 - x) * 12} ft²</text>
        </g>
        <g stroke="var(--muted)" strokeWidth={0.06}>
          <line x1={0} y1={-0.8} x2={24} y2={-0.8} />
          <line x1={0} y1={-1.6} x2={0} y2={-0.2} /><line x1={24} y1={-1.6} x2={24} y2={-0.2} />
          <line className="bl-shift-tick" style={{ transform: `translateX(${x}px)` }} x1={0} y1={-1.6} x2={0} y2={-0.2} />
        </g>
        <text x={12} y={15.8} fontSize={1} textAnchor="middle" fill="var(--muted)">Door, furniture and circulation shift with it</text>
      </svg>
      <button type="button" className="bl-chipbtn" onClick={() => setMoved((m) => !m)}>{moved ? "Move the wall back" : "Move the wall 3 ft"}</button>
    </div>
  );
}

const SHOTS = [
  { key: "prompt", label: "Describe", src: "/landing/app-prompt.webp", alt: "BUILD start screen: a floating island model above a prompt box reading 3 bed, 2 bath, open kitchen, home office, about 1,800 sq ft.", note: "Start from a sentence. Example briefs sit under the prompt." },
  { key: "footprint", label: "Plan", src: "/landing/app-footprint.webp", alt: "BUILD planning the footprint: a 61 by 28 ft outline on the island with a room tray along the bottom.", note: "The planner fixes a footprint and a room program; the solver lays rooms out on a half-foot grid." },
  { key: "rules", label: "Validate", src: "/landing/app-rules.webp", alt: "BUILD checking layout rules: room outlines on the island and a list of passing rule checks on the right.", note: "Every layout runs through the rule checker before you see it. Failures go back to the planner in plain English." },
  { key: "walls", label: "Build", src: "/landing/app-walls.webp", alt: "BUILD raising walls with window openings and placing furniture room by room.", note: "Walls, openings and furniture are built from the validated layout." },
  { key: "result", label: "Explore", src: "/landing/app-result.webp", alt: "BUILD result: a furnished 3D model on the island with room labels and the design chat panel on the right.", note: "Orbit the model, read room sizes, and ask the design chat for changes." },
  { key: "plan", label: "Plan view", src: "/landing/app-plan.webp", alt: "BUILD plan view: the same house as a drafted floor plan with rulers, room names and dimensions.", note: "Switch to the drafted plan of the same model, with rulers, dimensions and a measure tool." },
  { key: "walk", label: "Walk", src: "/landing/app-walk.webp", alt: "BUILD walkthrough mode: first-person view of the living room with a minimap in the corner.", note: "Walk through at 5′6″ eye height, with a live minimap of where you are." },
];
export function Showcase() {
  const [i, setI] = useState(0);
  const shot = SHOTS[i];
  return (
    <div className="bl-show">
      <div className="bl-show-tabs" role="tablist" aria-label="BUILD app screens">
        {SHOTS.map((s, k) => (
          <button key={s.key} type="button" role="tab" id={`shot-tab-${s.key}`} aria-selected={k === i} aria-controls="shot-panel" onClick={() => setI(k)}>
            <span className="bl-num">{String(k + 1).padStart(2, "0")}</span>{s.label}
          </button>
        ))}
      </div>
      <figure className="bl-browser" id="shot-panel" role="tabpanel" aria-labelledby={`shot-tab-${shot.key}`}>
        <div className="bl-browser-bar" aria-hidden="true"><i /><i /><i /><span>BUILD</span></div>
        <div className="bl-browser-view">
          {SHOTS.map((s, k) => (
            <img key={s.key} src={s.src} alt={k === i ? s.alt : ""} aria-hidden={k !== i} width={1600} height={1000}
              loading={k === 0 ? "eager" : "lazy"} decoding="async" className={k === i ? "is-on" : ""} />
          ))}
        </div>
        <figcaption><span className="bl-num">{String(i + 1).padStart(2, "0")}</span> {shot.note}</figcaption>
      </figure>
    </div>
  );
}
