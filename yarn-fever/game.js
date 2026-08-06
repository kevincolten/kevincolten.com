/* Yarn Fever — a cozy 3D unravel puzzle (PWA)
   Tap loose pieces of the knitted castle; their yarn winds into matching baskets.
   3 of a kind clears a basket. No matching basket? Yarn waits in the buffer row. */
import * as THREE from 'three';

/* ---------------- helpers ---------------- */
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a=1,b)=> b===undefined ? Math.random()*a : a+Math.random()*(b-a);
const ri = (a,b)=>Math.floor(rand(a,b+1));
const pickA = arr => arr[Math.floor(Math.random()*arr.length)];
const shuffle = arr => { const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const easeOutCubic = t=>1-Math.pow(1-t,3);
const easeOutQuad = t=>t*(2-t);
const easeInQuad = t=>t*t;

function shade(hex,p){ // p in [-1,1]: negative -> darker, positive -> lighter
  const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const t=p<0?0:255, a=Math.abs(p);
  r=Math.round(r+(t-r)*a); g=Math.round(g+(t-g)*a); b=Math.round(b+(t-b)*a);
  return `rgb(${r},${g},${b})`;
}
function coilSVG(hex){
  const d1=shade(hex,-0.3), d2=shade(hex,-0.12), l1=shade(hex,0.22), l2=shade(hex,0.5);
  return `<svg viewBox="0 0 44 44"><ellipse cx="22" cy="30" rx="15" ry="7.5" fill="${d1}"/><ellipse cx="22" cy="26" rx="15" ry="7.5" fill="${d2}"/><ellipse cx="22" cy="22" rx="14.4" ry="7.2" fill="${hex}"/><ellipse cx="22" cy="18" rx="13.6" ry="6.8" fill="${l1}"/><ellipse cx="22" cy="15" rx="12.6" ry="6.2" fill="${hex}"/><ellipse cx="22" cy="13.4" rx="8.6" ry="3.4" fill="${l2}"/></svg>`;
}

/* ---------------- save state ---------------- */
const mem={};
const store={
  get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return k in mem?mem[k]:d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ mem[k]=v; } }
};
const DEF={level:1,coins:100,unlocks:{tray2:false,tray3:false,buf5:false},sound:true,haptics:true,seenHow:false,lastDaily:''};
let S=Object.assign({},DEF,store.get('yf',{}));
S.unlocks=Object.assign({},DEF.unlocks,S.unlocks||{});
const save=()=>store.set('yf',S);

/* ---------------- audio + haptics ---------------- */
let AC=null;
function ac(){ if(!AC){ const C=window.AudioContext||window.webkitAudioContext; if(C) AC=new C(); } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function tone(f0,f1,dur,type='sine',vol=0.15,delay=0){
  if(!S.sound) return;
  try{ const a=ac(); if(!a)return; const t=a.currentTime+delay;
    const o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+0.03);
  }catch(e){}
}
const sfx={
  pluck:()=>tone(520,190,0.13,'triangle',0.18),
  plink:()=>{tone(660,680,0.07,'sine',0.14); tone(990,1000,0.05,'sine',0.08,0.035);},
  chime:()=>[660,830,1108].forEach((f,i)=>tone(f,f,0.16,'sine',0.13,i*0.07)),
  whoosh:()=>tone(240,900,0.2,'sawtooth',0.05),
  thud:()=>tone(150,110,0.08,'square',0.08),
  fail:()=>tone(200,85,0.4,'square',0.12),
  unlock:()=>tone(400,820,0.18,'triangle',0.14),
  win:()=>[523,659,784,1046,1318].forEach((f,i)=>tone(f,f,0.22,'triangle',0.14,i*0.09)),
};
function buzz(p){ if(S.haptics && navigator.vibrate){ try{navigator.vibrate(p);}catch(e){} } }

/* ---------------- palette ---------------- */
const PALETTE=['#f68b1f','#ffc531','#63c92d','#4fc3f7','#ef5044','#ab5ce8','#f27ab4','#2fb9a8','#efe0b4','#8a5a33'];

/* ---------------- three.js scene ---------------- */
const glCanvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas:glCanvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,0.1,200);
scene.add(new THREE.HemisphereLight(0xeaf4ff,0x9fb4c9,1.15));
const sun=new THREE.DirectionalLight(0xfff1da,2.3);
sun.position.set(7,13,5); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-12,right:12,top:14,bottom:-10,far:45});
scene.add(sun);

/* knitted texture (procedural chevron stitches) */
function makeKnitCanvas(){
  const s=256,c=document.createElement('canvas'); c.width=c.height=s;
  const g=c.getContext('2d');
  g.fillStyle='#cfcfcf'; g.fillRect(0,0,s,s);
  const cols=5, rows=7, cw=s/cols, rh=s/rows;
  function leg(x,y,rot){
    g.save(); g.translate(x,y); g.rotate(rot);
    const gr=g.createLinearGradient(0,-rh*0.34,0,rh*0.34);
    gr.addColorStop(0,'#f5f5f5'); gr.addColorStop(0.45,'#dedede'); gr.addColorStop(1,'#969696');
    g.fillStyle=gr;
    g.beginPath(); g.ellipse(0,0,cw*0.30,rh*0.37,0,0,Math.PI*2); g.fill();
    g.restore();
  }
  for(let r=-1;r<=rows;r++) for(let col=-1;col<=cols;col++){
    const cx=col*cw+cw/2, cy=r*rh+rh/2;
    leg(cx-cw*0.21,cy,-0.55);
    leg(cx+cw*0.21,cy,0.55);
  }
  return c;
}
const knitCanvas=makeKnitCanvas();
const knitMap=new THREE.CanvasTexture(knitCanvas);
knitMap.wrapS=knitMap.wrapT=THREE.RepeatWrapping; knitMap.repeat.set(3,3);
knitMap.colorSpace=THREE.SRGBColorSpace; knitMap.anisotropy=4;
const knitBump=new THREE.CanvasTexture(knitCanvas);
knitBump.wrapS=knitBump.wrapT=THREE.RepeatWrapping; knitBump.repeat.set(3,3);

