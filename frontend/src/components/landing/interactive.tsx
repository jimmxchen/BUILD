"use client";
// Client islands for the landing page. Everything renders its final state on the server; motion is
// layered on after hydration and skipped under prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { LAYOUT, RULE_LABELS } from "./data";

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
export function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!inView || reduced()) return;
    let raf = 0; const t0 = performance.now(), dur = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      setShown(value * e);
      if (t < 1) raf = requestAnimationFrame(tick); else setShown(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  return (
    <span ref={ref} className="bl-num">
      <span aria-hidden="true">{prefix}{fmt(shown ?? value)}{suffix}</span>
      <span className="bl-sr">{prefix}{fmt(value)}{suffix}</span>
    </span>
  );
}

/** Right-edge section dots: shows where you are in the intro and jumps between sections. */
export function SectionDots({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0].id);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: "-45% 0px -45% 0px" });
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [sections]);
  return (
    <nav className="bl-dots" aria-label="Sections">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>
          <span className="bl-dots-label">{s.label}</span><i aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

// The app's own build stages (siteModelApp PHASES), as its stepper pills.
const STEPS = ["Reading your brief", "Planning rooms", "Placing walls", "Checking layout rules", "Raising the house", "Furnishing rooms"];

/** The demo's loading UI in miniature: stepper pills advance while the rule cards rise one by one. */
export function BuildSequence() {
  const [ref, inView] = useInView<HTMLDivElement>(0.45);
  const total = STEPS.length + LAYOUT.checks.length;
  const [tick, setTick] = useState(total); // server / reduced motion: finished state
  useEffect(() => {
    if (!inView || reduced()) return;
    let n = -1, id = 0;
    const step = () => { n += 1; setTick(n); if (n >= total) window.clearInterval(id); };
    const first = requestAnimationFrame(step);
    id = window.setInterval(step, 300);
    return () => { cancelAnimationFrame(first); window.clearInterval(id); };
  }, [inView, total]);
  const stepIdx = Math.min(STEPS.length - 1, Math.floor((tick / total) * STEPS.length));
  const rulesShown = Math.max(0, Math.min(LAYOUT.checks.length, tick - 2));
  const done = tick >= total;
  return (
    <div className="bl-seq" ref={ref}>
      <ol className="bl-stepper" aria-label="Build stages">
        {STEPS.map((s, i) => (
          <li key={s} className={done || i < stepIdx ? "done" : i === stepIdx ? "active" : ""}><i aria-hidden="true" />{s}</li>
        ))}
      </ol>
      <ul className="bl-rulelist" aria-label="Layout rule checks on the sample plan">
        {LAYOUT.checks.map((c, i) => (
          <li key={c.rule} className={`bl-rule ${i < rulesShown ? "is-in" : ""}`}>
            <span className="ic" aria-hidden="true">✓</span>{RULE_LABELS[c.rule] ?? c.rule}<span className="bl-sr">: {c.pass ? "pass" : "fail"}</span>
          </li>
        ))}
      </ul>
      <p className="bl-rulecount bl-num" aria-hidden="true">{rulesShown} of {LAYOUT.checks.length} rules pass</p>
    </div>
  );
}
