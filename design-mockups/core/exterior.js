// Exterior design for the generated house: one small spec drives roof, colors and porch.
//
//   ExteriorSpec = { style, roof: "gable"|"hip"|"flat"|"shed", pitch (rise per 12),
//                    siding, trim, roofColor (hex strings), porch: "none"|"stoop"|"covered",
//                    overhang (ft), flare (ft the eave corners curve up), ridgeCap, finials,
//                    stone (ashlar texture on the walls), tower (crenellated entry tower) (booleans) }
//
// STYLES are presets; every field stays editable. Roof type x pitch x 3 colors x porch already
// gives thousands of distinct exteriors, so there is no need for a library of 3D models: the
// geometry always comes from the floor plan, so it always matches the walls and windows.
//
// parseExteriorPrompt() is a keyword stand-in for the mockups (they run on mock data). In the real
// app, Claude fills the same ExteriorSpec with structured output ("make it a modern farmhouse
// with a red door") and code renders it, the same split as the room program.
import * as THREE from "three";
import { buildHouse, WALL_H } from "./core.js";

// Roof details most styles leave off. Every preset carries them so switching style resets them.
const DETAILS = { overhang: 1.5, flare: 0, ridgeCap: false, finials: false, stone: false, tower: false };

const PRESETS = {
  "Modern farmhouse": { roof: "gable", pitch: 10, siding: "#f5f3ee", trim: "#1d1d1f", roofColor: "#2b2b2e", porch: "covered" },
  Craftsman: { roof: "gable", pitch: 6, siding: "#6f7d62", trim: "#f2ece0", roofColor: "#5a4a3c", porch: "covered" },
  Colonial: { roof: "gable", pitch: 9, siding: "#e9e4da", trim: "#ffffff", roofColor: "#3c3f44", porch: "stoop" },
  Ranch: { roof: "hip", pitch: 4, siding: "#c9b79c", trim: "#ffffff", roofColor: "#6b6258", porch: "stoop" },
  Mediterranean: { roof: "hip", pitch: 4, siding: "#ead8b8", trim: "#7a4a2a", roofColor: "#b5562f", porch: "none" },
  "Modern box": { roof: "flat", pitch: 0, siding: "#f7f7f5", trim: "#2b45f5", roofColor: "#f7f7f5", porch: "stoop" },
  Coastal: { roof: "gable", pitch: 8, siding: "#a9c4d6", trim: "#ffffff", roofColor: "#8a9097", porch: "covered" },
  Scandinavian: { roof: "shed", pitch: 5, siding: "#2e2f31", trim: "#c8a675", roofColor: "#2e2f31", porch: "none" },
  // deep low hip with upturned corners and a heavy ridge, pale plaster walls, dark timber, engawa-style porch
  Japanese: { roof: "hip", pitch: 5, siding: "#ece6d8", trim: "#3b2a1e", roofColor: "#3a3d40", porch: "covered",
    overhang: 3.5, flare: 1.4, ridgeCap: true },
  // all-black, very steep tight gable with spire finials at the peaks
  "Modern gothic": { roof: "gable", pitch: 16, siding: "#1f1f22", trim: "#0e0e10", roofColor: "#2a2a2d", porch: "stoop",
    overhang: 0.6, finials: true },
  // Duke West Campus Collegiate Gothic: mottled Duke Stone walls, steep slate gables, a crenellated
  // entry tower with pinnacles (a nod to Duke Chapel) and Duke Royal Blue window frames and door
  "Duke gothic": { roof: "gable", pitch: 14, siding: "#c9b493", trim: "#00539b", roofColor: "#4b5359", porch: "stoop",
    overhang: 0.6, stone: true, tower: true },
};