const matCache={};
function matFor(hex){
  if(!matCache[hex]) matCache[hex]=new THREE.MeshStandardMaterial({
    color:hex,map:knitMap,bumpMap:knitBump,bumpScale:0.45,roughness:0.92,metalness:0});
  return matCache[hex];
}

/* geometries */
const GEO={}, GEOSET=new Set();
function regGeo(k,g){ GEO[k]=g; GEOSET.add(g); return g; }
regGeo('cyl',   new THREE.CylinderGeometry(0.78,0.84,1,26));
regGeo('cone',  new THREE.ConeGeometry(0.85,1.4,26));
regGeo('ring',  new THREE.TorusGeometry(0.86,0.31,12,34).rotateX(Math.PI/2));
regGeo('disc',  new THREE.CylinderGeometry(0.72,0.78,0.32,26));
regGeo('box',   new THREE.BoxGeometry(1.3,0.75,1.3));
regGeo('tbody', new THREE.CylinderGeometry(0.8,0.88,0.95,20));
regGeo('tooth', new THREE.BoxGeometry(0.3,0.34,0.3));
regGeo('pole',  new THREE.CylinderGeometry(0.035,0.035,1.1,8));
regGeo('cloth', new THREE.BoxGeometry(0.42,0.26,0.03));
{
  const sh=new THREE.Shape();
  for(let i=0;i<10;i++){ const r=i%2?0.42:0.95; const a=i/10*Math.PI*2-Math.PI/2;
    const px=Math.cos(a)*r, py=Math.sin(a)*r; i?sh.lineTo(px,py):sh.moveTo(px,py); }
  sh.closePath();
  const sg=new THREE.ExtrudeGeometry(sh,{depth:0.26,bevelEnabled:true,bevelThickness:0.06,bevelSize:0.06,bevelSegments:2});
  sg.rotateX(-Math.PI/2); sg.center();
  regGeo('star',sg);
}
const H={cyl:1,cone:1.4,ring:0.62,disc:0.32,box:0.75,star:0.42,turret:1.28};
const POLE_MAT=new THREE.MeshStandardMaterial({color:'#b06a2e',roughness:0.8});
const FLAG_MAT=new THREE.MeshStandardMaterial({color:'#3f6fe0',roughness:0.7});

function buildPieceMesh(shape,hex){
  const m=matFor(hex);
  if(shape==='turret'){
    const root=new THREE.Group();
    const body=new THREE.Mesh(GEO.tbody,m); body.castShadow=body.receiveShadow=true; root.add(body);
    for(let i=0;i<5;i++){ const a=i/5*Math.PI*2;
      const t=new THREE.Mesh(GEO.tooth,m); t.castShadow=true;
      t.position.set(Math.cos(a)*0.6,0.62,Math.sin(a)*0.6); t.rotation.y=-a; root.add(t); }
    return root;
  }
  const mesh=new THREE.Mesh(GEO[shape],m);
  mesh.castShadow=mesh.receiveShadow=true;
  return mesh;
}

/* ---------------- level state ---------------- */
let level=1, hardLevel=false, state='play', targeting=null;
let totalPieces=0, collected=0;
let pieces=[], stacks=[], levelPickables=[], levelGroup=null;
let trayQueue=[], trays=[], buffer=[], inFlightBuf=0, tempSlots=0;
const COST={tray2:200,tray3:500,buf5:150};
const BOOST={hammer:30,scissors:60,brush:40};

const bufferCap=()=>5+(S.unlocks.buf5?1:0)+tempSlots;
const bufferUsed=()=>buffer.length+inFlightBuf;
const stackTopY=st=>0.55+st.pieces.reduce((a,p)=>a+p.h,0);

function addPiece(st,shape,color,scale){
  const h=H[shape]*scale;
  const mesh=buildPieceMesh(shape,color);
  mesh.scale.setScalar(scale);
  mesh.position.set(st.x, stackTopY(st)+h/2, st.z);
  mesh.rotation.y=rand(0,Math.PI*2);
  const p={id:pieces.length,shape,color,scale,h,mesh,stack:st,alive:true};
  mesh.userData.pid=p.id;
  pieces.push(p); st.pieces.push(p);
  levelGroup.add(mesh); levelPickables.push(mesh);
  return p;
}

