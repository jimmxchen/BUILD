"use client";
// Same brief, three tools: ChatGPT and Claude (standalone scenes from comparison/standalone-ai-3d,
// copied into public/compare) next to BUILD's own plan. Each card flips between its plan and its
// 3D model; the 3D scenes and the walkthrough load only when asked, so the page stays light.
import { useRef, useState, type ReactNode } from "react";

type View = "plan" | "3d";

function Toggle({ view, setView, label }: { view: View; setView: (v: View) => void; label: string }) {
  return (
    <div className="bl-seg" role="group" aria-label={`${label}: view`}>
      {(["plan", "3d"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "plan" ? "Plan" : "3D"}</button>
      ))}
    </div>
  );
}

/** The tool's still render; click opens its own interactive scene in a large overlay. */
function Scene({ src, poster, title }: { src: string; poster: string; title: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [live, setLive] = useState(false);
  const open = () => { setLive(true); dlg.current?.showModal(); };
  return (
    <>
      <button type="button" className="bl-cmp-poster" onClick={open} aria-label={`Open ${title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" />
        <span className="bl-cmp-play">Rotate it yourself</span>
      </button>
      <dialog ref={dlg} className="bl-cmp-dialog" aria-label={title} onClose={() => setLive(false)}
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <div className="bl-cmp-dialog-bar"><b>{title}</b><button type="button" onClick={() => dlg.current?.close()}>Close ✕</button></div>
        {live && <iframe className="bl-cmp-frame" src={src} title={title} />}
      </dialog>
    </>
  );
}

export function CompareCard({ tool, tag, mine = false, plan, model, note }: {
  tool: string; tag: string; mine?: boolean; plan: ReactNode; model: ReactNode; note: string;
}) {
  const [view, setView] = useState<View>("plan");
  return (
    <figure className={`bl-cmp-card ${mine ? "is-mine" : ""}`}>
      <header className="bl-cmp-head">
        <div><b>{tool}</b><span>{tag}</span></div>
        <Toggle view={view} setView={setView} label={tool} />
      </header>
      <div className="bl-cmp-media" data-view={view}>{view === "plan" ? plan : model}</div>
      <figcaption className="bl-cmp-note">{note}</figcaption>
    </figure>
  );
}

export function ChatGPTCard() {
  return (
    <CompareCard
      tool="ChatGPT" tag="General chatbot"
      // eslint-disable-next-line @next/next/no-img-element
      plan={<img src="/compare/house-plan-chatgpt.png" alt="ChatGPT's floor plan: 45 by 40 feet" />}
      model={<Scene src="/compare/index-chatgpt.html" poster="/compare/chatgpt-house-3d-view.jpg" title="ChatGPT's 3D scene" />}
      note="A polished 45 × 40 ft concept with furniture and a room-size list. It is a picture of a plan: nothing checks doors, halls or room sizes."
    />
  );
}

export function ClaudeCard() {
  return (
    <CompareCard
      tool="Claude" tag="General chatbot"
      // eslint-disable-next-line @next/next/no-img-element
      plan={<img src="/compare/claude_house_plan_view.png" alt="Claude's floor plan: 60 by 30 feet" />}
      model={<Scene src="/compare/claude-house.html" poster="/compare/claude_house_elevated_view.png" title="Claude's 3D scene" />}
      note="A furnished 60 × 30 ft model with room sizes labeled. Also a one-off concept: nothing checks whether the layout works."
    />
  );
}

/** The photoreal 360° walkthrough (public/walkthrough), loaded on click. */
export function WalkthroughEmbed() {
  const [live, setLive] = useState(false);
  if (live) return <iframe className="bl-walk-frame" src="/walkthrough/index.html" title="Photoreal walkthrough of a BUILD house" allow="fullscreen" />;
  return (
    <button type="button" className="bl-walk-poster" onClick={() => setLive(true)} aria-label="Start the photoreal walkthrough">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/walkthrough/poster.jpg" alt="" />
      <span className="bl-cmp-play">Step inside</span>
    </button>
  );
}
