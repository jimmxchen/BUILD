# BUILD landing page

The product story lives at `/welcome`. The app stays at `/`, and every "Start designing",
"Try BUILD" and "Open BUILD" link opens it (override with `NEXT_PUBLIC_APP_URL` if the app is
deployed separately). The page needs no backend and no LLM call to render.

From `frontend/`:

```sh
npm ci
npm run dev                       # http://localhost:3000/welcome
npx eslint src/components/landing src/app/welcome scripts/check-landing-path.mjs
npx tsc --noEmit
node scripts/check-landing-path.mjs
npm run build
```

## Visual system

Everything is derived from the Site model app (`src/app/site-model.css`, `src/build/siteModelApp.js`):
paper `#F6F5F1`, ink `#151515`, muted `#6E6B65`, line `#E2DFD8`, white rounded panels, 999px pills,
the app's shadow, Hanken Grotesk, the sky gradient, and the island's greens (`#B3CD96`, `#98B77C`,
`#8FB879`, `#A5C78A`, `#7AA766`). Darker greens are those leaves at lower lightness for text contrast.
The logo is the app's own lockup (`MARK_PATH` + "uild" from `lockupHTML` in `core.js`), drawn as SVG
at its native 273 × 280 ratio; only the mark's fill follows the green palette. Tokens live on `.bl` in
`src/app/welcome/welcome.css`, scoped so the app is untouched.

## Structure (`src/components/landing/`)

| File | Role |
|---|---|
| `Landing.tsx` | Server component: hero, problem + statistics, how it works, technology, product, demo, closing, footer |
| `IsoHouse.tsx` | Hero axonometric of the sample layout in plain SVG (walls from `lib/walls.ts`, cut at 5 ft). One CSS custom property (`--rise`) raises every wall from the drawn plan, so the hero needs no script and cannot flash or shift |
| `PlanDrawing.tsx`, `planGeometry.ts` | Drafted plan from a Layout: rooms, walls, door swings, windows, labels, dimensions, in separate layers |
| `interactive.tsx` | Client islands: reveal observer, count-up, nav, plan assembly, before/after edit, wall-shift diagram, app screenshot tabs |
| `Walkthrough.tsx`, `walkScene.ts`, `walkPath.ts` | The scroll-controlled 3D walkthrough |
| `data.ts` | Copy, verified statistics with sources, links, the two layouts |
| `edit-kitchen-larger.json` | Real solver output for the "Make the kitchen larger" demo (see below) |

`public/landing/*.webp` are screenshots of the running app (offline backend, default brief).

## The 3D walkthrough

A 760vh section with a `position: sticky` stage; native scroll maps to progress 0–1 (no scroll
hijacking). The scene reuses the app's `buildHouse`, `buildFurniture`, `createFloatingIsland`,
`enhanceRenderer` and `fitSun` on `src/lib/sample-layout.json`, the same layout the plan drawings use.

- Camera: centripetal Catmull–Rom spline through 13 key positions, quaternion slerp between key
  orientations, frame-rate-independent exponential smoothing toward the scroll target.
- Scenes: overhead blueprint → walls extrude (`scale.y`) and materials finish → descent to 5.5 ft →
  through the 3 ft front door → living, kitchen, dining, hall through real openings → the plan
  with the walked route traced.
- The SVG blueprint is the poster. The overhead camera height is solved from the poster's drawn
  size, so the crossfade into WebGL keeps the house in place.
- Furniture on the eye-level route is hidden at build time so the camera never passes through it.
- `scripts/check-landing-path.mjs` samples 8,001 poses against the real walls: center line at least
  0.61 ft from every wall, 5.5 ft eye height from the door on, no discontinuities.
- WebGL mounts only near the viewport, renders on demand, caps DPR (1.75 desktop, 1.5 phones),
  pauses offscreen, disposes geometry/materials/textures, handles resize and context loss, and
  starts at the current scroll position after a refresh (no sweep from 0).
- Reduced motion: the section is one screen with chapter buttons that jump between views.
  No WebGL: a real app walkthrough screenshot replaces the canvas.

## Edit demo

`edit-kitchen-larger.json` was produced offline with the backend: the sample program with the
kitchen's `target_sqft` raised from 210 to 284 (×1.35), `solver.solve(program, keep=sample_layout)`,
then `checker.check` (all checks pass). In the app the planner turns the sentence into that program
change; the landing page shows only the geometric step and says so.

## Statistics (verified 2026-11-08 against the original files)

| Figure | Source |
|---|---|
| 37% of U.S. homeowners who renovated in 2025 went over budget (35% on, 3% under, 25% no budget) | 2026 U.S. Houzz & Home Renovation Trends Study, p. 11 |
| 31% of over-budget renovators cited changed scope or design | same, p. 11 |
| $20,000 median renovation spend, 2025 | same, p. 5 |
| 10.5 months average start-to-completion, contractor-built single-family homes, 2025 | U.S. Census Bureau, Survey of Construction (`avg_starttocomp_cust.xlsx`) |

Houzz figures are renovation projects by homeowners on Houzz (n = 10,176), not custom-home design;
the page says so. The benchmark numbers come from `docs/eval/` (30 prompts, 2026-11-08) with their
limits stated next to them.

## Known limits

- Mobile GPUs and Safari were not tested on physical devices; checks ran in desktop Chrome at
  1440 × 900, 900 × 1100 and 390 × 844, with reduced motion on and off.
- `<img>` is used for the static screenshots (lint warns about `next/image`).
- Repository-wide lint still reports the existing `<a href="/">` error in `SiteModel.tsx`.
