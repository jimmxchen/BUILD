// Specialized procedural room geometry. Dimensions come from the synchronized registry.
import * as THREE from 'three';
import registry from '../lib/room-specs.json' with { type: 'json' };

export function courtGeometry(room) {
  const spec = registry.courts[room.court_format];
  if (!spec) return null; // Legacy mislabeled living rooms are not silently branded regulation courts.
  const rotated = !(room.w >= spec.room_width - .01 && room.h >= spec.room_length - .01);
  const point = (u, v, y = .055) => rotated ? [v - spec.length / 2, y, u - spec.width / 2] : [u - spec.width / 2, y, v - spec.length / 2];
  const lines = [];
  const segment = (a, b) => lines.push([point(...a), point(...b)]);
  const rectangle = (x, y, w, h) => { segment([x,y],[x+w,y]); segment([x+w,y],[x+w,y+h]); segment([x+w,y+h],[x,y+h]); segment([x,y+h],[x,y]); };
  const circle = (x,y,r,from=0,to=Math.PI*2) => { for(let i=0;i<64;i++){const a=from+(to-from)*i/64,b=from+(to-from)*(i+1)/64; segment([x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(b)*r,y+Math.sin(b)*r]);} };
  rectangle(0,0,spec.width,spec.length);
  const scale = room.court_format === 'compact' ? spec.width / 50 : 1;
  const hoops = [];
  for (const end of room.court_format === 'full' ? [0,1] : [0]) {
    const baseline = end ? spec.length : 0, direction = end ? -1 : 1;
    const basket = baseline + direction * 5.25 * scale;
    hoops.push(point(spec.width/2,basket,10));
    rectangle(spec.width/2-8*scale,Math.min(baseline,baseline+direction*19*scale),16*scale,19*scale);
    circle(spec.width/2,baseline+direction*19*scale,6*scale);
    // Three-point arc clipped to the sidelines; remaining corner lines meet the baseline.
    const radius=23.75*scale, side=22*scale;
    const angle=Math.acos(side/radius), arcStart=end?Math.PI+angle:angle, arcEnd=end?2*Math.PI-angle:Math.PI-angle;
    circle(spec.width/2,basket,radius,arcStart,arcEnd);
    const arcY=basket+direction*Math.sqrt(radius*radius-side*side);
    segment([spec.width/2-side,baseline],[spec.width/2-side,arcY]);
    segment([spec.width/2+side,baseline],[spec.width/2+side,arcY]);
  }
  if(room.court_format==='full'){segment([0,spec.length/2],[spec.width,spec.length/2]);circle(spec.width/2,spec.length/2,6);}
  return { spec, point, lines, hoops, rotated };
}

function box(group, size, position, color, name) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.8}));
  mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;group.add(mesh);return mesh;
}
function basketball(room) {
  const data=courtGeometry(room);if(!data)return null;
  const group=new THREE.Group();group.name=`court:${room.court_format}`;
  box(group,[room.w-.4,.035,room.h-.4],[0,.025,0],0xc69e66,'sport-surface');
  const positions=data.lines.flatMap(pair=>pair.flat());
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const marks=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xfaf8f0}));marks.name='court-markings';group.add(marks);
  data.hoops.forEach((at,index)=>{
    const [x,y,z]=at,sign=index?-1:1;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.75,.045,8,24),new THREE.MeshStandardMaterial({color:0xcf5d2e}));ring.rotation.x=Math.PI/2;ring.position.set(x,y,z);ring.name='basketball-hoop';group.add(ring);
    box(group,data.rotated?[.12,3.5,6]:[6,3.5,.12],data.rotated?[x-sign*.7,11.25,z]:[x,11.25,z-sign*.7],0xdce5e7,'backboard');
    box(group,data.rotated?[3,.2,.25]:[.25,.2,3],data.rotated?[x-sign*1.5,11,z]:[x,11,z-sign*1.5],0x353c40,'hoop-support');
  });
  return group;
}
function workroom(room) {
  const group=new THREE.Group();group.name='workroom-equipment';
  // Benches hug the solid perimeter; the middle stays open for circulation.
  box(group,[Math.min(8,room.w-2),.2,2.5],[0,3,-room.h/2+1.8],0x999b94,'workbench');
  for(const x of [-1,1])box(group,[.25,3,2.2],[x*Math.min(3,room.w/2-1.5),1.5,-room.h/2+1.8],0x42484a,'steel-bench-leg');
  return group;
}
export const ROOM_RENDERERS={basketball_court:basketball,workroom};
export function roomExtras(room){return ROOM_RENDERERS[room.type]?.(room)??null;}
export function courtPlanSVG(room){
  const data=courtGeometry(room);if(!data)return '';
  const paths=data.lines.map(([a,b])=>`M ${room.x+room.w/2+a[0]} ${room.y+room.h/2+a[2]} L ${room.x+room.w/2+b[0]} ${room.y+room.h/2+b[2]}`).join(' ');
  return `<path d="${paths}" stroke="#78592f" stroke-width="0.15" fill="none" aria-label="${room.court_format} basketball court markings"/>`;
}