function buildLevel(n){
  level=n; hardLevel=(n%5===4);
  state='play'; setTargeting(null);
  collected=0; buffer=[]; inFlightBuf=0; tempSlots=0;
  flights.length=0; confs.length=0; closeModal();

  if(levelGroup){
    levelGroup.traverse(o=>{ if(o.isMesh&&o.geometry&&!GEOSET.has(o.geometry)) o.geometry.dispose(); });
    scene.remove(levelGroup);
  }
  levelGroup=new THREE.Group(); scene.add(levelGroup);
  pieces=[]; stacks=[]; levelPickables=[];

  /* colors + counts (multiples of 3) */
  const nCol=clamp(4+Math.floor(n/4)+(hardLevel?1:0),4,8);
  const cols=shuffle(PALETTE).slice(0,nCol);
  let total=Math.min(12+n*7,195); total-=total%3; totalPieces=total;
  const counts={}; cols.forEach(c=>counts[c]=3);
  let left=total-3*nCol;
  while(left>0){ counts[pickA(cols)]+=3; left-=3; }
  const bag=shuffle(cols.flatMap(c=>Array(counts[c]).fill(c)));
  trayQueue=cols.flatMap(c=>Array(counts[c]/3).fill(c));

  /* towers */
  const towersN=clamp(3+Math.floor(n/4),3,6);
  const towerBudget=Math.round(total*0.62);
  const hts=[]; let used=0;
  for(let t=0;t<towersN;t++){ const h=ri(4,8); hts.push(h); used+=h; }
  while(used>towerBudget && Math.max(...hts)>3){ const i=hts.indexOf(Math.max(...hts)); hts[i]--; used--; }
  while(used>total){ const i=hts.indexOf(Math.max(...hts)); if(hts[i]<=1)break; hts[i]--; used--; }

  const towerPos=[];
  for(let t=0;t<hts.length;t++){
    let x=0,z=0,ok=false,tries=0;
    while(!ok&&tries++<70){
      if(t===0){ x=rand(-0.8,0.8); z=rand(-0.8,0.8); }
      else { const a=rand(0,Math.PI*2), r=rand(2.4,4.6); x=Math.cos(a)*r; z=Math.sin(a)*r; }
      ok=towerPos.every(p=>Math.hypot(p.x-x,p.z-z)>2.6);
    }
    towerPos.push({x,z});
  }
  const spread=Math.max(4.2,...towerPos.map(p=>Math.hypot(p.x,p.z)))+2;

  let tallest=null;
  hts.forEach((h,ti)=>{
    const st={pieces:[],x:towerPos[ti].x,z:towerPos[ti].z};
    stacks.push(st);
    for(let j=0;j<h;j++){
      const roll=Math.random(); let shape;
      if(j===h-1)      shape = roll<0.7?'cone':'turret';
      else if(j===0)   shape = roll<0.55?'cyl':(roll<0.85?'box':'turret');
      else             shape = roll<0.42?'cyl':(roll<0.72?'ring':(roll<0.88?'disc':'box'));
      const sc=clamp(1-j*0.055,0.6,1)*(j===0?1.06:1);
      addPiece(st,shape,bag.pop(),sc);
    }
    if(!tallest||stackTopY(st)>stackTopY(tallest)) tallest=st;
  });
  /* flag on the tallest tower's top piece (decor only) */
  if(tallest&&tallest.pieces.length){
    const topP=tallest.pieces[tallest.pieces.length-1];
    const fg=new THREE.Group();
    const pole=new THREE.Mesh(GEO.pole,POLE_MAT); pole.castShadow=true; pole.position.y=1.1; pole.userData.deco=true;
    const cloth=new THREE.Mesh(GEO.cloth,FLAG_MAT); cloth.castShadow=true; cloth.position.set(0.23,1.48,0); cloth.userData.deco=true;
    fg.add(pole,cloth); topP.mesh.add(fg);
  }

  /* ground pieces */
  let g=total-used;
  const gst=[];
  while(g>0){
    const pileN=(g>=3&&Math.random()<0.25)?ri(2,3):1;
    const take=Math.min(pileN,g);
    let x=0,z=0,ok=false,tries=0;
    while(!ok&&tries++<90){
      const a=rand(0,Math.PI*2), r=rand(1.2,spread-0.7);
      x=Math.cos(a)*r; z=Math.sin(a)*r;
      ok=towerPos.every(p=>Math.hypot(p.x-x,p.z-z)>2.1)&&gst.every(s=>Math.hypot(s.x-x,s.z-z)>1.5);
    }
    const st={pieces:[],x,z}; stacks.push(st); gst.push(st);
    for(let k=0;k<take;k++){
      const shape=(k===take-1)?pickA(['star','disc','ring','cone','star','disc']):pickA(['disc','box','disc']);
      addPiece(st,shape,bag.pop(),rand(0.8,1.05));
    }
    g-=take;
  }

  /* knitted blanket ground */
  const mcol=['#e9832a','#f0dcb2','#f4b25f','#e9832a'];
  for(let i=0;i<4;i++){
    const geoB=new THREE.BoxGeometry(spread*rand(0.95,1.25),0.5,spread*rand(0.95,1.25));
    const b=new THREE.Mesh(geoB,matFor(mcol[i]));
    b.position.set((i%2?0.42:-0.42)*spread*0.9+rand(-0.4,0.4),0.25,(i<2?-0.42:0.42)*spread*0.9+rand(-0.4,0.4));
    b.rotation.y=rand(-0.12,0.12);
    b.receiveShadow=true;
    levelGroup.add(b);
  }

  /* camera fit */
  const maxH=Math.max(3,...stacks.map(stackTopY));
  cam.ty=maxH*0.42+0.6;
  cam.r=clamp(9+spread*1.35+maxH*0.35,10,26);
  cam.min=7; cam.max=30; cam.theta=0.55; cam.phi=1.03;
  syncZoom();

  /* trays */
  const tCap=2+(S.unlocks.tray2?1:0)+(S.unlocks.tray3?1:0);
  trays=[0,1,2,3].map(i=>({idx:i,state:i<tCap?'active':'locked',color:null,filled:0,reserved:0}));
  trays.forEach(t=>{ if(t.state==='active'){ if(trayQueue.length)t.color=takeNextColor(); else t.state='done'; } });

  renderTrays(); renderBuffer(); updateCounter(); updateCoins();
  $('levelTxt').textContent='LEVEL '+n;
  $('skull').textContent=hardLevel?'\u{1F480}':'\u{1F9F6}';
}

