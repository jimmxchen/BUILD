// 3 bed / 2 bath single-story house, about 1,800 sq ft.
// Units are feet. Plan coordinates: x = east, y = north, origin = SW corner of footprint,
// front (street) side is y = 0. In three.js: X = plan x, Z = -plan y, Y = up.
// Rebuild standalone file: see build.sh next to this source (esbuild + three).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const params = new URLSearchParams(location.search);
const WALL_H = 9;
const CUT_H = 4.5;
const EXT_T = 0.5;
const INT_T = 0.33;
let cutaway = params.get('walls') !== 'full';

// ---------- renderer / scene ----------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f1ec);

const camera = new THREE.PerspectiveCamera(35, 1, 1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 260;
controls.maxPolarAngle = 1.52;

scene.add(new THREE.HemisphereLight(0xffffff, 0xbdb7aa, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.35);
sun.position.set(5, 95, 55);
sun.target.position.set(30, 0, -15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- helpers ----------
const matCache = new Map();
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra }));
  }
  return matCache.get(key);
}
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x9ecbe8, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0, depthWrite: false,
});
const P = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

// ---------- ground, slab, porch ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0xe9e7e0));
ground.rotation.x = -Math.PI / 2;
ground.position.set(30, -0.3, -15);
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(120, 12, 0xb7b3a6, 0xd6d3c9);
grid.position.set(30, -0.28, -15);
scene.add(grid);

function addBox(parent, x, y, w, d, h, color, z0 = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(color));
  m.position.set(x, z0 + h / 2, -y);
  m.castShadow = opts.noShadow ? false : true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const site = new THREE.Group();
scene.add(site);
addBox(site, 30, 15, 61, 31, 0.3, 0xd2cec4, -0.3); // foundation slab edge
addBox(site, 29.5, -3, 9, 6, 0.3, 0xc4bfb4, -0.02); // porch / landing

// ---------- floors ----------
const ROOMS = [
  { n: 'Office', x: 0, y: 0, w: 12, d: 14, floor: 0xc9a674, lx: 6, ly: 7 },
  { n: 'Bedroom 3', x: 12, y: 0, w: 13, d: 14, floor: 0xd9d0c4, lx: 19, ly: 11.6 },
  { n: 'Entry Foyer', x: 25, y: 0, w: 9, d: 14, floor: 0xb4b9bc, lx: 29.5, ly: 7.2 },
  { n: 'Hall', x: 0, y: 14, w: 34, d: 4, floor: 0xc9a674, lx: 17, ly: 16 },
  { n: 'Bedroom 2', x: 0, y: 18, w: 15, d: 12, floor: 0xd9d0c4, lx: 7.5, ly: 21.8 },
  { n: 'Bath 2', x: 15, y: 18, w: 8, d: 12, floor: 0xcfd8dc, lx: 19, ly: 24.5, narrow: true },
  { n: 'Laundry', x: 23, y: 18, w: 7, d: 12, floor: 0xcfd8dc, lx: 26.5, ly: 23.2, narrow: true },
  { n: 'Primary Bedroom', x: 30, y: 18, w: 16, d: 12, floor: 0xd9d0c4, lx: 38, ly: 22.2 },
  { n: 'Primary Bath', x: 46, y: 18, w: 14, d: 7, floor: 0xcfd8dc, lx: 53, ly: 21.4 },
  { n: 'Walk-in Closet', x: 46, y: 25, w: 14, d: 5, floor: 0xd9d0c4, lx: 53, ly: 27.5 },
  { n: 'Open Great Room', x: 34, y: 0, w: 26, d: 18, floor: 0xc9a674, lx: 46.5, ly: 8.6 },
];
const totalArea = ROOMS.reduce((s, r) => s + r.w * r.d, 0);
console.log('Total area (sf):', totalArea);

for (const r of ROOMS) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), mat(r.floor, { roughness: 0.95 }));
  f.rotation.x = -Math.PI / 2;
  f.position.set(r.x + r.w / 2, 0.02, -(r.y + r.d / 2));
  f.receiveShadow = true;
  scene.add(f);
}

// ---------- walls ----------
const wallsGroup = new THREE.Group();
scene.add(wallsGroup);

const EXT_SIDE = mat(0xe8e2d4);
const INT_SIDE = mat(0xf7f4ee);
const TOP = mat(0x4a4a4a, { roughness: 0.6 });

