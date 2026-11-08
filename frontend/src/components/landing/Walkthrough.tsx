"use client";
// Signature section: a pinned, scroll-scrubbed walk from the blueprint into the house.
// Native scrolling only (no hijacking): the section is tall, its stage is position: sticky, and
// scroll position maps to route progress. Before WebGL is ready (or without it) the stage shows
// the blueprint as SVG, which is also scene 1, so the canvas fades in without a visual jump.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "@/lib/types";
import { LAYOUT, area, ftIn, neighbours } from "./data";
import { PlanDrawing } from "./PlanDrawing";
import { CHAPTERS, routePolyline } from "./walkPath";
import type { WalkScene, WalkView } from "./walkScene";

type Mode = "scroll" | "steps";
const STEP_P = [0.04, 0.3, 0.5, 0.7, 1];

function roomAt(x: number, y: number): Room | undefined {
  return LAYOUT.rooms.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

export function Walkthrough() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WalkScene | null>(null);
  const [mode, setMode] = useState<Mode>("scroll");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(false);
  const [view, setView] = useState<WalkView | null>(null);
  const [generation, setGeneration] = useState(0);
  const route = useMemo(() => routePolyline(), []);
  // static drawings: memoized so per-frame view updates don't rebuild them
  const blueprint = useMemo(() => <PlanDrawing layout={LAYOUT} title="Floor plan of the walkthrough house" className="bl-walk-blueprint" dims={false} />, []);
  const mini = useMemo(() => <PlanDrawing layout={LAYOUT} title="Minimap" labels={false} dims={false} pad={1.5} />, []);
  const endPlan = useMemo(() => <PlanDrawing layout={LAYOUT} title="Plan with the walked route traced" path={route} />, [route]);

  // reduced motion: no scroll scrubbing; discrete chapter buttons instead
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMode(mq.matches ? "steps" : "scroll");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // mount WebGL only when the section approaches the viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setNear(e.isIntersecting);
      sceneRef.current?.setActive(e.isIntersecting);
    }, { rootMargin: "100% 0px 100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // tell the scene how big the SVG blueprint is drawn, so the overhead camera matches it
  const fitPlan = useCallback(() => {
    const stage = stageRef.current, svg = stage?.querySelector<SVGSVGElement>(".bl-walk-blueprint");
    if (!stage || !svg || !sceneRef.current) return;
    const vb = svg.viewBox.baseVal, box = svg.getBoundingClientRect();
    const drawnW = Math.min(box.width, box.height * (vb.width / vb.height));
    sceneRef.current.setPlanFit((drawnW * (LAYOUT.footprint.width_ft / vb.width)) / stage.clientWidth);
  }, []);
  useEffect(() => {
    window.addEventListener("resize", fitPlan);
    return () => window.removeEventListener("resize", fitPlan);
  }, [fitPlan]);

  const progressFromScroll = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
  }, []);

  useEffect(() => {
    if (!near || failed || sceneRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) {
      const id = requestAnimationFrame(() => setFailed(true));
      return () => cancelAnimationFrame(id);
    }
    let cancelled = false;
    import("./walkScene").then(({ createWalkScene }) => {
      if (cancelled) return;
      try {
        const s = createWalkScene(stage, LAYOUT, {
          mobile: window.innerWidth < 760,
          onView: setView,
          onFirstFrame: () => setReady(true),
          onContextLost: () => { setReady(false); sceneRef.current?.dispose(); sceneRef.current = null; setGeneration((g) => g + 1); },
        });
        sceneRef.current = s;
        fitPlan();
        // start exactly where the page is (refresh mid-section): no sweep from 0
        s.setProgress(mode === "scroll" ? progressFromScroll() : progress, true);
      } catch {
        setFailed(true);
      }
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, failed, generation]);

  useEffect(() => () => { sceneRef.current?.dispose(); sceneRef.current = null; }, []);

  // scroll → progress
  useEffect(() => {
    if (mode !== "scroll") return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = progressFromScroll();
        setProgress(p);
        sceneRef.current?.setProgress(p);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [mode, progressFromScroll]);

  // returning to the tab: redraw once (some GPUs drop the back buffer while hidden)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") sceneRef.current?.setActive(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const chapterIndex = CHAPTERS.reduce((acc, c, i) => (progress >= c.at - 0.0001 ? i : acc), 0);
  const chapter = CHAPTERS[chapterIndex];
  const room = view && view.height < 9 && progress > 0.53 && progress < 0.95 ? roomAt(view.x, view.y) : undefined;
  const ending = progress > 0.95;

  const goTo = (i: number) => {
    if (mode === "steps") {
      setProgress(STEP_P[i]);
      sceneRef.current?.setProgress(STEP_P[i], true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * Math.min(0.999, CHAPTERS[i].at + 0.02), behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} id="explore" className={`bl-walk ${mode === "steps" ? "is-steps" : ""}`} aria-labelledby="walk-title">
      <div className="bl-walk-sticky">
        <div className="bl-walk-stage" ref={stageRef} data-ready={ready && !failed ? "true" : "false"}>
          <div className="bl-walk-poster" aria-hidden={ready && !failed}
            style={ready && !failed ? { opacity: 1 - Math.min(1, Math.max(0, (progress - 0.07) / 0.1)) } : undefined}>
            {failed
              ? <img src="/landing/app-walk.webp" alt="First-person view inside the BUILD 3D model: living room with sofa and dining table, minimap in the corner." width={1600} height={1000} />
              : blueprint}
          </div>
        </div>

        <div className="bl-walk-ui">
          <header className={`bl-walk-head ${progress > 0.24 ? "is-off" : ""}`}>
            <p className="bl-kicker"><span className="bl-kicker-dot" />Explore the walkthrough</p>
            <h2 id="walk-title">A floor plan is no longer something you look at. It’s somewhere you can go.</h2>
          </header>

          <div className="bl-walk-chapter" aria-live="polite">
            <div className="bl-walk-chapter-card" key={chapter.num}>
              <span className="bl-num bl-walk-chapter-num">{chapter.num} / 05</span>
              <h3>{chapter.title}</h3>
              <p>{chapter.body}</p>
            </div>
          </div>

          <nav className="bl-walk-rail" aria-label="Walkthrough chapters">
            <ol>
              {CHAPTERS.map((c, i) => (
                <li key={c.num}>
                  <button type="button" onClick={() => goTo(i)} aria-current={i === chapterIndex ? "step" : undefined}>
                    <span className="bl-num">{c.num}</span><span className="bl-walk-rail-label">{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="bl-walk-meter" aria-hidden="true"><span style={{ transform: `scaleY(${progress})` }} /></div>
          </nav>

          {room && (
            <div className="bl-walk-tag" key={room.id} role="status">
              <span className="bl-walk-tag-name">{room.name}</span>
              <span className="bl-num">{ftIn(room.w)} × {ftIn(room.h)} · {area(room)} ft²</span>
              <span className="bl-walk-tag-adj">Opens to {neighbours(LAYOUT, room.id).map((n) => n.name).join(", ") || "—"}</span>
            </div>
          )}

          <div className={`bl-walk-mini ${progress > 0.45 && !ending ? "is-on" : ""}`} aria-hidden="true">
            {mini}
            {view && (
              <svg className="bl-walk-mini-me" viewBox={`-1.5 -1.5 ${LAYOUT.footprint.width_ft + 3} ${LAYOUT.footprint.depth_ft + 3}`}>
                <g transform={`translate(${view.x} ${view.y}) rotate(${(view.heading * 180) / Math.PI})`}>
                  <path d="M0 -3.6 L-2.4 0.6 L2.4 0.6 Z" fill="var(--leaf-700)" opacity={0.35} />
                  <circle r={1} fill="var(--leaf-700)" stroke="#fff" strokeWidth={0.4} />
                </g>
              </svg>
            )}
          </div>

          <div className={`bl-walk-end ${ending ? "is-on" : ""}`} aria-hidden={!ending}>
            <div className="bl-walk-end-bar">
              <span className="bl-seg"><span>3D</span><span className="is-on">Plan</span></span>
              <span className="bl-num">Route · front door → hall · {LAYOUT.rooms.length} rooms · 61′ × 28′</span>
            </div>
            {endPlan}
          </div>

          {mode === "steps" && (
            <p className="bl-walk-note">Reduced motion is on: use the chapter list to move between views.</p>
          )}
        </div>
      </div>
    </section>
  );
}