export const STYLES = Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { ...DETAILS, ...v }]));
// Other ways people name a preset (regex source, matched on whole words). More specific first:
// "collegiate gothic" must win over plain "gothic".
const STYLE_ALIASES = [
  ["duke( university)?|blue devils?|west campus|collegiate( gothic)?|gothic revival", "Duke gothic"],
  ["(black|dark|modern) gothic|gothic", "Modern gothic"],
  ["japan(ese)?|zen|japandi|tea ?house|pagoda", "Japanese"],
  ["farm ?house", "Modern farmhouse"],
  ["craftsman|bungalow", "Craftsman"],
  ["colonial", "Colonial"],
  ["ranch", "Ranch"],
  ["mediterranean|spanish|tuscan", "Mediterranean"],
  ["(modern|contemporary|minimalist?) box|flat[- ]roofed modern", "Modern box"],
  ["coastal|beach ?house|cape cod", "Coastal"],
  ["scandinavian|nordic|scandi", "Scandinavian"],
];

/** The one exterior preset a piece of text names ("a duke-style 3 bed", "zen cabin"), or null. */
export function matchStyle(text) {
  const t = String(text || "").toLowerCase();
  const exact = Object.keys(STYLES).filter((n) => t.includes(n.toLowerCase())).sort((a, b) => b.length - a.length)[0];
  if (exact) return exact;
  for (const [re, name] of STYLE_ALIASES) if (new RegExp(`\\b(${re})\\b`).test(t)) return name;
  return null;
}

/** Longer wording for the photoreal prompt, where the preset name alone is ambiguous. */
export const STYLE_PROMPTS = {
  "Duke gothic": "Collegiate Gothic home in the style of Duke University's West Campus, built of Duke Stone " +
    "(rough-cut ashlar in mottled tan, gray, ochre and rust), with a dark slate roof, limestone accents, " +
    "a crenellated stone entry tower and Duke blue window frames and front door",
};
const LIMESTONE = "#e4dac6";
export const MAX_PITCH = 18;

export const defaultExterior = () => ({ style: "Modern farmhouse", ...STYLES["Modern farmhouse"] });

const OVERHANG = 1.5;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

// ---------- Duke Stone: random-coursed ashlar, multiplied by the siding color ----------
const STONE_FT = 8; // one texture tile covers 8 x 8 ft
let stoneTex = null;
function stoneTexture() {
  if (stoneTex || typeof document === "undefined") return stoneTex;
  const N = 512, px = N / STONE_FT, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"); let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // near-white tints so the siding color sets the overall hue; blocks vary between gray, ochre and rust
  const tints = [[255, 250, 244], [232, 230, 228], [250, 232, 205], [240, 214, 190], [222, 214, 204], [255, 240, 214]];
  g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, N, N); // mortar
  for (let y = 0; y < N;) {
    const h = Math.round(px * (0.8 + rnd() * 0.9));
    const hh = Math.min(h, N - y);
    for (let x = -Math.round(rnd() * px); x < N;) {
      const w = Math.round(px * (1.2 + rnd() * 1.8));
      const [r, gg, b] = tints[Math.floor(rnd() * tints.length)], k = 0.72 + rnd() * 0.22;
      g.fillStyle = `rgb(${r * k | 0},${gg * k | 0},${b * k | 0})`;
      g.fillRect(x + 2, y + 2, w - 4, hh - 4);
      for (let i = 0; i < 18; i++) { // speckle
        g.fillStyle = `rgba(${rnd() < 0.5 ? "60,50,40" : "255,250,240"},${0.05 + rnd() * 0.08})`;
        g.fillRect(x + 2 + rnd() * (w - 8), y + 2 + rnd() * (hh - 8), 3 + rnd() * 8, 2 + rnd() * 6);
      }
      x += w;
    }
    y += h;
  }
  stoneTex = new THREE.CanvasTexture(c);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.colorSpace = THREE.SRGBColorSpace;
  stoneTex.anisotropy = 8;
  return stoneTex;
}
const stoneMat = (ext) => mat(ext.siding, { map: stoneTexture(), roughness: 0.97 });