const D = { sill: 0, head: 6.8 }; // door
const CASED = { sill: 0, head: 7.7 }; // open archway
const win = (a, b, sill = 3, head = 7) => ({ a, b, sill, head, glass: true });
const door = (a, b) => ({ a, b, ...D });
const cased = (a, b) => ({ a, b, ...CASED });
const slider = (a, b) => ({ a, b, sill: 0, head: 6.8, glass: true });

const WALLS = [
  // exterior
  { o: 'h', c: 0, a1: 0, a2: 60, ext: true, ops: [
    door(28, 31), win(3, 9, 3, 7), win(15, 21, 3, 7), win(36, 46, 2.5, 7), win(49, 58, 2.5, 7)] },
  { o: 'h', c: 30, a1: 0, a2: 60, ext: true, ops: [
    win(4, 9, 3, 7), win(17.5, 20.5, 5.2, 7), win(32.5, 35, 3, 7), win(43, 45.5, 3, 7)] },
  { o: 'v', c: 0, a1: 0, a2: 30, ext: true, ops: [win(5, 9, 3, 7), win(21, 26, 3, 7)] },
  { o: 'v', c: 60, a1: 0, a2: 30, ext: true, ops: [slider(9, 14), win(21, 23.5, 4.5, 7)] },
  // interior
  { o: 'h', c: 14, a1: 0, a2: 34, ops: [door(7, 10), door(20.5, 23.5), cased(26, 33)] },
  { o: 'h', c: 18, a1: 0, a2: 60, ops: [door(9, 12), door(18, 21), door(25, 28), door(30.5, 33.5)] },
  { o: 'h', c: 25, a1: 46, a2: 60, ops: [] },
  { o: 'v', c: 12, a1: 0, a2: 14, ops: [] },
  { o: 'v', c: 25, a1: 0, a2: 14, ops: [] },
  { o: 'v', c: 34, a1: 0, a2: 18, ops: [cased(3, 9), cased(14.5, 17.5)] },
  { o: 'v', c: 15, a1: 18, a2: 30, ops: [] },
  { o: 'v', c: 23, a1: 18, a2: 30, ops: [] },
  { o: 'v', c: 30, a1: 18, a2: 30, ops: [] },
  { o: 'v', c: 46, a1: 18, a2: 30, ops: [door(19, 22), door(26, 29)] },
];

// door leaves + swing arcs: hinge, radius, closed angle, open angle (degrees, plan, ccw from east)
const DOORS = [
  { hx: 28, hy: 0, r: 3, a0: 0, a1: 90 },
  { hx: 7, hy: 14, r: 3, a0: 0, a1: -90 },
  { hx: 23.5, hy: 14, r: 3, a0: 180, a1: 270 },
  { hx: 9, hy: 18, r: 3, a0: 0, a1: 90 },
  { hx: 21, hy: 18, r: 3, a0: 180, a1: 90 },
  { hx: 25, hy: 18, r: 3, a0: 0, a1: 90 },
  { hx: 33.5, hy: 18, r: 3, a0: 180, a1: 90 },
  { hx: 46, hy: 22, r: 3, a0: 270, a1: 360 },
  { hx: 46, hy: 29, r: 3, a0: 270, a1: 360 },
];
const doorsGroup = new THREE.Group();
scene.add(doorsGroup);