/* weighted next basket color: favors what's stuck in the buffer & what's on top */
function takeNextColor(){
  const uniq=[...new Set(trayQueue)];
  if(!uniq.length) return null;
  const tops=stacks.map(st=>st.pieces[st.pieces.length-1]).filter(Boolean);
  const w=uniq.map(c=> 1
    + 4*buffer.filter(b=>b.color===c).length
    + 1.4*tops.filter(p=>p.color===c).length );
  let r=Math.random()*w.reduce((a,b)=>a+b,0), ci=0;
  for(let i=0;i<uniq.length;i++){ r-=w[i]; if(r<=0){ci=i;break;} }
  const c=uniq[ci];
  trayQueue.splice(trayQueue.indexOf(c),1);
  return c;
}

/* ---------------- collection ---------------- */
function canPlace(color){
  return trays.some(t=>t.state==='active'&&t.color===color&&t.reserved<3) || bufferUsed()<bufferCap();
}
function collectPiece(p){
  if(!p||!p.alive) return false;
  let dest=null;
  const tr=trays.find(t=>t.state==='active'&&t.color===p.color&&t.reserved<3);
  if(tr){ dest={type:'tray',tray:tr,slot:tr.reserved}; tr.reserved++; }
  else if(bufferUsed()<bufferCap()){ dest={type:'buf',slot:bufferUsed()}; inFlightBuf++; }
  else { outOfSpace(); return false; }

  const st=p.stack, i=st.pieces.indexOf(p);
  st.pieces.splice(i,1); p.alive=false;
  if(i<st.pieces.length) relayoutStack(st);

  sfx.pluck(); buzz(12);
  const sp=toScreen(p.mesh);
  spinOut(p);
  const el = dest.type==='tray' ? traySlotEl(dest.tray.idx,dest.slot) : bufSlotEl(dest.slot);
  flyStrand(p.color,sp.x,sp.y,el,()=>land(p.color,dest,true));
  return true;
}
function land(color,dest,countIt){
  if(countIt){ collected++; updateCounter(); }
  if(dest.type==='tray'){
    const t=dest.tray; t.filled++;
    fillTraySlot(t.idx,dest.slot,color); sfx.plink();
    if(t.filled===3) completeTray(t);
  } else {
    inFlightBuf--; buffer.push({color}); renderBuffer(); sfx.plink();
    const el=bufSlotEl(buffer.length-1);
    if(el){ el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'),320); }
  }
  if(countIt&&collected>=totalPieces&&state==='play') winLevel();
}
function completeTray(t){
  t.state='clearing';
  S.coins+=8; save(); updateCoins(true);
  floatCoin(trayRootEl(t.idx),'+8');
  sfx.chime(); buzz(25);
  const el=trayRootEl(t.idx); if(el) el.classList.add('boom');
  setTimeout(()=>{
    t.filled=0; t.reserved=0;
    if(trayQueue.length){ t.color=takeNextColor(); t.state='active'; renderTrays(); vacuum(t); }
    else { t.color=null; t.state='done'; renderTrays(); }
  },520);
}
function vacuum(t){
  const moves=[];
  for(let i=0;i<buffer.length&&t.reserved<3;i++){
    if(buffer[i].color===t.color){ moves.push({bi:i,slot:t.reserved}); t.reserved++; }
  }
  if(!moves.length) return;
  const srcs=moves.map(m=>{
    const el=bufSlotEl(m.bi);
    if(el){ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }
    return {x:innerWidth/2,y:150};
  });
  for(let k=moves.length-1;k>=0;k--) buffer.splice(moves[k].bi,1);
  renderBuffer();
  moves.forEach((m,k)=>setTimeout(()=>{
    const el=traySlotEl(t.idx,m.slot);
    flyStrand(t.color,srcs[k].x,srcs[k].y,el,()=>land(t.color,{type:'tray',tray:t,slot:m.slot},false));
  },90+k*150));
}
function outOfSpace(){
  if(state!=='play') return;
  state='over'; sfx.fail(); buzz([70,50,90]);
  const canBuy=S.coins>=100;
  modal(`<h2>Out of room!</h2>
    <p>Every waiting slot is holding yarn with no matching basket.</p>
    <div class="mbtns">
      ${canBuy?'<button class="mb green" data-act="slots">+2 slots \u00b7 100 \u{1FA99}</button>':''}
      <button class="mb orange" data-act="retry">Retry level</button>
    </div>`);
}
function winLevel(){
  state='won'; sfx.win(); buzz([40,60,40,120]); confetti();
  const reward=Math.min(20+level*3,80);
  S.coins+=reward; S.level=level+1; save(); updateCoins(true);
  setTimeout(()=>modal(`<h2>Level ${level} cleared! \u{1F389}</h2>
    <p>+${reward} \u{1FA99} stitched into your pocket.</p>
    <div class="mbtns"><button class="mb green" data-act="next">Next level</button></div>`),1000);
}

/* ---------------- boosters + unlocks ---------------- */
function boosterTap(kind){
  if(state!=='play') return;
  if(targeting===kind){ setTargeting(null); return; }
  const cost=BOOST[kind];
  if(S.coins<cost){ shakeCoins(); toast(`Need ${cost} \u{1FA99} \u2014 clear baskets to earn more`); return; }
  if(kind==='hammer'){ setTargeting('hammer'); return; }
  if(kind==='scissors') doScissors(cost);
  if(kind==='brush') doBrush(cost);
}
function doScissors(cost){
  const t=trays.find(t=>t.state==='active'&&t.reserved<3);
  if(!t){ toast('Baskets are busy \u2014 one sec'); return; }
  const need=3-t.reserved;
  const depth=p=>p.stack.pieces.length-1-p.stack.pieces.indexOf(p);
  const cands=pieces.filter(p=>p.alive&&p.color===t.color).sort((a,b)=>depth(a)-depth(b));
  if(cands.length<need){ toast('Not enough matching yarn left'); return; }
  S.coins-=cost; save(); updateCoins(); sfx.whoosh();
  cands.slice(0,need).forEach((p,k)=>setTimeout(()=>{ if(p.alive)collectPiece(p); },k*180));
}
function doBrush(cost){
  const ps=pieces.filter(p=>p.alive);
  if(ps.length<2){ toast('Nothing left to repaint'); return; }
  S.coins-=cost; save(); updateCoins(); sfx.whoosh();
  const colsN=shuffle(ps.map(p=>p.color));
  ps.forEach((p,i)=>{
    p.color=colsN[i];
    p.mesh.traverse(o=>{ if(o.isMesh&&!o.userData.deco) o.material=matFor(colsN[i]); });
    pulse(p.mesh);
  });
  toast('Colors reshuffled!');
}
function tryUnlock(key){
  const c=COST[key];
  if(S.coins<c){ shakeCoins(); toast(`Need ${c} \u{1FA99}`); return; }
  S.coins-=c; S.unlocks[key]=true; save(); updateCoins(); sfx.unlock(); buzz(30);
  if(key==='buf5'){ renderBuffer(); return; }
  const idx=key==='tray2'?2:3;
  const t=trays[idx];
  t.filled=0; t.reserved=0;
  if(trayQueue.length){ t.color=takeNextColor(); t.state='active'; renderTrays(); vacuum(t); }
  else { t.state='done'; renderTrays(); }
}
function setTargeting(k){
  targeting=k;
  const b=$('banner');
  if(k){ b.hidden=false; b.innerHTML='\u{1F528} Tap any piece \u2014 even buried ones &nbsp;<u>cancel</u>'; }
  else b.hidden=true;
  document.querySelectorAll('.boost').forEach(x=>x.classList.toggle('arm',x.dataset.b===k));
}

/* ---------------- HUD ---------------- */
const traysEl=$('trays'), bufEl=$('bufferRow');
const trayRootEl=i=>document.querySelector(`.tray[data-i="${i}"]`);
const traySlotEl=(i,s)=>document.querySelector(`.tray[data-i="${i}"] .tslot[data-s="${s}"]`);
const bufSlotEl=s=>document.querySelector(`.bslot[data-s="${s}"]`);

function renderTrays(){
  traysEl.innerHTML=trays.map(t=>{
    if(t.state==='locked'){
      const key=t.idx===2?'tray2':'tray3';
      return `<div class="tray locked" data-i="${t.idx}"><button class="unlock" data-un="${key}">\uFF0B<i>${COST[key]}</i></button></div>`;
    }
    if(t.state==='done'){
      return `<div class="tray done" data-i="${t.idx}"><div class="tslots"><div class="tslot"></div><div class="tslot"></div><div class="tslot"></div></div></div>`;
    }
    const c=t.color||'#bbb';
    const style=`--tc:${c};--td:${shade(c,-0.2)};--tl:${shade(c,0.2)}`;
    const slots=[0,1,2].map(s=>`<div class="tslot" data-s="${s}">${s<t.filled?coilSVG(c):''}</div>`).join('');
    return `<div class="tray" data-i="${t.idx}" style="${style}"><div class="tslots">${slots}</div></div>`;
  }).join('');
}
function renderBuffer(){
  const cap=bufferCap(), base=5+(S.unlocks.buf5?1:0);
  let html='';
  for(let i=0;i<cap;i++){
    const b=buffer[i];
    html+=`<div class="bslot${i>=base?' temp':''}" data-s="${i}">${b?coilSVG(b.color):''}</div>`;
  }
  if(!S.unlocks.buf5) html+=`<button class="bslot lockb" data-un="buf5">\uFF0B<i>${COST.buf5}</i></button>`;
  bufEl.innerHTML=html;
  bufEl.classList.toggle('danger',bufferUsed()>0&&bufferUsed()>=cap-1);
}
function fillTraySlot(i,s,color){
  const el=traySlotEl(i,s);
  if(el){ el.innerHTML=coilSVG(color); el.classList.add('pop'); setTimeout(()=>el.classList.remove('pop'),350); }
}
function updateCounter(){ $('countTxt').textContent=collected+' / '+totalPieces; }
function updateCoins(pop){
  $('coinTxt').textContent=S.coins;
  if(pop){ const p=$('coinPill'); p.classList.remove('popc'); void p.offsetWidth; p.classList.add('popc'); }
}
function shakeCoins(){ const p=$('coinPill'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); sfx.thud(); }
let toastT=0;
function toast(msg){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1900);
}
function floatCoin(anchor,txt){
  const r=anchor?anchor.getBoundingClientRect():{left:innerWidth/2-20,top:140,width:40,height:0};
  const s=document.createElement('div'); s.className='fcoin'; s.textContent=txt+' \u{1FA99}';
  s.style.left=(r.left+r.width/2)+'px'; s.style.top=(r.top+r.height*0.6)+'px';
  document.body.appendChild(s); setTimeout(()=>s.remove(),950);
}

