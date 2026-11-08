// The directed camera route for the scroll walkthrough, in PLAN coordinates:
// [x (ft east), height (ft), y (ft south)] on the bundled sample layout (61 × 28 ft).
// Positions run through a centripetal Catmull–Rom spline; orientation is a quaternion slerp
// between key views. Interior keys sit at 5.5 ft eye height and cross each wall only through
// a real opening (front door x 12.5–15.5, kitchen 1–15, dining 1–12, living/dining 17.5–26.5,
// hall door 13.5–16.5). scripts/check-landing-path.mjs samples the route against every wall.
import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from "three";

export const EYE = 5.5;
export interface Key { p: number; pos: [number, number, number]; look: [number, number, number] }

export const KEYS: Key[] = [
  { p: 0.0, pos: [30.5, 78, 14.6], look: [30.5, 0, 14] },       // 1 blueprint, straight down, north up
  { p: 0.12, pos: [30.5, 78, 15.5], look: [30.5, 0, 14] },
  { p: 0.3, pos: [-10, 38, 66], look: [27, 1, 14] },            // 2 walls up, three-quarter view
  { p: 0.42, pos: [8, 13, 52], look: [14, 5, 28] },             // 3 descend toward the entrance
  { p: 0.5, pos: [14, EYE, 39], look: [14, EYE, 28] },          //   eye level, square to the door
  { p: 0.56, pos: [14, EYE, 30.5], look: [14, EYE, 20] },       //   through the 3 ft front door
  { p: 0.62, pos: [14, EYE, 23.5], look: [6, 5, 12] },          // 4 living room, turning to the kitchen
  { p: 0.7, pos: [8.5, EYE, 16], look: [8, 5, 3] },
  { p: 0.77, pos: [9, EYE, 7.5], look: [26, 5, 6.5] },          //   kitchen, looking into dining
  { p: 0.83, pos: [21.5, EYE, 7], look: [22, 5, 22] },          //   dining, looking back to living
  { p: 0.88, pos: [23, EYE, 16.5], look: [40, EYE, 15] },       //   toward the hall door
  { p: 0.94, pos: [32, EYE, 15], look: [60, EYE, 15] },         //   hall
  { p: 1.0, pos: [47, EYE, 15], look: [62, EYE, 15] },
];

const curve = new CatmullRomCurve3(KEYS.map((k) => new Vector3(...k.pos)), false, "centripetal");
const up = new Vector3(0, 1, 0);
const quats = KEYS.map((k) => {
  const m = new Matrix4().lookAt(new Vector3(...k.pos), new Vector3(...k.look), up);
  return new Quaternion().setFromRotationMatrix(m);
});

const smooth = (f: number) => f * f * (3 - 2 * f);
/** Half linear, half smoothstep: continuous speed with a gentle dwell at each key view. */
const ease = (f: number) => f * 0.45 + smooth(f) * 0.55;

export function segmentOf(p: number) {
  const q = Math.min(1, Math.max(0, p));
  let i = 0;
  while (i < KEYS.length - 2 && q > KEYS[i + 1].p) i++;
  const f = (q - KEYS[i].p) / (KEYS[i + 1].p - KEYS[i].p);
  return { i, f: Math.min(1, Math.max(0, f)) };
}

/** Camera pose at scroll progress p (0–1), in plan coordinates. Writes into the given targets. */
export function poseAt(p: number, pos = new Vector3(), quat = new Quaternion()) {
  const { i, f } = segmentOf(p);
  const e = ease(f);
  curve.getPoint((i + e) / (KEYS.length - 1), pos);
  // between two eye-level keys hold eye height exactly (the spline would dip slightly after the descent)
  if (KEYS[i].pos[1] === EYE && KEYS[i + 1].pos[1] === EYE) pos.y = EYE;
  quat.copy(quats[i]).slerp(quats[i + 1], smooth(f));
  return { pos, quat };
}

/** Polyline of the interior route (plan x, y) for drawing it on the plan. */
export function routePolyline(from = 0.47, to = 1, steps = 120) {
  const v = new Vector3(), pts: string[] = [];
  for (let s = 0; s <= steps; s++) {
    poseAt(from + ((to - from) * s) / steps, v);
    pts.push(`${v.x.toFixed(2)} ${v.z.toFixed(2)}`);
  }
  return "M" + pts.join(" L");
}

export interface Chapter { at: number; num: string; title: string; body: string }
export const CHAPTERS: Chapter[] = [
  { at: 0, num: "01", title: "The blueprint", body: "The plan BUILD generated for a 3-bed, 2-bath brief: eleven rooms on a 61 × 28 ft footprint, drawn from one layout model." },
  { at: 0.14, num: "02", title: "Geometry becomes architecture", body: "Walls extrude from the same segments that draw the plan. Door openings and window cuts come from the layout data, not from an image." },
  { at: 0.36, num: "03", title: "Enter at eye level", body: "The camera descends to 5′6″ and steps through the 3 ft front door, the same opening drawn on the plan." },
  { at: 0.58, num: "04", title: "Walk the living space", body: "Living room, kitchen, dining and hall, at true proportion. Each room reports its size and the rooms it opens onto." },
  { at: 0.95, num: "05", title: "Back to the plan", body: "The route you just walked, traced on the plan it came from. One geometric model behind both views." },
];