function buildWalls() {
  for (const g of [wallsGroup, doorsGroup]) {
    while (g.children.length) {
      const c = g.children.pop();
      c.geometry && c.geometry.dispose();
    }
  }
  const hgt = cutaway ? CUT_H : WALL_H;

  function wall(w) {
    const t = w.ext ? EXT_T : INT_T;
    const side = w.ext ? EXT_SIDE : INT_SIDE;
    const mats = [side, side, TOP, side, side, side];
    let a1 = w.a1, a2 = w.a2;
    if (w.ext) { a1 -= t / 2; a2 += t / 2; }
    const seg = (s, e, y0, y1) => {
      y1 = Math.min(y1, hgt);
      const len = e - s;
      if (len <= 0.001 || y1 <= y0) return;
      const size = w.o === 'h' ? [len, y1 - y0, t] : [t, y1 - y0, len];
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mats);
      const mid = (s + e) / 2;
      if (w.o === 'h') m.position.set(mid, (y0 + y1) / 2, -w.c);
      else m.position.set(w.c, (y0 + y1) / 2, -mid);
      m.castShadow = true;
      m.receiveShadow = true;
      wallsGroup.add(m);
    };
    const glass = (s, e, y0, y1) => {
      y1 = Math.min(y1, hgt);
      if (y1 <= y0) return;
      const len = e - s;
      const size = w.o === 'h' ? [len, y1 - y0, 0.06] : [0.06, y1 - y0, len];
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), glassMat);
      const mid = (s + e) / 2;
      if (w.o === 'h') m.position.set(mid, (y0 + y1) / 2, -w.c);
      else m.position.set(w.c, (y0 + y1) / 2, -mid);
      m.renderOrder = 2;
      wallsGroup.add(m);
    };
    const ops = w.ops.slice().sort((p, q) => p.a - q.a);
    let cur = a1;
    for (const o of ops) {
      if (o.a > cur) seg(cur, o.a, 0, hgt);
      if (o.sill > 0) seg(o.a, o.b, 0, o.sill);
      if (o.head < hgt) seg(o.a, o.b, o.head, hgt);
      if (o.glass) glass(o.a, o.b, Math.max(o.sill, 0.02), o.head);
      cur = o.b;
    }
    if (a2 > cur) seg(cur, a2, 0, hgt);
  }
  WALLS.forEach(wall);

  const leafH = Math.min(6.7, hgt);
  for (const d of DOORS) {
    const a1 = (d.a1 * Math.PI) / 180;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(d.r, leafH, 0.12), mat(0xa57c52));
    leaf.position.set(d.hx + (d.r / 2) * Math.cos(a1), leafH / 2, -(d.hy + (d.r / 2) * Math.sin(a1)));
    leaf.rotation.y = a1;
    leaf.castShadow = true;
    doorsGroup.add(leaf);
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = ((d.a0 + ((d.a1 - d.a0) * i) / n) * Math.PI) / 180;
      pts.push(new THREE.Vector3(d.hx + d.r * Math.cos(a), 0.07, -(d.hy + d.r * Math.sin(a))));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x6a6258 })
    );
    doorsGroup.add(line);
  }
}
buildWalls();

// ---------- furniture ----------
const furn = new THREE.Group();
scene.add(furn);
const fbox = (x, y, w, d, h, color, z0 = 0) => addBox(furn, x, y, w, d, h, color, z0);
function fglass(x, y, w, d, h, z0 = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
  m.position.set(x, z0 + h / 2, -y);
  furn.add(m);
}
function fcyl(x, y, r, h, color, z0 = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), mat(color));
  m.position.set(x, z0 + h / 2, -y);
  m.castShadow = true;
  m.receiveShadow = true;
  furn.add(m);
}
// oriented group: local +y = back/head direction, local -y = front/foot. theta degrees ccw in plan.
function grp(x, y, theta) {
  const g = new THREE.Group();
  g.position.set(x, 0, -y);
  g.rotation.y = (theta * Math.PI) / 180;
  furn.add(g);
  const lb = (u, v, w, d, h, color, z0 = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(u, z0 + h / 2, -v);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  return lb;
}
function bed(cx, cy, w, l, theta, blanket) {
  const lb = grp(cx, cy, theta);
  lb(0, 0, w + 0.3, l + 0.2, 1.0, 0x7b5c3e);
  lb(0, l / 2 - 0.05, w + 0.3, 0.3, 3.2, 0x6b4f35);
  lb(0, -0.1, w, l - 0.4, 0.8, 0xf3f1ec, 1.0);
  lb(0, -l * 0.14, w + 0.05, l * 0.6, 0.12, blanket, 1.78);
  lb(-w / 4, l / 2 - 1.1, 1.8, 1.0, 0.35, 0xffffff, 1.8);
  lb(w / 4, l / 2 - 1.1, 1.8, 1.0, 0.35, 0xffffff, 1.8);
}
function sofa(cx, cy, len, theta, color = 0x5d7a8c) {
  const lb = grp(cx, cy, theta);
  lb(0, 0, len, 3.0, 1.5, color);
  lb(0, 1.15, len, 0.7, 2.9, color);
  lb(-(len / 2 - 0.4), -0.1, 0.8, 2.9, 2.3, color);
  lb(len / 2 - 0.4, -0.1, 0.8, 2.9, 2.3, color);
  lb(0, -0.1, len - 1.6, 2.5, 0.35, 0x6f8d9f, 1.5);
}
function chair(cx, cy, theta, color = 0x8a6a4a) {
  const lb = grp(cx, cy, theta);
  lb(0, 0, 1.5, 1.5, 0.18, color, 1.4);
  lb(0, 0.7, 1.5, 0.15, 1.7, color, 1.5);
  for (const sx of [-0.6, 0.6]) for (const sy of [-0.6, 0.6]) lb(sx, sy, 0.14, 0.14, 1.4, color);
}
function armchair(cx, cy, theta, color = 0x9a7b5f) {
  const lb = grp(cx, cy, theta);
  lb(0, 0, 3, 3, 1.4, color);
  lb(0, 1.2, 3, 0.6, 2.6, color);
  lb(-1.3, -0.1, 0.5, 2.8, 2.1, color);
  lb(1.3, -0.1, 0.5, 2.8, 2.1, color);
}
const WOOD = 0x8a6a4a;

// Office (x0-12, y0-14)
fbox(4.5, 12.5, 6, 2.5, 0.2, WOOD, 2.4);
fbox(1.6, 12.5, 0.2, 2.3, 2.4, WOOD);
fbox(7.4, 12.5, 0.2, 2.3, 2.4, WOOD);
fbox(4.5, 13.4, 2.2, 0.15, 1.3, 0x1a1a1a, 2.6);
chair(4.5, 10.4, 180, 0x3d4852);
fbox(11.3, 6.5, 1.0, 7, 6, WOOD);
fbox(6, 5, 7, 5, 0.03, 0x9fb0b5, 0.02);

// Bedroom 3 (x12-25, y0-14): queen bed, head on west wall
bed(15.9, 6.5, 5, 6.7, 90, 0x6e8fa6);
fbox(13.3, 3.1, 1.5, 1.6, 1.6, WOOD);
fbox(13.3, 9.9, 1.5, 1.6, 1.6, WOOD);
fbox(22, 1.6, 4.5, 1.8, 2.8, WOOD);
fbox(18.2, 6.5, 8.5, 8, 0.03, 0xb6bfc2, 0.02);

// Foyer (x25-34, y0-14)
fbox(26.3, 5.5, 1.5, 4, 1.6, WOOD);
fbox(26.1, 10.5, 1.2, 3.2, 2.6, WOOD);
fcyl(32.5, 12.4, 0.6, 1.2, 0x7a5a45);
{
  const s = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 14), mat(0x5e8a4e));
  s.position.set(32.5, 2.3, -12.4);
  s.castShadow = true;
  furn.add(s);
}