/* modals */
const modalEl=$('modal'), cardEl=$('modalCard');
function modal(html,dismiss){ cardEl.innerHTML=html; modalEl.hidden=false; modalEl.dataset.dismiss=dismiss?'1':''; }
function closeModal(){ modalEl.hidden=true; }
modalEl.addEventListener('click',e=>{ if(e.target===modalEl&&modalEl.dataset.dismiss) closeModal(); });
cardEl.addEventListener('change',e=>{
  if(e.target.id==='ckSound'){ S.sound=e.target.checked; save(); }
  if(e.target.id==='ckHap'){ S.haptics=e.target.checked; save(); }
});
cardEl.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return;
  const a=b.dataset.act;
  if(a==='close') closeModal();
  else if(a==='next'){ closeModal(); buildLevel(S.level); }
  else if(a==='retry'||a==='restart'){ closeModal(); buildLevel(level); }
  else if(a==='slots'){
    if(S.coins>=100){ S.coins-=100; save(); updateCoins(); tempSlots+=2; renderBuffer(); state='play'; closeModal(); sfx.unlock(); }
  }
  else if(a==='daily'){
    const today=new Date().toDateString();
    if(S.lastDaily!==today){ S.lastDaily=today; S.coins+=100; save(); updateCoins(true); sfx.chime(); toast('+100 \u{1FA99} daily gift!'); closeModal(); }
  }
  else if(a==='howto') showHow();
  else if(a==='resetask'){ b.textContent='Really reset? Tap again'; b.dataset.act='resetyes'; }
  else if(a==='resetyes'){ S=Object.assign({},DEF,{unlocks:Object.assign({},DEF.unlocks)}); save(); closeModal(); updateCoins(); buildLevel(1); }
});
function showSettings(){
  modal(`<h2>Settings</h2>
   <label class="ck"><input type="checkbox" id="ckSound" ${S.sound?'checked':''}> Sound</label>
   <label class="ck"><input type="checkbox" id="ckHap" ${S.haptics?'checked':''}> Haptics</label>
   <div class="mbtns">
     <button class="mb blue" data-act="howto">How to play</button>
     <button class="mb orange" data-act="restart">Restart level</button>
     <button class="mb gray" data-act="resetask">Reset progress</button>
     <button class="mb green" data-act="close">Done</button>
   </div>
   <p class="tiny">Yarn Fever \u00b7 a cozy unravel puzzle</p>`,true);
}
function showHow(){
  modal(`<h2>\u{1F9F6} Yarn Fever</h2>
   <p><b>Unravel every piece of the knitted castle.</b></p>
   <p>Tap the loose piece on top of a stack \u2014 its yarn winds into a basket of the same color. Three of a kind clears the basket and earns coins.</p>
   <p>Yarn with no basket waits in the row below. If that row fills up, you're stuck!</p>
   <p>Drag to spin the castle \u00b7 pinch or slide to zoom.</p>
   <div class="mbtns"><button class="mb green" data-act="close">Let's knit</button></div>`,true);
}

