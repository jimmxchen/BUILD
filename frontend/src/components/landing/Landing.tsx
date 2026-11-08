// BUILD presentation intro: hero → problem → scale → solution → into the demo.
// Visual language is the Site model app's: sky gradient, cloud sea, the floating island,
// white rounded panels, 999px pills, its stepper pills and rule cards, Hanken Grotesk.
import { IsoHouse } from "./IsoHouse";
import { Logo } from "./Logo";
import { BuildSequence, CountUp, RevealObserver, SectionDots } from "./interactive";
import { ChatGPTCard, ClaudeCard, CompareCard, WalkthroughEmbed } from "./compare";
import { APP_URL, GITHUB_URL, LAYOUT, PROMPT, SCALE, totalArea } from "./data";

const SECTIONS = [
  { id: "intro", label: "BUILD" },
  { id: "problem", label: "The problem" },
  { id: "scale", label: "Who needs it" },
  { id: "solution", label: "Our solution" },
  { id: "compare", label: "vs. ChatGPT & Claude" },
  { id: "walk", label: "Walk through it" },
  { id: "demo", label: "Demo" },
];

// Same brief in all three tools. ChatGPT and Claude outputs: comparison/standalone-ai-3d.
const CMP_ROWS: { label: string; gpt: [boolean, string]; claude: [boolean, string]; build: [boolean, string] }[] = [
  { label: "Checked against layout rules", gpt: [false, "Not checked"], claude: [false, "Not checked"], build: [true, "9 rules, before you see it"] },
  { label: "Exact, measurable dimensions", gpt: [true, "Room-size list"], claude: [true, "Room labels"], build: [true, "Rulers, grid, tape measure"] },
  { label: "Walk through at eye height", gpt: [false, "Orbit a model"], claude: [false, "Orbit a model"], build: [true, "Eye-level, photoreal"] },
  { label: "Placed on your real lot", gpt: [false, "No"], claude: [false, "No"], build: [true, "Google 3D tiles, any address"] },
  { label: "Edits are re-checked", gpt: [false, "Re-prompt, unchecked"], claude: [false, "Re-prompt, unchecked"], build: [true, "Every change re-checked"] },
];

const Mark = ({ v }: { v: [boolean, string] }) => (
  <td className={v[0] ? "is-yes" : "is-no"}><span className="ic" aria-hidden="true">{v[0] ? "✓" : "✕"}</span><span className="bl-sr">{v[0] ? "Yes: " : "No: "}</span>{v[1]}</td>
);

const Arrow = () => (
  <svg className="bl-arrow" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8H13M9 4L13 8L9 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function Clouds({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`bl-clouds ${dense ? "is-dense" : ""}`} aria-hidden="true">
      <i style={{ left: "-6%", top: "58%", width: "38%" }} /><i style={{ left: "24%", top: "70%", width: "30%" }} />
      <i style={{ left: "58%", top: "62%", width: "36%" }} /><i style={{ left: "82%", top: "48%", width: "28%" }} />
      <i style={{ left: "6%", top: "14%", width: "18%", opacity: 0.55 }} /><i style={{ left: "74%", top: "10%", width: "20%", opacity: 0.5 }} />
    </div>
  );
}