// Hall runner
fbox(14, 16, 18, 1.8, 0.03, 0x8e9aa0, 0.02);

// Bedroom 2 (x0-15, y18-30): queen bed, head on north wall
bed(6.5, 26.35, 5, 6.7, 0, 0xa8856a);
fbox(3.1, 28.9, 1.5, 1.6, 1.6, WOOD);
fbox(9.9, 28.9, 1.5, 1.6, 1.6, WOOD);
fbox(4.5, 19.2, 6, 1.8, 6.2, 0xb89d7b);
fbox(6.5, 25, 8, 8, 0.03, 0xb6bfc2, 0.02);

// Bath 2 (x15-23, y18-30)
fbox(20, 28.6, 5, 2.4, 1.7, 0xffffff);
fbox(20, 28.6, 4.4, 1.8, 0.05, 0xdfeaf0, 1.72);
fbox(22, 24, 1.7, 3.2, 2.8, 0xe5e0d6);
fbox(22, 24, 1.2, 1.4, 0.05, 0x9db2bd, 2.8);
fbox(16.7, 23.5, 1.8, 1.4, 1.4, 0xffffff);
fbox(15.8, 23.5, 0.5, 1.3, 2.2, 0xffffff);

// Laundry (x23-30, y18-30)
fbox(24.8, 28.7, 2.4, 2.4, 3.4, 0xf0f0f0);
fbox(27.5, 28.7, 2.4, 2.4, 3.4, 0xe4e6e8);
fbox(29.0, 24.5, 1.6, 6, 3.0, 0xd8d2c6);
fbox(29.0, 24.5, 1.7, 6.1, 0.12, 0xe9e6df, 3.0);

// Primary bedroom (x30-46, y18-30): king bed, head on north wall
bed(38, 26.3, 6.3, 6.8, 0, 0x8aa08a);
fbox(33.4, 28.9, 1.5, 1.6, 1.6, WOOD);
fbox(42.6, 28.9, 1.5, 1.6, 1.6, WOOD);
fbox(31.2, 24.3, 1.8, 5, 2.9, WOOD);
fbox(38, 21.7, 5, 1.4, 1.5, 0x6b7f89);
armchair(43.9, 20.1, 225);
fbox(38, 24.2, 9, 8, 0.03, 0xb9b0a2, 0.02);