/* ---------------- camera + input ---------------- */
const cam={theta:0.55,phi:1.03,r:16,min:7,max:30,ty:3};
function updateCam(){
  const sp=Math.sin(cam.phi);
  camera.position.set(cam.r*sp*Math.sin(cam.theta),cam.ty+cam.r*Math.cos(cam.phi),cam.r*sp*Math.cos(cam.theta));
  camera.lookAt(0,cam.ty,0);
}
const zoomEl=$('zoom');
function syncZoom(){ zoomEl.value=Math.round((cam.max-cam.r)/(cam.max-cam.min)*100); }
zoomEl.addEventListener('input',()=>{ cam.r=cam.max-(zoomEl.value/100)*(cam.max-cam.min); });

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), V3=new THREE.Vector3();
function pickAt(x,y){
  ndc.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(levelPickables,true);
  for(const h of hits){
    let o=h.object;
    while(o&&o.userData.pid===undefined) o=o.parent;
    if(o){ const p=pieces[o.userData.pid]; if(p&&p.alive) return p; }
  }
  return null;
}
function toScreen(m){
  m.getWorldPosition(V3); V3.project(camera);
  return {x:(V3.x*0.5+0.5)*innerWidth,y:(-V3.y*0.5+0.5)*innerHeight};
}
function handleTap(x,y){
  if(state!=='play') return;
  const p=pickAt(x,y); if(!p) return;
  if(targeting==='hammer'){
    if(!canPlace(p.color)){ toast('No room for that color right now'); return; }
    setTargeting(null);
    if(collectPiece(p)){ S.coins-=BOOST.hammer; save(); updateCoins(); }
    return;
  }
  const top=p.stack.pieces[p.stack.pieces.length-1];
  if(p!==top){ shakePiece(p); return; }
  collectPiece(p);
}

