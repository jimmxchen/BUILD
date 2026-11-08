// Imperative three.js scene for the scroll walkthrough. Built from the app's own modules:
// buildHouse / buildFurniture (src/build/core.js), the Site model island (atmosphere.js) and the
// app's renderer setup (render.js), all fed the bundled sample Layout.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildFurniture, buildHouse, FURNITURE_STYLES } from "@/build/core";
import { createFloatingIsland } from "@/build/atmosphere";
import { enhanceRenderer, fitSun } from "@/build/render";
import type { Layout } from "@/lib/types";
import { KEYS, poseAt } from "./walkPath";

// Site model app palette (siteModelApp.js FLOOR / ISLAND_LOOK), with the furniture's blue accents
// swapped for the green site palette.
const FLOOR: Record<string, number> = { living: 0xe7d8bd, kitchen: 0xe2dfd7, dining: 0xe6d4b6, bedroom: 0xecdfc8, primary_bedroom: 0xe9d7ba, bathroom: 0xd9e2e5, office: 0xe0d1b6, laundry: 0xdde1da, hall: 0xf0e9db, entry: 0xf0e9db, closet: 0xe6e1d6 };
const ISLAND = { seed: 4, trees: 10, grass: 0xb3cd96, grassEdge: 0x98b77c, dirt: 0xcdb592, rock: 0xb4a593, rockDark: 0x8f8273, path: 0xfbfaf7, trunk: 0xb39270, leaf: [0x8fb879, 0xa5c78a, 0x7aa766], shard: 0xfbfaf7 };
const colorful = FURNITURE_STYLES.colorful;
const STYLE = { ...colorful, accent: 0x6f8f7b, art: 0x7aa766, perRoom: { ...colorful.perRoom, bedroom_4: { ...colorful.perRoom.bedroom_4, art: 0xc8664f } } };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ramp = (a: number, b: number, t: number) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

export interface WalkView { x: number; y: number; heading: number; height: number }
export interface WalkScene {
  setProgress(p: number, immediate?: boolean): void;
  resize(): void;
  setActive(on: boolean): void;
  /** Fraction of the stage width the footprint occupies in the SVG blueprint, so the overhead
   *  camera frames the house at the same size and the crossfade between them doesn't jump. */
  setPlanFit(frac: number): void;
  dispose(): void;
}