// Primary bath (x46-60, y18-25)
fbox(52.5, 19.0, 7, 1.8, 2.8, 0xe5e0d6);
fbox(50.5, 19.0, 1.4, 1.3, 0.05, 0x9db2bd, 2.8);
fbox(54.5, 19.0, 1.4, 1.3, 0.05, 0x9db2bd, 2.8);
fbox(58.4, 20.6, 1.8, 1.4, 1.4, 0xffffff);
fbox(59.4, 20.6, 0.5, 1.3, 2.2, 0xffffff);
fbox(51, 23.7, 5.5, 2.4, 1.8, 0xffffff);
fbox(51, 23.7, 4.8, 1.8, 0.05, 0xdfeaf0, 1.82);
fbox(57.6, 23.5, 4.4, 2.6, 0.12, 0xd5dbe0);
fglass(55.45, 23.5, 0.05, 2.6, 6.2);
fglass(57.6, 22.2, 4.4, 0.05, 6.2);

// Walk-in closet (x46-60, y25-30)
fbox(53, 29.45, 11.5, 0.6, 6.2, 0xb89d7b);
fbox(59.35, 27.3, 0.8, 4, 6.2, 0xb89d7b);

// Great room (x34-60, y0-18)
// kitchen
fbox(48, 16.9, 17.6, 1.8, 3.0, 0xd8d2c6);
fbox(48, 16.9, 17.6, 2.0, 0.15, 0xece9e2, 3.0);
fbox(48.5, 16.9, 2.4, 1.7, 0.06, 0x2a2a2a, 3.15);
fbox(58.4, 16.4, 2.8, 3.2, 6.2, 0xc9ced1);
fbox(50, 13, 10, 3, 3.0, 0xcbbda6);
fbox(50, 13, 10.4, 3.4, 0.15, 0xf0ede6, 3.0);
fbox(50, 13, 2.2, 1.4, 0.05, 0x7d8a93, 3.15);
for (const sx of [46.5, 50, 53.5]) fcyl(sx, 10.5, 0.7, 2.4, 0x3d4852);
// dining
fbox(40, 11.75, 6, 3.5, 0.2, WOOD, 2.35);
for (const lx of [37.3, 42.7]) for (const ly of [10.2, 13.3]) fbox(lx, ly, 0.2, 0.2, 2.35, WOOD);
for (const cx of [38.3, 40, 41.7]) { chair(cx, 14.4, 0); chair(cx, 9.1, 180); }
chair(36.1, 11.75, 90);
chair(43.9, 11.75, -90);
// living
fbox(49, 5, 9.5, 7.5, 0.03, 0x9fb0b5, 0.02);
sofa(44.2, 5, 7.5, 90);
fbox(50, 5, 2.2, 4, 1.4, 0x6b4f35);
armchair(50, 9, 0, 0xb08a64);
armchair(50, 1.5, 180, 0xb08a64);
fbox(59.1, 5, 1.6, 6, 1.8, 0x3a3a3a);
fbox(59.55, 5, 0.2, 4.8, 2.6, 0x111111, 2.0);