const ptrs=new Map();
let dragging=false,downX=0,downY=0,downT=0,pinchD=0;
glCanvas.addEventListener('pointerdown',e=>{
  glCanvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){ dragging=false; downX=e.clientX; downY=e.clientY; downT=performance.now(); }
  else if(ptrs.size===2){ const a=[...ptrs.values()]; pinchD=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); }
});
glCanvas.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId); if(!p) return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y;
  p.x=e.clientX; p.y=e.clientY;
  if(ptrs.size===1){
    if(!dragging&&Math.hypot(e.clientX-downX,e.clientY-downY)>9) dragging=true;
    if(dragging){ cam.theta-=dx*0.0055; cam.phi=clamp(cam.phi-dy*0.0055,0.32,1.38); }
  } else if(ptrs.size===2){
    const a=[...ptrs.values()];
    const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    if(pinchD>0&&d>0){ cam.r=clamp(cam.r*pinchD/d,cam.min,cam.max); syncZoom(); }
    pinchD=d;
  }
});
function endPtr(e){
  const was=ptrs.size;
  ptrs.delete(e.pointerId);
  if(was===1&&!dragging&&performance.now()-downT<450) handleTap(e.clientX,e.clientY);
  if(ptrs.size<2) pinchD=0;
  if(ptrs.size===0) dragging=false;
}
glCanvas.addEventListener('pointerup',endPtr);
glCanvas.addEventListener('pointercancel',e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2)pinchD=0; if(!ptrs.size)dragging=false; });
addEventListener('wheel',e=>{ cam.r=clamp(cam.r*(1+e.deltaY*0.0012),cam.min,cam.max); syncZoom(); },{passive:true});
document.addEventListener('gesturestart',e=>e.preventDefault());

/* ---------------- tweens + piece anims ---------------- */
const tweens=[];
function tween(dur,fn,ease=easeOutCubic,done){ tweens.push({t0:performance.now(),dur,fn,ease,done}); }
function spinOut(p){
  const m=p.mesh,r0=m.rotation.y,s0=m.scale.x,y0=m.position.y;
  tween(380,(e,t)=>{
    m.rotation.y=r0+t*12;
    m.scale.setScalar(Math.max(s0*(1-easeInQuad(t)),0.001));
    m.position.y=y0+e*0.7;
  },easeOutQuad,()=>{
    levelGroup.remove(m);
    const i=levelPickables.indexOf(m); if(i>=0)levelPickables.splice(i,1);
  });
}
function relayoutStack(st){
  let cursor=0.55;
  st.pieces.forEach(p=>{
    const target=cursor+p.h/2; cursor+=p.h;
    const m=p.mesh,y0=m.position.y;
    if(Math.abs(y0-target)>0.01) tween(180,e=>{ m.position.y=y0+(target-y0)*e; });
  });
}
function shakePiece(p){
  const m=p.mesh,x0=m.position.x,r0=m.rotation.z;
  sfx.thud(); buzz(8);
  tween(320,(e,t)=>{
    const a=Math.sin(t*26)*(1-t);
    m.position.x=x0+a*0.09; m.rotation.z=r0+a*0.1;
  },t=>t,()=>{ m.position.x=x0; m.rotation.z=r0; });
}
function pulse(m){
  const s0=m.scale.x;
  tween(220,(e,t)=>{ m.scale.setScalar(s0*(1+Math.sin(t*Math.PI)*0.14)); },t=>t,()=>m.scale.setScalar(s0));
}