/** World-scaled UVs (so stone courses line up across separate wall pieces). off = mesh position. */
function stoneUV(geom, off = { x: 0, z: 0 }) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + off.x, y = pos.getY(i), z = pos.getZ(i) + off.z;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const [u, v] = ny > 0.5 ? [x, z] : nx > 0.5 ? [z, y] : [x, y];
    uv[i * 2] = u / STONE_FT; uv[i * 2 + 1] = v / STONE_FT;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geom;
}

/** Gable / shed end walls: siding color, or stone when the style has it. */
function sidingTri(points, ext) {
  const m = triMesh(points, ext.siding);
  if (ext.stone) { stoneUV(m.geometry); m.material = stoneMat(ext); m.material.side = THREE.DoubleSide; }
  return m;
}

/** Builds a roof surface from triangles (flat-shaded, double-sided so it reads from below too). */
function triMesh(points, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color, { side: THREE.DoubleSide, flatShading: true, roughness: 0.95 }));
}

/**
 * Roof in an "along X" frame: ridge runs along X (the long side), house spans [-L/2, L/2] x [-S/2, S/2]
 * at wall height H. Returns a group the caller rotates 90 deg if the house is deeper than wide.
 */
function roofAlongX(type, L, S, H, pitch, ext) {
  const g = new THREE.Group(), o = ext.overhang ?? OVERHANG, p = pitch / 12;
  const x = L / 2 + o, z = S / 2 + o, eave = H - o * (type === "shed" ? p * 0.4 : p), rise = (S / 2) * p, top = H + rise;
  const rc = ext.roofColor, flare = type === "flat" || type === "shed" ? 0 : ext.flare || 0;
  // roof surface; with flare, the four outer eave corners curve up (Japanese-style upturned eaves)
  const corner = (v) => Math.abs(Math.abs(v[0]) - x) < 1e-6 && Math.abs(Math.abs(v[2]) - z) < 1e-6 && Math.abs(v[1] - eave) < 1e-6;
  const roofTri = (pts) => triMesh(flare ? pts.map((v) => (corner(v) ? [v[0], v[1] + flare, v[2]] : v)) : pts, rc);

  if (type === "flat") {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * x, 0.8, 2 * z), mat(rc));
    slab.position.y = H + 0.4; g.add(slab);
    for (const [px, pz, lx, lz] of [[0, z, 2 * x + 0.3, 0.3], [0, -z, 2 * x + 0.3, 0.3], [x, 0, 0.3, 2 * z + 0.3], [-x, 0, 0.3, 2 * z + 0.3]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lx, 1.1, lz), mat(ext.trim, { roughness: 0.6 }));
      m.position.set(px, H + 0.55, pz); g.add(m);
    }
    return g;
  }

  if (type === "gable") {
    g.add(roofTri([[-x, eave, z], [x, eave, z], [x, top, 0], [-x, eave, z], [x, top, 0], [-x, top, 0]]));
    g.add(roofTri([[-x, eave, -z], [-x, top, 0], [x, top, 0], [-x, eave, -z], [x, top, 0], [x, eave, -z]]));
    // gable-end wall triangles in siding color
    for (const sx of [L / 2, -L / 2]) g.add(sidingTri([[sx, H, S / 2], [sx, H, -S / 2], [sx, top, 0]], ext));
  } else if (type === "hip") {
    const r = Math.max(x - z, 0); // hip ridge is inset by the short half-span on each end
    g.add(roofTri([[-x, eave, z], [x, eave, z], [r, top, 0], [-x, eave, z], [r, top, 0], [-r, top, 0]]));
    g.add(roofTri([[-x, eave, -z], [-r, top, 0], [r, top, 0], [-x, eave, -z], [r, top, 0], [x, eave, -z]]));
    g.add(roofTri([[x, eave, z], [x, eave, -z], [r, top, 0]]));
    g.add(roofTri([[-x, eave, -z], [-x, eave, z], [-r, top, 0]]));
  } else if (type === "shed") {
    // single slope rising from the front (+z) to the back (-z)
    // A shed spans the whole depth in one slope, so use 40% of the nominal pitch (6/12 -> ~7 ft rise
    // on a 35 ft house) instead of the full rise a gable would split over two halves.
    const sp = p * 0.4, hi = H + S * sp, eHi = hi + o * sp;
    g.add(triMesh([[-x, eave, z], [x, eave, z], [x, eHi, -z], [-x, eave, z], [x, eHi, -z], [-x, eHi, -z]], rc));
    for (const sx of [L / 2, -L / 2]) g.add(sidingTri([[sx, H, S / 2], [sx, H, -S / 2], [sx, hi, -S / 2]], ext));
    g.add(sidingTri([[-L / 2, H, -S / 2], [L / 2, H, -S / 2], [L / 2, hi, -S / 2], [-L / 2, H, -S / 2], [L / 2, hi, -S / 2], [-L / 2, hi, -S / 2]], ext));
  }
  // fascia boards along the eaves (left off when the corners flare up: a straight board would float)
  if (!flare) for (const sz of type === "shed" ? [z] : [z, -z]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2 * x, 0.5, 0.15), mat(ext.trim, { roughness: 0.6 }));
    f.position.set(0, eave - 0.1, sz); g.add(f);
  }
  const ridgeX = type === "hip" ? Math.max(x - z, 0) : x; // half-length of the ridge line
  if (ext.ridgeCap && type !== "shed" && ridgeX > 0) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2 * ridgeX + 0.8, 0.9, 0.9), mat(rc, { roughness: 0.8 }));
    cap.position.y = top + 0.25; g.add(cap);
    for (const sx of [ridgeX, -ridgeX]) { // raised end ornaments on the ridge
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 1.1), mat(rc, { roughness: 0.8 }));
      end.position.set(sx + Math.sign(sx) * 0.4, top + 0.7, 0); g.add(end);
    }
  }
  if (ext.finials && type !== "shed") {
    for (const sx of type === "hip" ? [ridgeX, -ridgeX] : [x, -x]) {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 4.5, 8), mat(ext.trim, { roughness: 0.4, metalness: 0.6 }));
      spire.position.set(sx, top + 2.1, 0); g.add(spire);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat(ext.trim, { roughness: 0.4, metalness: 0.6 }));
      ball.position.set(sx, top + 0.25, 0); g.add(ball);
    }
  }
  return g;
}