// ---------- labels ----------
const labels = new THREE.Group();
scene.add(labels);

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function makeLabel(l1, l2, w, h, alpha = 0.86) {
  const cw = 768;
  const ch = Math.round((cw * h) / w);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = `rgba(255,255,255,${alpha})`;
  g.strokeStyle = 'rgba(40,40,40,0.25)';
  g.lineWidth = 4;
  roundRectPath(g, 4, 4, cw - 8, ch - 8, ch * 0.22);
  g.fill();
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const fit = (text, size, weight) => {
    let s = size;
    g.font = `${weight} ${s}px ${font}`;
    while (g.measureText(text).width > cw * 0.9 && s > 12) {
      s -= 2;
      g.font = `${weight} ${s}px ${font}`;
    }
  };
  if (l2) {
    fit(l1, ch * 0.38, '700');
    g.fillStyle = '#222';
    g.fillText(l1, cw / 2, ch * 0.34);
    fit(l2, ch * 0.26, '500');
    g.fillStyle = '#555';
    g.fillText(l2, cw / 2, ch * 0.72);
  } else {
    fit(l1, ch * 0.5, '700');
    g.fillStyle = '#222';
    g.fillText(l1, cw / 2, ch * 0.52);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
  sp.scale.set(w, h, 1);
  sp.renderOrder = 10;
  return sp;
}
for (const r of ROOMS) {
  const sp = makeLabel(r.n, `${r.w}' x ${r.d}'  |  ${r.w * r.d} sf`, r.narrow ? 6.2 : 6.6, 2.0);
  sp.position.set(r.lx, 1.2, -r.ly);
  labels.add(sp);
}
for (const z of [
  ['LIVING', 53, 1.6], ['DINING', 40, 7.0], ['KITCHEN', 54, 15.2],
]) {
  const sp = makeLabel(z[0], null, 3.4, 1.0, 0.6);
  sp.position.set(z[1], 1.2, -z[2]);
  labels.add(sp);
}
{
  const sp = makeLabel('ENTRY', null, 3.6, 1.2, 0.9);
  sp.position.set(29.5, 1.2, 3.0 + 0.5);
  labels.add(sp);
  // dimension lines
  const lm = new THREE.LineBasicMaterial({ color: 0x6a6258 });
  const line = (pts) => labels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm));
  line([P(0, -8.5, 0.05), P(60, -8.5, 0.05)]);
  line([P(0, -7.8, 0.05), P(0, -9.2, 0.05)]);
  line([P(60, -7.8, 0.05), P(60, -9.2, 0.05)]);
  line([P(64.5, 0, 0.05), P(64.5, 30, 0.05)]);
  line([P(63.8, 0, 0.05), P(65.2, 0, 0.05)]);
  line([P(63.8, 30, 0.05), P(65.2, 30, 0.05)]);
  const s1 = makeLabel("60' x 30'  =  1,800 sf", null, 8.4, 1.5, 0.95);
  s1.position.set(30, 1.2, 8.5);
  labels.add(s1);
  const s2 = makeLabel("30'", null, 2.6, 1.4, 0.95);
  s2.position.set(64.5, 1.2, -15);
  labels.add(s2);
}

// ---------- views ----------
function sph(target, r, polarDeg, azDeg) {
  const p = (polarDeg * Math.PI) / 180;
  const a = (azDeg * Math.PI) / 180;
  return [target[0] + r * Math.sin(p) * Math.sin(a), target[1] + r * Math.cos(p), target[2] + r * Math.sin(p) * Math.cos(a)];
}
const VIEWS = {
  plan: { target: [33, 0, -10], pos: [33, 84, -10 + 1.6], fov: 35 },
  elevated: { target: [30, 1, -13], pos: sph([30, 1, -13], 92, 52, -14), fov: 35 },
  corner: { target: [30, 1, -14], pos: sph([30, 1, -14], 80, 66, -52), fov: 35 },
};
let tween = null;
function setView(name, instant) {
  const v = VIEWS[name];
  if (!v) return;
  if (instant) {
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  tween = {
    t0: performance.now(), dur: 750,
    fp: camera.position.clone(), ft: controls.target.clone(),
    tp: new THREE.Vector3(...v.pos), tt: new THREE.Vector3(...v.target),
  };
}
window.__setView = (n) => setView(n, true);
window.__setWalls = (full) => { cutaway = !full; buildWalls(); };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
setView(params.get('view') || 'elevated', true);

// ---------- UI ----------
const ui = document.getElementById('ui');
if (params.get('ui') === '0') ui.style.display = 'none';
const $ = (id) => document.getElementById(id);
$('btn-plan').onclick = () => setView('plan');
$('btn-elev').onclick = () => setView('elevated');
$('btn-corner').onclick = () => setView('corner');
$('chk-labels').onchange = (e) => (labels.visible = e.target.checked);
$('chk-furn').onchange = (e) => (furn.visible = e.target.checked);
$('chk-swing').onchange = (e) => (doorsGroup.visible = e.target.checked);
$('chk-full').checked = !cutaway;
$('chk-full').onchange = (e) => { cutaway = !e.target.checked; buildWalls(); };

// ---------- loop ----------
function frame(now) {
  if (tween) {
    let k = Math.min(1, (now - tween.t0) / tween.dur);
    k = k * k * (3 - 2 * k);
    camera.position.lerpVectors(tween.fp, tween.tp, k);
    controls.target.lerpVectors(tween.ft, tween.tt, k);
    if (k >= 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