/* ---------------- fx overlay (strands + confetti) ---------------- */
const fx=$('fx'), fctx=fx.getContext('2d');
function sizeFX(){
  const d=Math.min(devicePixelRatio||1,2);
  fx.width=innerWidth*d; fx.height=innerHeight*d;
  fx.style.width=innerWidth+'px'; fx.style.height=innerHeight+'px';
  fctx.setTransform(d,0,0,d,0,0);
}
const flights=[];
function flyStrand(hex,x0,y0,el,cb){
  let x1=innerWidth/2,y1=130;
  if(el){ const r=el.getBoundingClientRect(); x1=r.left+r.width/2; y1=r.top+r.height/2; }
  const cx=(x0+x1)/2+rand(-70,70), cy=Math.min(y0,y1)-rand(70,150);
  flights.push({hex,x0,y0,x1,y1,cx,cy,t:0,dur:0.5+Math.hypot(x1-x0,y1-y0)/2200,cb,ph:rand(0,6.28)});
}
function qb(f,u){
  const a=1-u;
  return {x:a*a*f.x0+2*a*u*f.cx+u*u*f.x1, y:a*a*f.y0+2*a*u*f.cy+u*u*f.y1};
}
function drawFlights(dt,now){
  for(let i=flights.length-1;i>=0;i--){
    const f=flights[i]; f.t+=dt/f.dur;
    if(f.t>=1){ flights.splice(i,1); if(f.cb)f.cb(); continue; }
    const head=easeOutQuad(Math.min(f.t/0.85,1));
    const tail=f.t<0.55?0:easeInQuad((f.t-0.55)/0.45);
    fctx.lineCap='round'; fctx.lineJoin='round';
    fctx.beginPath();
    const N=22;
    for(let k=0;k<=N;k++){
      const u=tail+(head-tail)*k/N;
      const p=qb(f,u);
      const wob=Math.sin(u*9+now*0.02+f.ph)*3*(1-f.t);
      if(k)fctx.lineTo(p.x,p.y+wob); else fctx.moveTo(p.x,p.y+wob);
    }
    fctx.strokeStyle=f.hex; fctx.lineWidth=6.5; fctx.stroke();
    fctx.strokeStyle=shade(f.hex,0.4); fctx.lineWidth=2; fctx.stroke();
    const hp=qb(f,head);
    fctx.fillStyle=f.hex;
    fctx.beginPath(); fctx.arc(hp.x,hp.y,10,0,Math.PI*2); fctx.fill();
    fctx.strokeStyle=shade(f.hex,-0.3); fctx.lineWidth=1.6;
    fctx.beginPath(); fctx.ellipse(hp.x,hp.y,8.4,4.6,0.5,0,Math.PI*2); fctx.stroke();
    fctx.beginPath(); fctx.ellipse(hp.x,hp.y,8.4,4.6,-0.7,0,Math.PI*2); fctx.stroke();
    fctx.fillStyle='rgba(255,255,255,.55)';
    fctx.beginPath(); fctx.arc(hp.x-3,hp.y-3.5,2.4,0,Math.PI*2); fctx.fill();
  }
}
const confs=[];
function confetti(){
  for(let i=0;i<130;i++) confs.push({
    x:rand(0,innerWidth),y:rand(-160,-10),vx:rand(-70,70),vy:rand(40,180),
    r:rand(0,6.28),vr:rand(-7,7),c:pickA(PALETTE),w:rand(6,11),h:rand(8,16),life:rand(2.2,3.3)});
}
function drawConfetti(dt){
  for(let i=confs.length-1;i>=0;i--){
    const p=confs[i];
    p.vy+=650*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=p.vr*dt; p.life-=dt;
    if(p.life<=0||p.y>innerHeight+30){ confs.splice(i,1); continue; }
    fctx.save(); fctx.translate(p.x,p.y); fctx.rotate(p.r);
    fctx.fillStyle=p.c; fctx.globalAlpha=Math.min(1,p.life);
    fctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    fctx.restore();
  }
  fctx.globalAlpha=1;
}

/* ---------------- wiring ---------------- */
$('btnGear').addEventListener('click',showSettings);
$('btnAds').addEventListener('click',()=>toast('No ads in this yarn shop. Ever. \u{1F389}'));
$('btnCoins').addEventListener('click',()=>{
  const can=S.lastDaily!==new Date().toDateString();
  modal(`<h2>Coins</h2>
    <p>Clear a basket for <b>+8 \u{1FA99}</b>. Finish a level for a bigger bonus. Spend coins on boosters and extra slots.</p>
    <div class="mbtns">
      ${can?'<button class="mb green" data-act="daily">Claim daily +100 \u{1FA99}</button>':'<p class="tiny">Daily gift claimed \u2014 come back tomorrow.</p>'}
      <button class="mb gray" data-act="close">Close</button>
    </div>`,true);
});
document.querySelectorAll('.boost').forEach(b=>b.addEventListener('click',()=>boosterTap(b.dataset.b)));
$('banner').addEventListener('click',()=>setTargeting(null));
traysEl.addEventListener('click',e=>{ const u=e.target.closest('.unlock'); if(u)tryUnlock(u.dataset.un); });
bufEl.addEventListener('click',e=>{ const u=e.target.closest('.lockb'); if(u)tryUnlock(u.dataset.un); });

/* ---------------- main loop ---------------- */
let lastT=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-lastT)/1000,0.05); lastT=now;
  for(let i=tweens.length-1;i>=0;i--){
    const t=tweens[i], k=(now-t.t0)/t.dur;
    if(k>=1){ t.fn(t.ease(1),1); tweens.splice(i,1); if(t.done)t.done(); }
    else t.fn(t.ease(Math.max(k,0)),Math.max(k,0));
  }
  updateCam();
  renderer.render(scene,camera);
  fctx.clearRect(0,0,innerWidth,innerHeight);
  drawFlights(dt,now);
  drawConfetti(dt);
}

function onResize(){
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  sizeFX();
}
addEventListener('resize',onResize);

/* ---------------- go ---------------- */
onResize();
buildLevel(S.level||1);
if(!S.seenHow){ S.seenHow=true; save(); showHow(); }
requestAnimationFrame(loop);

if('serviceWorker' in navigator){
  addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
