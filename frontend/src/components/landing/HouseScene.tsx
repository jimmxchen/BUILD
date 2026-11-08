"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { BufferGeometry, Material, Mesh } from "three";
import { createFloatingIsland } from "@/build/atmosphere";
import { cameraAt, layout, walls } from "./geometry";

function Camera({ progress }: { progress: number }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [progress, invalidate]);
  useFrame(({ camera, size }) => {
    const view = cameraAt(progress);
    // Fit the wide floor plan on narrow screens without changing the interior path.
    if (size.width < 650) {
      const t = Math.min(1, progress * 7);
      const weight = 1 - t * t * (3 - 2 * t);
      view.position.x += 8 * weight; view.position.y += 20 * weight; view.position.z += 12 * weight;
    }
    camera.position.copy(view.position);
    camera.lookAt(view.target);
    camera.updateMatrixWorld();
  });
  return null;
}
function Block({ at, size, color }: { at: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}
// Reuse the selected app's procedural island without mounting or changing its UI.
function SiteIsland() {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    const { width_ft: width, depth_ft: depth } = layout.footprint;
    const island = createFloatingIsland(width, depth, {
      seed: 4, trees: 10, grass: 0xb3cd96, grassEdge: 0x98b77c,
      dirt: 0xcdb592, rock: 0xb4a593, rockDark: 0x8f8273,
      path: 0xfbfaf7, trunk: 0xb39270, leaf: [0x8fb879, 0xa5c78a, 0x7aa766],
      shard: 0xfbfaf7, entrance: [layout.entrance.x - width / 2, layout.entrance.y - depth / 2],
    });
    island.group.position.set(width / 2, -0.62, depth / 2);
    for (const tree of [...island.parts.props.children]) {
      if (Math.abs(tree.position.x) < width / 2 + 7 && Math.abs(tree.position.z) < depth / 2 + 7) tree.visible = false;
      if (tree.userData.sway !== undefined) tree.scale.setScalar(0.72);
    }
    island.update(0);
    scene.add(island.group);
    invalidate();
    return () => {
      scene.remove(island.group);
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      island.group.traverse(object => {
        if (object instanceof Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    };
  }, [scene, invalidate]);
  return null;
}
function HouseWalls() {
  const windows = layout.windows.flatMap(window => {
    const room = layout.rooms.find(r => r.id === window.room);
    if (!room) return [];
    const horizontal = window.wall === "north" || window.wall === "south";
    const line = horizontal ? room.y + (window.wall === "south" ? room.h : 0) : room.x + (window.wall === "east" ? room.w : 0);
    const start = (horizontal ? room.x : room.y) + window.offset_ft;
    return [{ horizontal, line, start, end: start + window.width_ft }];
  });
  return <>{walls.flatMap((wall, index) => {
    const horizontal = wall.y1 === wall.y2;
    const line = horizontal ? wall.y1 : wall.x1;
    const start = horizontal ? wall.x1 : wall.y1;
    const end = horizontal ? wall.x2 : wall.y2;
    const openings = windows.filter(w => w.horizontal === horizontal && w.line === line && w.start >= start && w.end <= end).sort((a, b) => a.start - b.start);
    const blocks = [];
    const panel = (a: number, b: number, bottom: number, height: number, color: string, key: string) => <Block key={key} at={horizontal ? [(a + b) / 2, bottom + height / 2, line] : [line, bottom + height / 2, (a + b) / 2]} size={horizontal ? [b - a, height, 0.33] : [0.33, height, b - a]} color={color} />;
    let cursor = start;
    openings.forEach((window, i) => {
      if (window.start > cursor) blocks.push(panel(cursor, window.start, 0, 9, "#fbfaf7", index + "side" + i));
      blocks.push(panel(window.start, window.end, 0, 3, "#fbfaf7", index + "base" + i));
      blocks.push(panel(window.start, window.end, 7, 2, "#fbfaf7", index + "top" + i));
      blocks.push(panel(window.start, window.end, 3, 0.12, "#7f94b1", index + "sill" + i));
      blocks.push(panel((window.start + window.end) / 2 - 0.05, (window.start + window.end) / 2 + 0.05, 3, 4, "#7f94b1", index + "mullion" + i));
      cursor = window.end;
    });
    if (cursor < end) blocks.push(panel(cursor, end, 0, 9, wall.exterior ? "#fdfdfc" : "#f1ede5", index + "end"));
    return blocks;
  })}</>;
}
export default function HouseScene({ progress = 0, onFailure }: { progress?: number; onFailure: () => void }) {
  return <Canvas frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [60, 43, 54], near: 0.1, far: 500, fov: 48 }} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => {
    gl.domElement.addEventListener("webglcontextlost", onFailure, { once: true });
  }}>
    <Camera progress={progress} />
    <ambientLight intensity={0.6} /><hemisphereLight args={["#ffffff", "#cfc6b6", 0.7]} />
    <directionalLight position={[15, 60, 25]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-bias={-0.001} />
    <SiteIsland />
    <Block at={[30.5, -0.25, 14]} size={[62, 0.3, 29]} color="#fbfaf7" />
    {layout.rooms.map(r => <Block key={r.id} at={[r.x + r.w / 2, 0, r.y + r.h / 2]} size={[r.w - 0.03, 0.15, r.h - 0.03]} color={r.type === "hall" ? "#f0e9db" : r.type.includes("bedroom") ? "#e9d7ba" : r.type === "bathroom" ? "#d9e2e5" : "#e7d8bd"} />)}
    <HouseWalls />
    {/* Furnishings sit outside the camera corridors; schematic, not a generated render. */}
    <Block at={[4, 0.8, 23]} size={[6, 1.6, 3]} color="#536b98" /><Block at={[4, 1.8, 24.2]} size={[6, 2, 0.6]} color="#536b98" /><Block at={[1.2, 1.5, 23]} size={[0.5, 1.7, 3]} color="#536b98" /><Block at={[6.8, 1.5, 23]} size={[0.5, 1.7, 3]} color="#536b98" />
    <Block at={[4, 0.55, 19]} size={[4, 1.1, 2]} color="#d3b58f" />
    <Block at={[7, 1.5, 1.8]} size={[10, 3, 2]} color="#c2b398" /><Block at={[7, 3.08, 1.8]} size={[10.2, 0.16, 2.2]} color="#f5f4ed" /><Block at={[3, 1.5, 7]} size={[3, 3, 5]} color="#c2b398" /><Block at={[3, 3.08, 7]} size={[3.2, 0.16, 5.2]} color="#f5f4ed" />
    <Block at={[24, 1.3, 4]} size={[5, 2.6, 3]} color="#c2b398" />
    {layout.rooms.filter(r => r.type.includes("bedroom")).map(r => <Block key={r.id} at={[r.x + r.w / 2, 1, r.y + 4]} size={[5, 2, 6]} color="#f9fafc" />)}

  </Canvas>;
}
