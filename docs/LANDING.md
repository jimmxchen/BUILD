# BUILD landing page (presentation intro)

`/` is the landing page: a short intro to present before the live demo. The app moved to `/app`;
`/welcome` redirects to `/`. Every "Build it" / "Open the demo" link goes to `/app` (override with
`NEXT_PUBLIC_APP_URL`). The page needs no backend and makes no LLM call.

From `frontend/`:

```sh
npm ci
npm run dev        # http://localhost:3000 (landing), http://localhost:3000/app (app)
npx eslint src/components/landing src/app
npm run build
```

## Sections (one screen each, scroll-snapped, dot navigation on the right)

1. **Intro**: the sample house on the app's floating island, headline, the app's prompt bar.
2. **The problem**: three pain points in one borderless white panel with larger type.
3. **Who needs this**: four verified figures (below).
4. **Our solution**: three steps, the 30-prompt eval result, and the app's stepper pills and
   rule cards replaying the build of the sample plan.
5. **Into the demo**: "Let's build one." and the prompt bar into `/app`.

## Visual system

All from the Site model app (`src/app/site-model.css`, `src/build/siteModelApp.js`): paper `#F6F5F1`,
ink, muted, line colours, the sky gradient, cloud sprites, white panels, the
`.prompt` bar, `.ghost` button, `.stepper` pills, `.rule` cards, Hanken Grotesk, and the
island palette (`ISLAND_LOOK`). The app's cobalt is replaced by the island greens. The logo is the app's
lockup (`MARK_PATH` + "uild") with the mark in green. Styles: `src/app/landing.css`, scoped to `.bl`.
The presentation headings stand on their own without numbered section kickers; the three problem
points use larger type on a white surface without an outline or internal dividers.

`IsoHouse.tsx` draws the sample layout (`src/lib/sample-layout.json`, real solver output) as an SVG
axonometric on a low-poly island. Walls come from `lib/walls.ts`; one CSS custom property (`--rise`)
raises them from the drawn plan, so the hero needs no WebGL or script and cannot flash or shift.

## Figures (checked against the original sources on 2026-11-08)

| Figure | Source |
|---|---|
| 939,700 single-family homes started in the U.S. in 2025 | U.S. Census Bureau, New Residential Construction (`starts_cust.xlsx`, annual, 1 unit) |
| $518B projected homeowner spending on improvements and repairs in 2026 | Harvard JCHS, LIRA press release, revised Apr 15, 2026 |
| 91% of 2025 renovators hired at least one professional | 2026 U.S. Houzz & Home Renovation Trends Study, p. 22 |
| 37% of 2025 renovators went over budget; 31% of those cited changed scope or design | same study, p. 11 |
| 73.3% vs 0% of plans breaking a layout rule (raw model vs pipeline, 30 prompts) | `docs/eval/` |

Houzz figures describe renovating homeowners on Houzz (n = 10,176), not custom-home design.

The longer scroll-driven 3D walkthrough version of this page is in commit `ebc6fed` on this branch.
