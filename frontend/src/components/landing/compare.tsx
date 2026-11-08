"use client";
// Same brief, three tools. ChatGPT and Claude are shown as their floor plans (from
// comparison/standalone-ai-3d, copied into public/compare), small and quiet; BUILD is the live,
// furnished model from the app engine, with the facts that set it apart.
import { useState } from "react";
import type { Layout } from "@/lib/types";
import { BuildModel } from "./BuildModel";

type View = "plan" | "3d";

/** A chatbot's result: its floor plan as generated, plus the one fact that matters. */
function ChatbotCard({ tool, src, alt, size }: { tool: string; src: string; alt: string; size: string }) {
  return (
    <figure className="bl-cmp-card is-bot">
      <header className="bl-cmp-head"><div><b>{tool}</b><span>{size}</span></div></header>
      <div className="bl-cmp-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
      </div>
      <figcaption className="bl-cmp-verdict"><span className="ic" aria-hidden="true">✕</span>A picture of a plan. Nothing checks it.</figcaption>
    </figure>
  );
}

export function ChatGPTCard() {
  return <ChatbotCard tool="ChatGPT" size="45 × 40 ft plan" src="/compare/house-plan-chatgpt.png" alt="ChatGPT's floor plan for the brief, 45 by 40 feet" />;
}

export function ClaudeCard() {
  return <ChatbotCard tool="Claude" size="60 × 30 ft plan" src="/compare/claude-plan-simple.jpg" alt="Claude's floor plan for the brief, 60 by 30 feet" />;
}

/** BUILD: the app engine building the solved layout, furniture and all; one model for both views. */
export function BuildCard({ layout, sqft }: { layout: Layout; sqft: number }) {
  const [view, setView] = useState<View>("3d");
  const passed = layout.checks.filter((c) => c.pass).length;
  return (
    <figure className="bl-cmp-card is-mine">
      <header className="bl-cmp-head">
        <div><b>BUILD</b><span>Our platform</span></div>
        <div className="bl-seg" role="group" aria-label="BUILD: view">
          {(["3d", "plan"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "plan" ? "Plan" : "3D"}</button>
          ))}
        </div>
      </header>
      <div className="bl-cmp-media">
        <BuildModel layout={layout} view={view} label={`BUILD's ${view === "plan" ? "floor plan" : "3D model"} of the brief, ${sqft.toLocaleString()} square feet, furnished`} />
      </div>
      <ul className="bl-cmp-stats" aria-label="What BUILD delivers from the brief">
        <li><b className="bl-num">{passed}/{layout.checks.length}</b>layout rules pass</li>
        <li><b className="bl-num">{sqft.toLocaleString()}</b>sq ft, measured</li>
        <li><b className="bl-num">{layout.rooms.length}</b>rooms, furnished</li>
        <li><b>Walkable</b>at eye height</li>
      </ul>
    </figure>
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