function roof(W, D, H, ext) {
  const alongX = W >= D;
  const g = roofAlongX(ext.roof, alongX ? W : D, alongX ? D : W, H, ext.roof === "flat" ? 0 : ext.pitch, ext);
  if (!alongX) g.rotation.y = Math.PI / 2;
  return g;
}

function porch(layout, ext) {
  const g = new THREE.Group();
  if (ext.porch === "none") return g;
  const { width_ft: W, depth_ft: D } = layout.footprint, e = layout.entrance;
  const horiz = Math.abs(e.y - D) < 0.01 || Math.abs(e.y) < 0.01;
  const covered = ext.porch === "covered";
  const pw = covered ? 14 : 8, pd = covered ? 7 : 5;
  const out = Math.abs(e.y - D) < 0.01 || Math.abs(e.x - W) < 0.01 ? 1 : -1; // which way is outside
  const [lx, lz] = horiz ? [pw, pd] : [pd, pw];
  const cx = (horiz ? e.x : (out > 0 ? W : 0) + out * pd / 2) - W / 2;
  const cz = (horiz ? (out > 0 ? D : 0) + out * pd / 2 : e.y) - D / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.5, lz), mat(0xc9c5bc, { roughness: 1 }));
  slab.position.set(cx, -0.25, cz); g.add(slab);
  if (covered) {
    const ph = 8.2;
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(lx + 0.6, 0.4, lz + 0.6), mat(ext.roofColor));
    roofSlab.position.set(cx, ph + 0.2, cz); g.add(roofSlab);
    // two posts on the outer edge
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, ph, 0.5), mat(ext.trim, { roughness: 0.6 }));
      const along = s * ((horiz ? lx : lz) / 2 - 0.6);
      post.position.set(horiz ? cx + along : cx + out * (lx / 2 - 0.4), ph / 2, horiz ? cz + out * (lz / 2 - 0.4) : cz + along);
      g.add(post);
    }
  }
  return g;
}

