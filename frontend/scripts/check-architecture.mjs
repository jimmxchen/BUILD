import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWalls, buildHouse, buildFurniture, planSVG } from '../src/build/core.js';
import { buildWallSegments } from '../src/lib/wallTopology.js';
import { courtGeometry, roomExtras, courtPlanSVG } from '../src/build/roomRenderers.js';
const load = name => JSON.parse(fs.readFileSync(new URL(`../../docs/architecture/after/${name}-layout.json`,import.meta.url)));
for (const name of ['warehouse_8bed','conventional_3bed','open_loft','small_home_dining','large_kitchen','multiple_workspaces']) {
  const layout=load(name), segments=buildWalls(layout);
  assert.deepEqual(segments,buildWallSegments(layout));
  for(const s of segments) for(const r of layout.rooms) {
    const horizontal=s.y1===s.y2;
    const crosses=horizontal ? s.y1>r.y+.01&&s.y1<r.y+r.h-.01&&Math.min(s.x2,r.x+r.w)>Math.max(s.x1,r.x)+.01 : s.x1>r.x+.01&&s.x1<r.x+r.w-.01&&Math.min(s.y2,r.y+r.h)>Math.max(s.y1,r.y)+.01;
    assert.equal(crosses,false,`${name}: interior wall in ${r.id}`);
  }
  const house=buildHouse(layout), furniture=buildFurniture(layout,undefined,{items:true});
  for(const object of [house.group,furniture.group]) object.traverse(o=>{
    if(o.geometry) for(const n of o.geometry.attributes.position.array) assert(Number.isFinite(n));
  });
  for(const room of Object.values(furniture.byRoom)) for(const child of room.children) {
    if(child.userData.kind==='specialized-room') assert(child.userData.home,'Animation requires a resting position');
  }
  for(const frame of house.doorFrames) assert(!(layout.open_connections??[]).some(pair=>pair.every(id=>frame.userData.door.between.includes(id))));
  assert(planSVG(layout).length>100);
}
for(const [format,width,depth,hoops] of [['full',60,110,2],['half',57,60,1],['compact',40,50,1]]) for(const rotated of [false,true]){
  const room={id:'court',type:'basketball_court',court_format:format,x:0,y:0,w:rotated?depth:width,h:rotated?width:depth};
  const data=courtGeometry(room);assert.equal(data.hoops.length,hoops);
  for(const line of data.lines) for(const [x,y,z] of line){assert(Math.abs(x)<=room.w/2+.01);assert(Math.abs(z)<=room.h/2+.01);assert(y>0);}
  const meshes=[];roomExtras(room).traverse(o=>{if(o.name==='basketball-hoop')meshes.push(o);});
  assert.equal(meshes.length,hoops);assert(meshes.every(o=>o.position.y===10));
  assert(courtPlanSVG(room).includes(`${format} basketball court markings`));
}
console.log('Architecture rendering: six layouts, three court formats and rotations passed.');