export default function Landing() {
  const sqft = Math.round(totalArea(LAYOUT));
  return (
    <div className="bl" id="top">
      <a className="bl-skip" href="#main">Skip to content</a>
      <RevealObserver />
      <header className="bl-nav">
        <a href="#intro" className="bl-nav-logo" aria-label="BUILD, back to top"><Logo size={26} /></a>
        <a className="bl-ghost" href={APP_URL}>Open the demo</a>
      </header>
      <SectionDots sections={SECTIONS} />

      <main id="main">
        {/* ---------------- HERO ---------------- */}
        <section className="bl-hero bl-screen" id="intro" aria-labelledby="hero-title">
          <Clouds />
          <div className="bl-hero-model">
            <IsoHouse island layout={LAYOUT} title={`A generated three-bedroom house, ${sqft.toLocaleString()} square feet, on the floating island from the BUILD app.`} />
          </div>
          <div className="bl-hero-copy">
            <h1 id="hero-title">Design your home.<br /><span>Step inside before it’s built.</span></h1>
            <p className="bl-sub">BUILD turns a sentence into a rule-checked floor plan and a 3D home you can walk through.</p>
            <a className="bl-prompt" href={APP_URL} aria-label={`Open the BUILD demo. Example brief: ${PROMPT}`}>
              <span className="bl-prompt-text">{PROMPT}</span>
              <span className="bl-cta">Build it</span>
            </a>
          </div>
          <a className="bl-scrollcue" href="#problem"><span>Why it matters</span><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3V13M4 9L8 13L12 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
        </section>

        {/* ---------------- PROBLEM ---------------- */}
        <section className="bl-problem bl-screen" id="problem" aria-labelledby="problem-title">
          <div className="bl-wrap bl-problem-grid">
            <div data-reveal>
              <h2 id="problem-title">Design decisions are expensive. <em>Understanding them shouldn’t be.</em></h2>
              <p className="bl-lede">Homeowners commit to layouts they’ve only seen as drawings. By the time a space can be experienced, changing it is slow and costly.</p>
            </div>
            <ul className="bl-fails" aria-label="Where residential design breaks down" data-reveal>
              <li className="bl-fail">
                <div><b>High barriers to entry</b><span>A workable floor plan takes professional help, specialist software, and several rounds of revision.</span></div>
              </li>
              <li className="bl-fail">
                <div><b>Hard to picture</b><span>A drawing fixes dimensions, not experience. A hall that looks fine on paper can feel tight at eye level.</span></div>
              </li>
              <li className="bl-fail">
                <div><b>Costly to change</b><span>Move one wall and the doors, rooms and circulation around it move too.</span></div>
              </li>
            </ul>
          </div>
        </section>

        {/* ---------------- SCALE ---------------- */}
        <section className="bl-scale bl-screen" id="scale" aria-labelledby="scale-title">
          <div className="bl-wrap">
            <div data-reveal>
              <h2 id="scale-title">This isn’t a niche problem.</h2>
            </div>
            <ul className="bl-stats">
              {SCALE.map((s, i) => (
                <li key={s.source + i} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="bl-stat-value"><CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} /></div>
                  <p>{s.label}</p>
                  <a className="bl-source" href={s.href} target="_blank" rel="noreferrer">{s.source}</a>
                </li>
              ))}
            </ul>
            <p className="bl-bridge" data-reveal>The challenge isn’t just creating a floor plan. <span>It’s understanding the space before it exists.</span></p>
          </div>
        </section>

        {/* ---------------- SOLUTION ---------------- */}
        <section className="bl-solution bl-screen" id="solution" aria-labelledby="solution-title">
          <Clouds dense />
          <div className="bl-wrap bl-solution-grid">
            <div className="bl-solution-copy" data-reveal>
              <h2 id="solution-title">From description <em>to dimension.</em></h2>
              <p className="bl-lede">BUILD pairs an AI planner with deterministic geometry. Language sets the intent; a solver and a rule checker make sure the plan actually works.</p>
              <ol className="bl-how">
                <li><span className="bl-num">1</span><div><b>Describe it</b>Plain English: rooms, size, what matters to you.</div></li>
                <li><span className="bl-num">2</span><div><b>Get a plan that passes the rules</b>Exact walls, doors and windows, checked before you see them.</div></li>
                <li><span className="bl-num">3</span><div><b>Walk through it, then refine</b>Explore in 3D at eye height and ask for changes.</div></li>
              </ol>
              <div className="bl-proof">
                <p><b>Plans breaking a layout rule</b><span>30 test prompts, same model, same checker</span></p>
                <div className="bl-proof-row"><span>AI drawing geometry itself</span><i className="bl-proof-bar"><i style={{ width: "73.3%" }} className="is-raw" /></i><b className="bl-num">73.3%</b></div>
                <div className="bl-proof-row"><span>BUILD</span><i className="bl-proof-bar"><i style={{ width: "1%" }} /></i><b className="bl-num">0%</b></div>
              </div>
            </div>
            <div className="bl-panel" data-reveal>
              <BuildSequence />
            </div>
          </div>
        </section>

        {/* ---------------- VS. CHATGPT & CLAUDE ---------------- */}
        <section className="bl-compare bl-screen" id="compare" aria-labelledby="compare-title">
          <div className="bl-wrap">
            <div className="bl-cmp-intro" data-reveal>
              <h2 id="compare-title">Same sentence. <em>Three very different houses.</em></h2>
              <p className="bl-lede">We gave ChatGPT, Claude and BUILD the identical brief: <q>{PROMPT}</q>. Flip each between its plan and its 3D model.</p>
            </div>
            <div className="bl-cmp-grid" data-reveal>
              <ChatGPTCard />
              <ClaudeCard />
              <CompareCard
                tool="BUILD" tag="Our platform" mine
                plan={<div className="bl-cmp-iso is-plan"><IsoHouse layout={LAYOUT} title={`BUILD's floor plan, ${sqft.toLocaleString()} square feet`} /></div>}
                model={<div className="bl-cmp-iso"><IsoHouse layout={LAYOUT} title={`BUILD's 3D model of the same plan, ${sqft.toLocaleString()} square feet`} /></div>}
                note={`${sqft.toLocaleString()} sq ft. The same solved layout becomes the plan, the 3D model and the walkthrough, and it passes every layout rule.`}
              />
            </div>
            <div className="bl-cmp-tablewrap" data-reveal>
              <table className="bl-cmp-table">
                <caption className="bl-sr">What each tool gives you from the same brief</caption>
                <thead><tr><th scope="col"><span className="bl-sr">Capability</span></th><th scope="col">ChatGPT</th><th scope="col">Claude</th><th scope="col" className="is-mine">BUILD</th></tr></thead>
                <tbody>
                  {CMP_ROWS.map((r) => (
                    <tr key={r.label}><th scope="row">{r.label}</th><Mark v={r.gpt} /><Mark v={r.claude} /><Mark v={r.build} /></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="bl-cmp-fine">ChatGPT and Claude outputs are exploratory one-off runs (November 2026), shown as generated. Their scenes are visual concepts and were not run through a rule checker.</p>
          </div>
        </section>

        {/* ---------------- WALK THROUGH IT ---------------- */}
        <section className="bl-walk bl-screen" id="walk" aria-labelledby="walk-title">
          <div className="bl-wrap bl-walk-grid">
            <div className="bl-walk-copy" data-reveal>
              <h2 id="walk-title">Don’t look at it. <em>Walk through it.</em></h2>
              <p className="bl-lede">A chatbot hands you a dollhouse to spin. BUILD puts you inside, at eye height, in light that behaves like light.</p>
              <ol className="bl-how">
                <li><span className="bl-num">1</span><div><b>Eye level, not bird’s-eye</b>Stand in the doorway and see whether the hall feels tight before anyone builds it.</div></li>
                <li><span className="bl-num">2</span><div><b>Photoreal, path-traced</b>Every view is rendered in Blender Cycles with real sky light, materials and furniture.</div></li>
                <li><span className="bl-num">3</span><div><b>Room to room, like Street View</b>Click the floor arrows or the map to walk from the living room to the bedrooms.</div></li>
              </ol>
            </div>
            <div className="bl-walk-view" data-reveal>
              <WalkthroughEmbed />
              <p className="bl-walk-cap">Drag to look around · click the floor arrows to walk</p>
            </div>
          </div>
        </section>

        {/* ---------------- INTO THE DEMO ---------------- */}
        <section className="bl-demo bl-screen" id="demo" aria-labelledby="demo-title">
          <Clouds />
          <div className="bl-demo-inner" data-reveal>
            <h2 id="demo-title">Let’s build one.</h2>
            <p className="bl-sub">Describe a home. We’ll plan it, check it, and walk through it.</p>
            <a className="bl-prompt bl-prompt-lg" href={APP_URL} aria-label="Open the BUILD demo">
              <span className="bl-prompt-text">Describe your home…</span>
              <span className="bl-cta">Open the demo <Arrow /></span>
            </a>
          </div>
          <footer className="bl-footer">
            <Logo size={18} />
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            <span>© 2026 BUILD</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