/**
 * Crenellated stone tower straddling the front corner nearest the door (skipping a corner the door
 * is too close to): battlements, corner pinnacles, lancet slits and a Duke blue pennant.
 */
function tower(layout, ext) {
  const g = new THREE.Group();
  const { width_ft: W, depth_ft: D } = layout.footprint, e = layout.entrance, T = 11;
  const p = (ext.roof === "flat" ? 0 : ext.pitch) / 12, top = WALL_H + (Math.min(W, D) / 2) * (ext.roof === "shed" ? 0.8 * p : p);
  const th = Math.max(top + 7, WALL_H + 10);
  const onH = Math.abs(e.y) < 0.01 || Math.abs(e.y - D) < 0.01; // door on a front/back (x-running) wall
  let cx = e.x < W / 2 ? 0 : W, cz = e.y < D / 2 ? 0 : D;
  if (onH && Math.abs(e.x - cx) < T / 2 + 2.5) cx = W - cx;
  if (!onH && Math.abs(e.y - cz) < T / 2 + 2.5) cz = D - cz;
  const at = { x: cx - W / 2, z: cz - D / 2 };
  const stone = ext.stone ? stoneMat(ext) : mat(ext.siding), lime = mat(LIMESTONE, { roughness: 0.8 });
  const box = (w, h, d, x, y, z, m = stone) => {
    const geo = new THREE.BoxGeometry(w, h, d); geo.translate(x, y, z);
    const mesh = new THREE.Mesh(m === stone && ext.stone ? stoneUV(geo, at) : geo, m);
    mesh.position.set(at.x, 0, at.z); g.add(mesh); return mesh;
  };
  box(T, th + 0.5, T, 0, (th - 0.5) / 2, 0);
  box(T + 0.7, 0.7, T + 0.7, 0, th + 0.35, 0, lime); // limestone string course under the battlements
  const mh = 1.8, step = 2.2, n = Math.floor(T / step);
  for (let i = 0; i <= n; i++) { // merlons on all four sides
    const a = -T / 2 + 0.4 + (i * (T - 0.8)) / n;
    for (const [x, z] of [[a, T / 2], [a, -T / 2], [T / 2, a], [-T / 2, a]]) box(1.1, mh, 1.1, x, th + 0.7 + mh / 2, z);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // pinnacles
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4, 4), lime);
    pin.position.set(at.x + sx * (T / 2), th + 0.7 + mh + 2, at.z + sz * (T / 2)); pin.rotation.y = Math.PI / 4; g.add(pin);
  }
  const slit = mat(0x1d2433, { roughness: 0.3, metalness: 0.4 });
  for (const [x, z, w, d] of [[0, T / 2 + 0.05, 1.3, 0.1], [0, -T / 2 - 0.05, 1.3, 0.1], [T / 2 + 0.05, 0, 0.1, 1.3], [-T / 2 - 0.05, 0, 0.1, 1.3]]) {
    box(w, 4.5, d, x, th - 4.5, z, slit); // lancet slits
    box(w + (w > 1 ? 0.6 : 0.12), 0.45, d + (d > 1 ? 0.6 : 0.12), x, th - 2, z, lime); // drip mould
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), mat(0x2b2b2e, { metalness: 0.7, roughness: 0.4 }));
  pole.position.set(at.x, th + 0.7 + 3, at.z); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), mat("#00539b", { side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(at.x + 1.65, th + 0.7 + 5, at.z); g.add(flag);
  return g;
}

/** Full exterior house (feet, centered on the footprint) for a layout + ExteriorSpec. */
export function buildExteriorHouse(layout, ext) {
  const { width_ft: W, depth_ft: D } = layout.footprint;
  const siding = new THREE.Color(ext.siding).getHex(), trim = new THREE.Color(ext.trim).getHex();
  const h = buildHouse(layout, { exteriorWallColor: siding, wallColor: 0xfaf9f6, frameColor: trim });
  const g = new THREE.Group(); g.add(h.group);
  if (ext.stone) {
    const sm = stoneMat(ext);
    for (const w of h.walls) if (w.userData.seg?.exterior) { stoneUV(w.geometry, w.position); w.material = sm; }
  }
  if (ext.tower) g.add(tower(layout, ext));
  const found = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 3, D + 0.6), mat(0xa9a69f, { roughness: 1 }));
  found.position.y = -1.76; g.add(found);
  g.add(porch(layout, ext));
  g.add(roof(W, D, WALL_H, ext));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- plain-English edits (mock stand-in for Claude structured output) ----------

