// Validate the landing walkthrough route against the app's real wall builder.
// Run from frontend/: node scripts/check-landing-path.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';

const packageRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative) {
  const file = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const record = { exports: {} };
  const localRequire = (name) => name === 'three' ? THREE : packageRequire(name);
  vm.runInNewContext(code, { exports: record.exports, module: record, require: localRequire });
  return record.exports;
}

const layout = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/sample-layout.json'), 'utf8'));
const { buildWalls, WALL_THICKNESS_FT } = load('src/lib/walls.ts');
const { poseAt, KEYS, EYE } = load('src/components/landing/walkPath.ts');
const walls = buildWalls(layout);
const { width_ft: W, depth_ft: D } = layout.footprint;
const clearance = 0.45 + WALL_THICKNESS_FT / 2;
const N = 8000;
const doorP = KEYS.find((k) => k.pos[1] === EYE).p;
let prev = null, maxStep = 0, inside = 0;
for (let i = 0; i <= N; i++) {
  const p = i / N;
  const { pos } = poseAt(p);
  assert(Number.isFinite(pos.x + pos.y + pos.z), `non-finite pose at ${p}`);
  if (prev) maxStep = Math.max(maxStep, pos.distanceTo(prev));
  prev = pos.clone();
  if (p >= doorP) assert(Math.abs(pos.y - EYE) < 0.05, `eye height ${pos.y.toFixed(2)} ft at progress ${p.toFixed(4)}`);
  if (pos.y > 9.6) continue; // above the walls
  const x = pos.x, y = pos.z;
  if (x > 0 && x < W && y > 0 && y < D) inside++;
  for (const s of walls) {
    const hit = x > Math.min(s.x1, s.x2) - clearance && x < Math.max(s.x1, s.x2) + clearance
      && y > Math.min(s.y1, s.y2) - clearance && y < Math.max(s.y1, s.y2) + clearance;
    assert(!hit, `camera within ${clearance.toFixed(2)} ft of wall (${s.x1},${s.y1})–(${s.x2},${s.y2}) at progress ${p.toFixed(4)}: (${x.toFixed(2)}, ${y.toFixed(2)})`);
  }
}
assert(inside > N * 0.3, 'route should spend most of its interior time inside the footprint');
assert(maxStep < 0.2, `largest per-sample jump ${maxStep.toFixed(3)} ft suggests a discontinuity`);
console.log(`PASS: ${N + 1} poses clear every wall by ${clearance.toFixed(2)} ft (center line), eye height ${EYE} ft after the door, max step ${maxStep.toFixed(3)} ft.`);
