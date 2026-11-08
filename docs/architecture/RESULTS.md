# Architecture-aware generation: reproduction and evaluation

## Observed causes

The exact prompt in `baseline/request.json` was submitted to the deployed API.
`baseline/warehouse-live.json` is its fresh, uncached response (26.39 seconds,
one attempt). The planner encoded the court as `living`, workrooms as `office`,
and claimed a full-size central court. The deterministic solver produced a
264.5 × 36 ft strip: court 151.5 × 32, kitchen 96 × 4, dining 78 × 4, entry 3 × 32.
All ten deployed checks passed. Thus this was not solely a prompting failure.

The old solver's bounded depths and residential spine, soft-only shape limits,
unconditional program scaling, and narrow room taxonomy caused the mismatch.
Generic living-room furniture then populated the court. The live replay had
zero wall centerlines crossing room interiors; the reported interior-wall symptom
was not reproduced in that fixture. Separate frontend wall builders could merge
across ownership boundaries and infer exterior walls from a bounding rectangle.
The new common topology removes this divergence and tests its invariants.
The residential camera-distance cap also cropped large buildings.

## Implementation

- `architecture.py`, `room_specs.json`, and `geometry/zoned.py`: semantic area
  preflight and bounded modular-wing candidates, scored for proportions,
  adjacency, circulation, and edit stability. Separate public/private/work wings
  surround a clear recreation anchor. Residential programs retain a public anchor;
  legacy version-zero programs retain the previous solver.
- `schema.py`, frontend `types.ts`, and `CONTRACTS.md`: additive versioned
  archetype/style/zone/dimension fields, specialized room types, court format,
  canonical walls, open connections, opening heights and explanatory notes.
- `architecture_checks.py`: hard usable dimensions/aspects, privacy-aware
  circulation, complete/current wall boundaries, ownership, duplicates, interior
  crossings and matching door openings. Existing overlap, area, connectivity,
  exterior bedroom and kitchen adjacency checks remain.
- `wallTopology.js`: shared segmentation for the active 2D/3D app and legacy view.
  Backend edits regenerate topology; unavailable versioned edits preserve the
  existing model. Explicit open-plan connections omit full partitions/headers.
- `roomRenderers.js`: procedural full/half/compact court surfaces, boundary/key/
  free-throw/three-point lines, appropriate center markings and hoops, using one
  geometric source for SVG and Three.js. Workrooms get steel workbenches; existing
  bedroom/kitchen/dining/bathroom renderers remain. Industrial materials, tall
  windows, high ceilings, illustrative steel beams and footprint-scaled camera
  settings retain the existing site interface.

Full court playing dimensions (94 × 50 ft) and the 110 × 60 ft diagram envelope
are drawn from the [NBA officials guide](https://cms.nba.com/wp-content/uploads/sites/4/2025/10/2025-26-NBA-Officials-Guide.pdf).
The half and compact configurations and their clearance allowances are project
recreational design choices. These are conceptual, not engineering certification.

## Reproducible evaluation

Run from the repository root with the backend environment:

```sh
python tools/architecture_diagnostics.py
python tools/architecture_diagnostics.py --architecture --output docs/architecture/after
```

Committed JSON contains the measured values and actual layouts. Warehouse uses
the saved live planner program; other cases use deterministic synthetic programs.
This isolates solver changes; it is not a fresh end-to-end LLM benchmark. Counts
below use the same new dimension registry to assess both old and new geometry.
“Area failing shape limits” is a heuristic area fraction, not a measured usable
floor-area calculation. Room-ID coverage is program coverage, not NLP accuracy.

| Case | Shape violations before → after | Area failing shape limits before → after |
|---|---:|---:|
| Three-bedroom home | 0 → 0 | 0% → 0% |
| Warehouse, eight bedrooms | 4 → 0 | 59.23% → 0% |
| Open loft | 2 → 0 | 47.78% → 0% |
| Small home with dining | 0 → 0 | 0% → 0% |
| Large kitchen | 0 → 0 | 0% → 0% |
| Multiple workspaces | 0 → 0 | 0% → 0% |
| Overspecified 1,000 sq ft warehouse | 5 → explicit conflict | 60.29% → no invalid plan |

The six feasible new layouts pass 12/12 checks and retain 100% of input room IDs.
The old six pass their 9/9 checks, showing why those checks alone were inadequate.
The old overspecified program passes 8/9; the new preflight rejects it. All six
new rendered plans have zero interior-crossing wall segments. The primary live
baseline also has zero, so no reduction is claimed for that symptom.

The warehouse retains eight bedrooms, three bathrooms, four distinct workrooms,
and shared rooms. It selects a disclosed 47 × 50 ft recreational playing surface
in a 57 × 60 ft room, with 26 ft overall ceilings; the full-court request at 10,000
sq ft is rejected. A 16,000 sq ft full-court variant passes regression testing.
Actual warehouse area is approximately 10,700 sq ft, within the supported ±10%.
Circulation rises from about 3.8% to about 19.8% to avoid court/private-room transit.
The old soft preference metric is retained in JSON: not every soft proportion
preference improves, and compact homes/workspace cases can score worse on it.

The timing values are single local runs, excluding the LLM and rendering. They
are subsecond for these cases and fluctuate with concurrent builds; consult
`metrics.json` rather than treating them as production latency claims.

## Limits

One court, one story, rectangular rooms in an orthogonal union, with a bounded
candidate search. This is not a general architectural optimizer; a feasible
program may require different targets if the candidate family cannot fit it.
Bedrooms within their wing may still form rows. Daylight is approximated through
exterior access, not simulated. Court clearances and illustrative structure are
not code/structural certification. Version-zero saved plans load unchanged and
are not retroactively rejected by the new hard checks. Edits may reflow multiple
rooms and require the backend; no unvalidated local fallback applies to version 1.
Backend and frontend deployments must both include the updated contract.

## Verification record

- Backend: 197 existing tests plus 10 architecture regressions, including the exact
  prompt through the real planner/preflight/solver/checker pipeline with a captured
  LLM response substituted for the network call, and HTTP 422 behavior.
- `node frontend/scripts/check-architecture.mjs`: six layouts, all three court
  formats and both orientations; finite mesh geometry, court markings/hoops,
  topology agreement, interior intersections and animation resting positions.
- `npx tsc --noEmit`; `npm run lint` (zero errors; 11 existing warnings).
- `npm run build -- --webpack`: successful production build. Default Turbopack
  encountered sandbox worker-port restrictions; webpack is the validated engine.
- Actual production app replay inspected in Playwright at 1600 × 1000, using
  captured baseline and newly solved responses. Screenshots are under
  `screenshots/`. The updated 2D and 3D views show the same zoned geometry and
  recognizable court, with the selected half-court tradeoff visible in chat.
  This verifies rendering, not a fresh deployed LLM call.
- Six-case mean local solver runtime in the committed run: 0.1392 s before and
  0.1443 s after. These single-run values exclude LLM/API and rendering time.