function skyTexture() {
  const c = document.createElement("canvas"); c.width = 2; c.height = 512;
  const g = c.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#c6daf0"); gr.addColorStop(0.42, "#dde8f3"); gr.addColorStop(0.78, "#eef1f2"); gr.addColorStop(1, "#F6F5F1");
  g.fillStyle = gr; g.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createWalkScene(container: HTMLElement, layout: Layout, opts: {
  mobile: boolean; onView?: (v: WalkView) => void; onFirstFrame?: () => void; onContextLost?: () => void;
}): WalkScene {
  // core.js types its layout from the mock planner (with an optional `open` list); the contract Layout is compatible
  const coreLayout = layout as unknown as Parameters<typeof buildHouse>[0];
  const { width_ft: W, depth_ft: D } = layout.footprint;
  const ox = -W / 2, oz = -D / 2;

  const renderer = new THREE.WebGLRenderer({ antialias: !opts.mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.5 : 1.75));
  renderer.domElement.className = "bl-walk-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  const env = enhanceRenderer(renderer, scene, { exposure: 0.98, envIntensity: 0.38 });
  scene.fog = new THREE.Fog(0xe7edf3, 160, 420);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 600);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc6b6, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.9);
  sun.position.set(-34, 88, 30);
  fitSun(sun, W, D, { size: opts.mobile ? 1024 : 2048, radius: 5 });
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 220; sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  // island under the house, trees cleared from the walk-up corridor in front of the door
  const island = createFloatingIsland(W, D, { ...ISLAND, entrance: [layout.entrance.x + ox, layout.entrance.y + oz] });
  island.group.position.y = -0.62;
  island.group.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  for (const t of [...island.parts.props.children] as THREE.Object3D[]) {
    const nearHouse = Math.abs(t.position.x) < W / 2 + 7 && Math.abs(t.position.z) < D / 2 + 7;
    const inApproach = Math.abs(t.position.x - (layout.entrance.x + ox)) < 12 && t.position.z > 0;
    if (nearHouse || inApproach) { island.parts.props.remove(t); continue; }
    if (t.userData.sway !== undefined) t.scale.setScalar(0.72);
  }
  island.update(0);
  scene.add(island.group);

  const house = buildHouse(coreLayout, {
    floorColor: (r: { type: string }) => FLOOR[r.type] ?? 0xe9e6df,
    wallColor: 0xfbfaf7, frameColor: 0xf1ede5, glassColor: 0xbcd3ea, ceilingColor: 0xf7f4ee,
  });
  scene.add(house.group);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xc8c4bb, transparent: true });
  for (const w of house.walls as THREE.Mesh[]) w.add(new THREE.LineSegments(new THREE.EdgesGeometry(w.geometry), edgeMat));
  const doorFrames = house.doorFrames as THREE.Mesh[];
  const floors = Object.values(house.floors) as THREE.Mesh[];
  const floorTarget = floors.map((f) => (f.material as THREE.MeshStandardMaterial).color.clone());
  const paper = new THREE.Color(0xfbfaf7);

  // core.js infers its option types from defaults; it accepts { roundedBox } at runtime (see siteModelApp.js)
  const furnish = buildFurniture as unknown as (l: unknown, s: unknown, o: unknown) => { group: THREE.Group; items: THREE.Object3D[] };
  const furn = furnish(coreLayout, STYLE, { roundedBox: RoundedBoxGeometry, items: true });
  scene.add(furn.group);
  // keep the eye-level route clear: drop any piece the camera would pass through or brush
  {
    furn.group.updateMatrixWorld(true);
    const route: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= 600; i++) { poseAt(0.44 + (0.56 * i) / 600, v); if (v.y < 9) route.push(new THREE.Vector3(v.x + ox, v.y, v.z + oz)); }
    const box = new THREE.Box3();
    for (const item of furn.items ?? []) {
      box.setFromObject(item).expandByScalar(0.9);
      if (route.some((r) => box.containsPoint(r))) item.visible = false;
    }
  }

  // warm interior lights for the eye-level part of the route
  const roomLights = layout.rooms.filter((r) => r.type !== "closet").map((r) => {
    const l = new THREE.PointLight(0xffd6a0, 0, Math.max(r.w, r.h) + 10, 1.2);
    l.position.set(ox + r.x + r.w / 2, 7.4, oz + r.y + r.h / 2);
    scene.add(l); return l;
  });

  // blueprint overlay: the plan's wall lines, visible while the walls are still flat
  const lineGeo = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (const s of house.segs as { x1: number; y1: number; x2: number; y2: number }[]) pts.push(ox + s.x1, 0.06, oz + s.y1, ox + s.x2, 0.06, oz + s.y2);
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x151515, transparent: true });
  const blueprint = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(blueprint);

  // ---------- state ----------
  let planFit = 0.55;
  let target = 0, current = 0, active = true, raf = 0, last = 0, first = true, disposed = false, applied = -1;
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), fwd = new THREE.Vector3();

  function apply(p: number) {
    // 1-2: walls rise from the plan, materials go from drafting white to finished
    const rise = Math.max(0.012, ramp(0.13, 0.3, p));
    for (const w of house.walls as THREE.Mesh[]) w.scale.y = rise;
    for (const d of doorFrames) { d.visible = rise > 0.97; }
    for (const g of house.windows as THREE.Mesh[]) g.visible = rise > 0.6;
    const finish = ramp(0.16, 0.34, p);
    floors.forEach((f, i) => (f.material as THREE.MeshStandardMaterial).color.copy(paper).lerp(floorTarget[i], 0.55 + 0.45 * finish));
    const furnIn = ramp(0.26, 0.4, p);
    furn.group.visible = furnIn > 0.01;
    furn.group.scale.set(1, Math.max(0.01, furnIn), 1);
    lineMat.opacity = 1 - ramp(0.12, 0.22, p);
    blueprint.visible = lineMat.opacity > 0.01;
    edgeMat.opacity = 0.35 + 0.65 * ramp(0.2, 0.3, p);
    // camera
    poseAt(p, pos, quat);
    camera.position.set(pos.x + ox, pos.y, pos.z + oz);
    camera.quaternion.copy(quat);
    // overhead: height that frames the footprint exactly like the SVG blueprint underneath
    const aspect = camera.aspect;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(50 / 2));
    const hTop = W / (planFit * 2 * tanHalf * aspect);
    camera.position.y += (hTop - KEYS[1].pos[1]) * (1 - ramp(0.12, 0.3, p));
    // narrow screens: pull the oblique views back so the whole house stays in frame
    if (aspect < 1.1) {
      const k = ramp(0.12, 0.22, p) * (1 - ramp(0.36, 0.46, p)) * (1.1 / Math.max(0.45, aspect) - 1);
      camera.getWorldDirection(fwd);
      camera.position.addScaledVector(fwd, -60 * k);
    }
    const inside = pos.y < 9.5;
    (house.ceilings as THREE.Group).visible = pos.y < 10.5 && p > 0.4;
    // 3-4: daylight interior, warm practicals at eye level
    const interior = ramp(0.46, 0.56, p);
    for (const l of roomLights) l.intensity = 9 * interior;
    sun.intensity = 2.9 - 0.6 * interior;
    renderer.toneMappingExposure = 0.98 + 0.14 * interior;
    hemi.intensity = 0.7 + 0.25 * interior;
    camera.fov = 50 + 8 * interior;
    camera.updateProjectionMatrix();
    camera.getWorldDirection(fwd);
    opts.onView?.({ x: pos.x, y: pos.z, heading: Math.atan2(fwd.x, -fwd.z), height: inside ? pos.y : pos.y });
  }

  function frame(now: number) {
    raf = 0;
    if (disposed || !active) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    // frame-rate independent exponential smoothing toward the scroll target
    current += (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 0.00005) current = target;
    if (current !== applied || first) {
      apply(current); applied = current;
      renderer.render(scene, camera);
      if (first) { first = false; opts.onFirstFrame?.(); }
    }
    if (current !== target) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const kick = () => { if (!raf && active && !disposed) raf = requestAnimationFrame(frame); };

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applied = -1; kick();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const onLost = (e: Event) => { e.preventDefault(); opts.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  return {
    setProgress(p, immediate = false) {
      target = clamp01(p);
      if (immediate) { current = target; applied = -1; }
      kick();
    },
    resize,
    setPlanFit(frac) { if (frac > 0.05 && Math.abs(frac - planFit) > 0.002) { planFit = frac; applied = -1; kick(); } },
    setActive(on) { active = on; if (on) { applied = -1; last = 0; kick(); } },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) geos.add(m.geometry);
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); });
      sky.dispose(); env?.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
