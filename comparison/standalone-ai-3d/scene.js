// Standalone canvas 3D renderer. No BUILD geometry, checker, or runtime imports.
const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d');
const layout = await (await fetch('./layout.json')).json();
const rooms = layout.rooms;
const palette = { kitchen: '#d3b989', dining: '#e1caa5', living: '#c4aa8a', office: '#a9c4ba', bath: '#a7c7c8', bed: '#c5baad', hall: '#c4c1b5', laundry: '#bbc6bc' };
let azimuth = -0.75, elevation = 0.72, zoom = 1;
let W = 0, H = 0, scale = 1;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scale = Math.min(W / 98, H / 61) * zoom;
  render();
}
function project(x, y, z) {
  const dx = x - 30, dz = z - 15;
  const horizontal = dx * Math.cos(azimuth) - dz * Math.sin(azimuth);
  const depth = dx * Math.sin(azimuth) + dz * Math.cos(azimuth);
  return { x: W * .52 + horizontal * scale, y: H * .57 + depth * Math.sin(elevation) * scale - y * Math.cos(elevation) * scale, depth };
}
function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${[16, 8, 0].map(s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * factor)))).join(',')})`;
}
let faces = [];
function face(points, color, outline = '#24322f') {
  const p = points.map(v => project(...v));
  faces.push({ p, color, outline, depth: p.reduce((s, v) => s + v.depth, 0) / p.length });
}
function box(x, z, w, d, height, color, y = 0, top = true) {
  const a=[x,y,z], b=[x+w,y,z], c=[x+w,y,z+d], e=[x,y,z+d];
  const A=[x,y+height,z], B=[x+w,y+height,z], C=[x+w,y+height,z+d], E=[x,y+height,z+d];
  face([a,b,B,A],shade(color,.74)); face([b,c,C,B],shade(color,.85));
  face([c,e,E,C],shade(color,.65)); face([e,a,A,E],shade(color,.8));
  if(top) face([A,B,C,E],color);
}
function wall(x1,z1,x2,z2,height=5.2, exterior=false) {
  const thick=.22;
  const x=Math.min(x1,x2)-thick/2, z=Math.min(z1,z2)-thick/2;
  box(x,z,Math.abs(x2-x1)+thick,Math.abs(z2-z1)+thick,height,exterior?'#ece8db':'#f2eee5');
}
function wallWithGaps(x1,z1,x2,z2,gaps=[],height=5.2,exterior=false) {
  const horizontal=z1===z2, start=horizontal?x1:z1, end=horizontal?x2:z2;
  let pos=start;
  for(const [a,b] of [...gaps,[end,end]]) {
    if(a>pos) horizontal?wall(pos,z1,a,z1,height,exterior):wall(x1,pos,x1,a,height,exterior);
    pos=b;
  }
}
function furniture() {
  // A few visible scale cues; no furniture is included in area calculations.
  box(4,4,7,3,2.8,'#e7e0d1'); box(21,4,5,3,2.4,'#826349');
  box(6,20,9,3.5,2.4,'#76877a'); box(33,4,4,2,2.5,'#806a56');
  box(49,4,7,5,2.1,'#e0d6c8'); box(42,21,5,6,2,'#dad0bf');
  box(52,21,5,6,2,'#dad0bf');
}
function build() {
  faces=[];
  // Ground and room slabs.
  box(-3,-3,66,36,.14,'#324c43',-.24);
  // The large ground plane spans both near and far depths; keep it behind the house.
  faces.forEach(f => { f.depth = -1e6; });
  for(const r of rooms) box(r.x+.05,r.z+.05,r.w-.1,r.d-.1,.08,palette[r.type],-.08);
  furniture();
  // Outside; the south wall has the 3 ft entrance at x=20.
  wall(0,0,60,0,4.5,true); wall(0,0,0,30,4.5,true);
  wall(60,0,60,30,2.6,true); wallWithGaps(0,30,60,30,[[18.5,21.5]],2.6,true);
  // Open public zone: kitchen and dining share a broad opening; no wall at z=12.
  wallWithGaps(16,0,16,12,[[3,10]]);
  // The private rooms open from a 4 ft wide hall.
  wall(30,0,30,12); wallWithGaps(30,12,30,16,[[13,16]]);
  wall(30,16,30,30);
  wallWithGaps(30,12,60,12,[[33,36],[51,54]]);
  wallWithGaps(30,16,60,16,[[30.5,33.5],[35,38],[42,45],[52,55]]);
  wall(39,0,39,12); wallWithGaps(44,0,44,12,[[5,8]]);
  wall(34,16,34,30); wall(39,16,39,30); wall(49,16,49,30);
}
function labels() {
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(const r of rooms) {
    const p=project(r.x+r.w/2,.13,r.z+r.d/2);
    ctx.font=`600 ${Math.max(10,Math.min(13,scale*.68))}px system-ui`;
    ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.fillStyle='#22332e';
    ctx.strokeText(r.name,p.x,p.y); ctx.fillText(r.name,p.x,p.y);
  }
}
function render() {
  ctx.fillStyle='#172627'; ctx.fillRect(0,0,W,H);
  const glow=ctx.createRadialGradient(W*.48,H*.52,20,W*.48,H*.52,Math.max(W,H)*.7);
  glow.addColorStop(0,'#31504b'); glow.addColorStop(1,'#172627');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
  build(); faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces) {
    ctx.beginPath(); f.p.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)); ctx.closePath();
    ctx.fillStyle=f.color; ctx.fill(); ctx.strokeStyle=f.outline; ctx.lineWidth=.7; ctx.stroke();
  }
  labels();
}
let dragging=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{if(!dragging)return;azimuth+=(e.clientX-lastX)*.006;elevation=Math.max(.25,Math.min(1.35,elevation+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;render();});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.55,Math.min(2.3,zoom*Math.exp(-e.deltaY*.001)));resize();},{passive:false});
document.querySelector('#reset').onclick=()=>{azimuth=-.75;elevation=.72;zoom=1;resize();};
document.querySelector('#save').onclick=()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='chatgpt-house-3d.png';a.click();};
addEventListener('resize',resize);resize();
