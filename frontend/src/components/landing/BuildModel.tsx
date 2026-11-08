"use client";
// BUILD's card in the comparison: the real app engine (src/build/core.js) rendering the sample
// solver layout with the app's coloured furniture. When the card scrolls into view the floors lay
// down, the walls rise, and the furniture drops in room by room, then the model turns slowly.
// "plan" lowers the walls to a cut-plan height and looks straight down; "3d" is the oblique view.
import { useEffect, useRef } from "react";
import type { Layout } from "@/lib/types";
import type * as T3 from "three";

type View = "plan" | "3d";
const FLOOR: Record<string, number> = {
  living: 0xe7d8bd, kitchen: 0xe2dfd7, dining: 0xe6d4b6, bedroom: 0xecdfc8, primary_bedroom: 0xe9d7ba,
  bathroom: 0xd9e2e5, office: 0xe0d1b6, laundry: 0xdde1da, hall: 0xf0e9db, entry: 0xf0e9db, closet: 0xe6e1d6,
};
const PLAN_CUT = 1.6, WALL_TOP = 6.2; // ft; a dollhouse cut so the rooms and furniture read from above

export function BuildModel({ layout, view, label }: { layout: Layout; view: View; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(view);
  const api = useRef<{ setView: (v: View) => void; replay: () => void } | null>(null);
  useEffect(() => { viewRef.current = view; api.current?.setView(view); }, [view]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    let disposed = false, raf = 0, cleanup = () => {};
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      const THREE = await import("three");
      const { RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core: any = await import("@/build/core.js");
      const { enhanceRenderer, fitSun } = await import("@/build/render.js");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio));
      renderer.localClippingEnabled = true;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      enhanceRenderer(renderer, scene, { exposure: 0.92, envIntensity: 0.35 });
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d2c4, 0.55));
      const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
      const W = layout.footprint.width_ft, D = layout.footprint.depth_ft;
      sun.position.set(-W * 0.6, 60, D * 0.9); fitSun(sun, W, D, { size: 1024 });
      scene.add(sun);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(Math.max(W, D) * 0.95, 64), new THREE.ShadowMaterial({ opacity: 0.12 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.26; ground.receiveShadow = true; scene.add(ground);

      // walls, windows and frames are cut by one horizontal plane: raising it builds the house
      const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      const house = core.buildHouse(layout, { floorColor: (r: { type: string }) => FLOOR[r.type] ?? 0xe9e6df, wallColor: 0xfbfaf7, frameColor: 0xf1ede5, glassColor: 0xbcd3ea });
      const edge = new THREE.LineBasicMaterial({ color: 0xc8c4bb, clippingPlanes: [cut] });
      for (const w of house.walls) w.add(new THREE.LineSegments(new THREE.EdgesGeometry(w.geometry), edge));
      house.group.traverse((o: T3.Object3D) => {
        const m = (o as T3.Mesh).material as T3.Material | undefined;
        if (m && !Object.values(house.floors).includes(o)) { m.clippingPlanes = [cut]; m.clipShadows = true; }
        if ((o as T3.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      scene.add(house.group);
      // plan view: the cut walls drawn as solid ink, like a drawn floor plan (fades in with "plan")
      const poche = new THREE.MeshBasicMaterial({ color: 0x24282b, transparent: true, opacity: 0, depthWrite: false });
      const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
      for (const w of house.walls as T3.Mesh[]) {
        box.setFromObject(w); box.getSize(size); box.getCenter(mid);
        const q = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.z), poche);
        q.rotation.x = -Math.PI / 2; q.position.set(mid.x, 0.04, mid.z); q.renderOrder = 2; scene.add(q);
      }
      const furn: { group: T3.Group; byRoom: Record<string, T3.Group> } = core.buildFurniture(layout, core.FURNITURE_STYLES.colorful, { roundedBox: RoundedBoxGeometry, items: true });
      furn.group.traverse((o: T3.Object3D) => { if ((o as T3.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(furn.group);

      // room order: front door outwards, roughly how the app's agent works through the house
      const rooms = [...layout.rooms].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
      const floorOf = (id: string) => house.floors[id] as T3.Mesh;
      type Piece = { obj: T3.Object3D; home: T3.Vector3; t0: number };
      const pieces: Piece[] = [];
      rooms.forEach((r, ri) => {
        const g = furn.byRoom[r.id] as T3.Group | undefined; if (!g) return;
        g.children.forEach((it: T3.Object3D, i: number) => pieces.push({ obj: it, home: it.position.clone(), t0: 2.1 + ri * 0.32 + i * 0.07 }));
      });
      const END = (pieces.at(-1)?.t0 ?? 3) + 0.9;

      const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
      const span = Math.max(W, D);
      const pose = { yaw: 0.35, pitch: 0.86, dist: span * 1.8, cut: WALL_TOP };
      const target = { ...pose };
      const setView = (v: View) => {
        if (v === "plan") Object.assign(target, { pitch: 1.5, dist: span * 1.62, cut: PLAN_CUT });
        else Object.assign(target, { pitch: 0.86, dist: span * 1.8, cut: WALL_TOP });
      };
      setView(viewRef.current);
      Object.assign(pose, target);

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = el;
        renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(el);

      let start = -1, visible = false, last = performance.now();
      const replay = () => { start = performance.now(); };
      api.current = { setView, replay };
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && start < 0) start = reduced ? performance.now() - END * 1000 : performance.now();
        if (visible) { last = performance.now(); loop(); }
      }, { threshold: 0.35 });
      io.observe(el);

      const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
      const bounce = (k: number) => { k = Math.min(1, Math.max(0, k)); const s = 1.70158 * 1.4; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };

      function frame(now: number) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const t = start < 0 ? 0 : (now - start) / 1000;
        // floors lay down, then walls rise, then furniture drops in
        rooms.forEach((r, i) => { const f = floorOf(r.id); if (f) { const k = ease((t - 0.1 - i * 0.07) / 0.45); f.scale.set(k || 0.001, 1, k || 0.001); f.visible = k > 0; } });
        const rise = ease((t - 0.9) / 1.3);
        const k = 1 - Math.exp(-dt * 5);
        pose.pitch += (target.pitch - pose.pitch) * k; pose.dist += (target.dist - pose.dist) * k; pose.cut += (target.cut - pose.cut) * k;
        cut.constant = 0.02 + rise * pose.cut;
        poche.opacity = rise * Math.max(0, Math.min(1, (WALL_TOP - pose.cut) / (WALL_TOP - PLAN_CUT)));
        for (const p of pieces) {
          const u = (t - p.t0) / 0.6;
          p.obj.visible = u > 0;
          if (u > 0) { const b = bounce(u); p.obj.position.set(p.home.x, p.home.y + (1 - b) * 9, p.home.z); p.obj.scale.setScalar(0.6 + 0.4 * Math.min(1, b)); }
        }
        // a slow turn once it is built (the plan view keeps north up)
        const swayT = viewRef.current === "3d" ? 0.35 + Math.sin(Math.max(0, t - END) * 0.35) * 0.32 : 0;
        pose.yaw += (swayT - pose.yaw) * k;
        const yaw = pose.yaw;
        const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
        const fit = Math.max(1, 1.3 / camera.aspect);
        camera.position.set(Math.sin(yaw) * cp * pose.dist * fit, sp * pose.dist * fit, Math.cos(yaw) * cp * pose.dist * fit);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      function loop() {
        cancelAnimationFrame(raf);
        const tick = (now: number) => { if (disposed || !visible) return; frame(now); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }
      el.dataset.ready = "1";

      cleanup = () => {
        io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf);
        scene.traverse((o: T3.Object3D) => { (o as T3.Mesh).geometry?.dispose(); });
        renderer.dispose(); renderer.domElement.remove();
      };
    })();
    return () => { disposed = true; cleanup(); api.current = null; };
  }, [layout]);

  return (
    <div className="bl-cmp-3d" ref={host} role="img" aria-label={label}>
      <button type="button" className="bl-cmp-replay" onClick={() => api.current?.replay()}>Build it again</button>
    </div>
  );
}