const COLORS = {
  white: "#f5f3ee", black: "#1d1d1f", charcoal: "#2e2f31", gray: "#8a8d91", grey: "#8a8d91",
  navy: "#1f2f4f", blue: "#4f78a8", "light blue": "#a9c4d6", red: "#9b2f2a", brick: "#8e3b2c",
  green: "#3f5f45", sage: "#6f7d62", olive: "#6b6a3a", tan: "#c9b79c", beige: "#e3d6bd",
  cream: "#f2ece0", brown: "#5a4a3c", wood: "#c8a675", yellow: "#e8c95a", terracotta: "#b5562f",
};
const PART = [
  [/\b(roof|shingles?)\b/, "roofColor"],
  [/\b(trim|windows?|frames?|fascia|shutters?|door)\b/, "trim"],
  [/\b(siding|walls?|house|exterior|paint)\b/, "siding"],
];

/** Applies an edit like "craftsman, steeper hip roof, navy siding and white trim" to a spec. */
export function parseExteriorPrompt(text, ext) {
  const next = { ...ext }, changes = [];
  const t = text.toLowerCase();
  const name = matchStyle(t);
  if (name) { Object.assign(next, STYLES[name], { style: name }); changes.push(name); }
  for (const r of ["gable", "hip", "flat", "shed"]) {
    if (new RegExp(`\\b${r}\\b`).test(t)) { next.roof = r; if (r !== "flat" && !next.pitch) next.pitch = 6; changes.push(`${r} roof`); }
  }
  if (/steeper|taller roof|higher pitch/.test(t)) { next.pitch = Math.min(MAX_PITCH, next.pitch + 3); changes.push("steeper"); }
  if (/flatter|lower pitch|shallower/.test(t)) { next.pitch = Math.max(2, next.pitch - 3); changes.push("lower pitch"); }
  if (/no porch|remove (the )?porch/.test(t)) { next.porch = "none"; changes.push("no porch"); }
  else if (/covered porch|front porch|wraparound|veranda/.test(t)) { next.porch = "covered"; changes.push("covered porch"); }
  else if (/\bstoop\b/.test(t)) { next.porch = "stoop"; changes.push("stoop"); }
  // colors: per clause, "navy siding", "roof in red", "white trim"
  for (const clause of t.split(/,|;|\band\b|\bwith\b/)) {
    const color = Object.keys(COLORS).sort((a, b) => b.length - a.length).find((c) => new RegExp(`\\b${c}\\b`).test(clause));
    if (!color) continue;
    const part = PART.find(([re]) => re.test(clause))?.[1] ?? "siding";
    next[part] = COLORS[color]; changes.push(`${color} ${part === "roofColor" ? "roof" : part}`);
  }
  if (changes.length && !changes.some((c) => STYLES[c])) next.style = "Custom";
  return { spec: next, changes };
}
