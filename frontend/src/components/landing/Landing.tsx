// BUILD presentation intro: hero → problem → scale → solution → into the demo.
// Visual language is the Site model app's: sky gradient, cloud sea, the floating island,
// white rounded panels, 999px pills, its stepper pills and rule cards, Hanken Grotesk.
import { IsoHouse } from "./IsoHouse";
import { Logo } from "./Logo";
import { BuildSequence, CountUp, RevealObserver, SectionDots } from "./interactive";
import { APP_URL, GITHUB_URL, LAYOUT, PROMPT, SCALE, totalArea } from "./data";

const SECTIONS = [
  { id: "intro", label: "BUILD" },
  { id: "problem", label: "The problem" },
  { id: "scale", label: "Who needs it" },
  { id: "solution", label: "Our solution" },
  { id: "demo", label: "Demo" },
];

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
            <ul className="bl-fails" aria-label="Where residential design breaks down">
              <li className="bl-fail" data-reveal>
                <div><b>High barriers to entry</b><span>A workable floor plan takes professional help, specialist software, and several rounds of revision.</span></div>
              </li>
              <li className="bl-fail" data-reveal>
                <div><b>Hard to picture</b><span>A drawing fixes dimensions, not experience. A hall that looks fine on paper can feel tight at eye level.</span></div>
              </li>
              <li className="bl-fail" data-reveal>
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
