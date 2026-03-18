'use strict';
var STIM=200,MASK=200,ITI=500,NP=12,NB=10,NS=40;
var ALL_ECCS=[1,2,4,6,8,10,12,14,16],GDIRS=[0,1,2,3],HPOS=[0,180],TILTS=[0,1];
var PPD=37,ACT=[1,2,4],MODE='landolt',eng=null;
function popThresh(e){return 0.040*e+0.06;}
function startSize(e){
  if(MODE==='glass') return 0.50;
  return Math.max(1.0,popThresh(e)*8);
}
function floorSize(ppd){
  if(MODE==='glass') return 0.02;
  return Math.max(5/ppd,0.003);
}

function glassStartStep(){ return 0.25; }
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function calcPPD(){return(+document.getElementById('inpx').value/+document.getElementById('slw').value)*(+document.getElementById('sld').value*Math.PI/180);}

// calcActive: measure the actual rendered stimulus area width rather than
// window.innerWidth, which is unreliable on iOS (includes chrome, changes
// with keyboard, wrong in PWA mode). Falls back to innerWidth if area not
// yet in DOM. C must fit entirely on screen: ecc + half-C-width + margin < half-area-width.
function calcActive(ppd){
  var areaEl = document.getElementById('area');
  var areaW  = areaEl ? areaEl.getBoundingClientRect().width : 0;
  // fall back to innerWidth minus padding if area not laid out yet
  if(areaW < 10) areaW = window.innerWidth - 32;
  var half = areaW / 2;
  var u = ALL_ECCS.filter(function(e){
    var eccPx   = e * ppd;
    // C radius at starting size — must not clip edge
    var cHalf   = Math.max(24, popThresh(e) * 5 * ppd * 0.5);
    return eccPx + cHalf + 8 < half;
  });
  // require at least 3 eccentricities for a meaningful curve fit
  return u.length >= 3 ? u : ALL_ECCS.slice(0, 3);
}
// ── BACKGROUND COLOUR ────────────────────────────────────────────
// #area background is white (#ffffff).
// All stimuli use white bg so there is no visible canvas border.
// Gabor: mid-grey #808080 fills the circular aperture, fading to white
//   at edges via the Gaussian — no hard border.
// Glass: white field, white dots → high contrast black dots on white.
// C / E: white field, black ink.
var BG = '#ffffff';   // must match #area background in CSS
var EQUILUM_GREY = 128; // equiluminant grey level (0-255), set by user via flicker test

// Helper: is the current mode a Landolt-C variant?
function isLandoltMode(m){ return m==='landolt'||m==='landolt-red-white'||m==='landolt-red-black'||m==='landolt-red-grey'; }
// Helper: get stimulus fg/bg colours for current mode
function stimColors(m){
  if(m==='landolt-red-black') return {fg:'#ff0000', bg:'#000000'};
  if(m==='landolt-red-white') return {fg:'#ff0000', bg:'#ffffff'};
  if(m==='landolt-red-grey'){
    var v=EQUILUM_GREY.toString(16).padStart(2,'0');
    return {fg:'#ff0000', bg:'#'+v+v+v};
  }
  return {fg:'#000000', bg:'#ffffff'};   // classic landolt / others
}

function drawC(canvas, sizeDeg, gi, fgColor, bgColor) {
  fgColor = fgColor || '#000000';
  bgColor = bgColor || BG;
  var dpr = window.devicePixelRatio || 1, sp = sizeDeg * PPD;
  var sw = Math.max(0.5, sp / 5);
  var R = Math.max(sw * 2, (sp - sw) / 2);
  
  var ld = Math.max(12, Math.ceil(sp + 8)), SC = 4, od = ld * SC;
  var off = document.createElement('canvas');
  off.width = off.height = od;
  var o = off.getContext('2d');
  o.fillStyle = bgColor;
  o.fillRect(0, 0, od, od);

  var cx = od / 2, cy = od / 2, swS = sw * SC, RS = R * SC;

  o.strokeStyle = fgColor; o.lineWidth = swS;
  o.beginPath(); o.arc(cx, cy, RS, 0, Math.PI * 2); o.stroke();

  var angles = [1.5 * Math.PI, 0, 0.5 * Math.PI, Math.PI];
  o.save();
  o.translate(cx, cy);
  o.rotate(angles[gi]);
  o.fillStyle = bgColor;
  o.fillRect(0, -swS / 2, RS + swS / 2 + 1, swS); 
  o.restore();

  canvas.width = ld * dpr; canvas.height = ld * dpr;
  canvas.style.width = ld + 'px'; canvas.style.height = ld + 'px';
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, ld, ld);
}

// Tumbling E — ISO 8596: height H, stroke=gap=H/5, width=H
// No minimum canvas floor — staircase floor controls minimum size.
// 4× supersampled then downscaled, same as drawC.
function drawE(canvas, sizeDeg, gi) {
  var dpr = window.devicePixelRatio || 1;
  var H   = sizeDeg * PPD;            // overall height in logical px, no floor here
  H       = Math.max(4, H);           // absolute minimum: 4px so canvas is valid
  var sw  = Math.max(0.3, H / 5);    // stroke width = H/5
  var W   = H;
  var pad = sw * 0.5;
  var dim = Math.ceil(W + pad * 2);

  var SC = 4, od = dim * SC;
  var off = document.createElement('canvas');
  off.width = off.height = od;
  var o = off.getContext('2d');
  o.fillStyle = BG;
  o.fillRect(0, 0, od, od);

  o.save();
  o.translate(od / 2, od / 2);
  // gi: 0=up 1=right 2=down 3=left  (direction tines point)
  var rotMap = [Math.PI * 1.5, 0, Math.PI * 0.5, Math.PI];
  o.rotate(rotMap[gi]);

  var hs  = (H / 2) * SC;
  var ws  = (W / 2) * SC;
  var sws = sw * SC;

  o.fillStyle = '#000';
  // Spine: left vertical bar, full height
  o.fillRect(-ws, -hs, sws, hs * 2);
  // Three horizontal bars pointing right from spine
  o.fillRect(-ws, -hs,        ws * 2, sws);   // top
  o.fillRect(-ws, -sws / 2,   ws * 2, sws);   // middle
  o.fillRect(-ws,  hs - sws,  ws * 2, sws);   // bottom
  o.restore();

  canvas.width  = dim * dpr;
  canvas.height = dim * dpr;
  canvas.style.width  = dim + 'px';
  canvas.style.height = dim + 'px';
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

// Gabor: drawn in logical pixels throughout, scaled by dpr at the end.
// Background is BG (white), circular Gabor patch drawn over it.
// Gaussian envelope fades to 0 at edges → patch blends into white field.
// sizeDeg controls the patch diameter directly so small sizes work at 1°.
function drawGabor(canvas, sizeDeg, tiltIdx, contrast) {
  contrast = contrast === undefined ? 1.0 : contrast;
  var dpr    = window.devicePixelRatio || 1;
  var dp     = Math.max(16, Math.round(sizeDeg * PPD));  // logical px diameter
  if (dp % 2 === 0) dp++;

  // Draw at logical resolution then upscale — consistent with C/E pipeline
  var off    = document.createElement('canvas');
  off.width  = off.height = dp;
  var o      = off.getContext('2d');
  var imgd   = o.createImageData(dp, dp);
  var data   = imgd.data;
  var sigma  = dp / 6;
  // spatial frequency: 3 cycles across the patch diameter
  var sf     = (2 * Math.PI * 3) / dp;
  var angle  = tiltIdx === 0 ? -Math.PI / 4 : Math.PI / 4;

  // Parse BG (#ffffff) → mid-grey baseline is 128 on top of white bg
  for (var y = 0; y < dp; y++) {
    for (var x = 0; x < dp; x++) {
      var dx = x - dp/2, dy = y - dp/2;
      var xth = dx * Math.cos(angle) + dy * Math.sin(angle);
      var gaus = Math.exp(-(dx*dx + dy*dy) / (2 * sigma * sigma));
      // Grating oscillates around mid-grey 128; envelope fades to 0
      // so at edges val → 128 (mid-grey) which blends into white via
      // the alpha channel: we let alpha = gaus*255 and bg = white
      var grating = Math.sin(xth * sf);
      var val = Math.round(128 + 127 * grating * gaus * contrast);
      val = Math.max(0, Math.min(255, val));
      var i = (y * dp + x) * 4;
      // Blend: gabor on white bg via alpha compositing
      // gabor pixel at alpha=gaus: out = gaus*val + (1-gaus)*255
      var alpha = gaus;
      var blended = Math.round(alpha * val + (1 - alpha) * 255);
      data[i] = data[i+1] = data[i+2] = blended;
      data[i+3] = 255;
    }
  }
  o.putImageData(imgd, 0, 0);

  canvas.width  = dp * dpr;
  canvas.height = dp * dpr;
  canvas.style.width  = dp + 'px';
  canvas.style.height = dp + 'px';
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

// Glass spiral — 2AFC CW (dir=1) vs CCW (dir=-1)
// coherence: 0=pure noise, 1=fully coherent spiral
// White background, black dots — no visible patch border.
// Strict M-scaling, fixed dot density, dot radius < 0.5 × dipole.
function drawGlass(canvas, coherence, dir, eccDeg, k2hint) {
  var k2  = (k2hint && k2hint > 0.05 && k2hint < 8) ? k2hint : 1.5;
  var dpr = window.devicePixelRatio || 1;

  var patchBaseDeg = 1.5;
  var patchDeg     = patchBaseDeg * (1 + eccDeg / k2);
  var patchPx      = Math.max(40, Math.round(patchDeg * PPD));
  if (patchPx % 2 === 0) patchPx++;

  canvas.width  = patchPx * dpr;
  canvas.height = patchPx * dpr;
  canvas.style.width  = patchPx + 'px';
  canvas.style.height = patchPx + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // White background — no border when placed on white area
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, patchPx, patchPx);

  var baseDipolePx = Math.max(4, patchBaseDeg * PPD * 0.04);
  var dipolePx     = Math.min(baseDipolePx * (1 + eccDeg / k2), patchPx * 0.20);
  var dotR         = Math.max(1.0, dipolePx * 0.35);

  var DENSITY   = 60;
  var areaD2    = Math.PI * (patchDeg/2) * (patchDeg/2);
  var numPairs  = Math.max(80, Math.min(Math.round(DENSITY * areaD2), 800));

  var cx = patchPx / 2, cy = patchPx / 2;
  var apertureR = patchPx / 2 - 1;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, apertureR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#000000';   // black dots on white bg — max contrast

  for (var i = 0; i < numPairs; i++) {
    var x1, y1, dx, dy, dist2c, attempts = 0;
    do {
      x1 = Math.random() * patchPx;
      y1 = Math.random() * patchPx;
      dx = x1 - cx; dy = y1 - cy;
      dist2c = Math.sqrt(dx*dx + dy*dy);
      attempts++;
    } while (dist2c > apertureR - dotR && attempts < 12);

    var x2, y2;
    if (Math.random() < coherence) {
      // Signal: tangential dipole — rotational direction CW or CCW
      var norm = dist2c || 0.001;
      var tx = (-dy / norm) * dir;
      var ty = ( dx / norm) * dir;
      x2 = x1 + tx * dipolePx;
      y2 = y1 + ty * dipolePx;
    } else {
      var ra = Math.random() * Math.PI * 2;
      x2 = x1 + Math.cos(ra) * dipolePx;
      y2 = y1 + Math.sin(ra) * dipolePx;
    }

    ctx.beginPath(); ctx.arc(x1, y1, dotR, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x2, y2, dotR, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function placeStim(canvas,posAng,eccPx){
  var area=document.getElementById('area'),r=area.getBoundingClientRect();
  if(!r.width||!r.height)return false;
  var lw=parseFloat(canvas.style.width)||canvas.width,half=lw/2,rad=posAng*Math.PI/180;
  var rx=r.width/2+Math.cos(rad)*eccPx,ry=r.height/2-Math.sin(rad)*eccPx;
  var cx=Math.min(Math.max(rx,half+4),r.width-half-4),cy=Math.min(Math.max(ry,half+4),r.height-half-4);
  canvas.style.left=cx+'px';canvas.style.top=cy+'px';
  return Math.abs(cx-rx)<8&&Math.abs(cy-ry)<8;
}
var _fh,_fv;
function getFixEls(){if(!_fh){_fh=document.getElementById('fh');_fv=document.getElementById('fv');}}
function setFixColor(c){getFixEls();_fh.style.background=c;_fv.style.background=c;}
function flashFix(c,ms){setFixColor(c);setTimeout(function(){setFixColor('var(--ink)');},ms||350);}
function scStep(sc,ok,floor){
  var s=sc.size,st=sc.step,streak=sc.streak,rev=sc.reversals,ld=sc.lastDir,dir=ok?'up':'down';
  var nr=(ld!==null&&dir!==ld)?rev+1:rev,ns=streak,nz=s,np=st;
  var isGlass=(MODE==='glass');
  var ceil=isGlass?1.0:999;
  if(ok){
    ns++;
    if(ns>=2){  // 2-up
      nz=isGlass ? Math.max(floor, s*st) : Math.max(floor, s-st);
      ns=0;
    }
  } else {
    nz=isGlass ? Math.min(ceil, s/st) : Math.min(ceil, s+st);
    ns=0;
  }
  // Halve the step every 4 reversals (log space: halve the ratio toward 1)
  if(nr>0&&nr%4===0&&nr!==rev){
    np=isGlass ? Math.max(0.55, 1-(1-st)*0.5) : Math.max(floor*0.4,st*0.7);
  }
  return{size:nz,step:np,streak:ns,reversals:nr,lastDir:dir};
}
function calcThreshold(hist){
  var revs=[];
  for(var i=1;i<hist.length;i++)
    if((hist[i].correct?1:0)!==(hist[i-1].correct?1:0)) revs.push(hist[i].size);
  var vals=revs.length>=6 ? revs.slice(-8) : hist.slice(-8).map(function(h){return h.size;});
  if(!vals.length) return 0.1;
  if(MODE==='glass'){
    // Geometric mean in log space — appropriate for multiplicative staircase
    var sumLog=vals.reduce(function(a,b){return a+Math.log(b);},0);
    return Math.exp(sumLog/vals.length);
  }
  return vals.reduce(function(a,b){return a+b;},0)/vals.length;
}
function fitMag(eccs,thrs){
  var n=eccs.length;if(n<3)return{k1:null,k2:null,r2:null,fitted:[],outliers:[]};
  function wls(ws){var sw=0,swx=0,swy=0,swxx=0,swxy=0;for(var i=0;i<n;i++){sw+=ws[i];swx+=ws[i]*eccs[i];swy+=ws[i]*thrs[i];swxx+=ws[i]*eccs[i]*eccs[i];swxy+=ws[i]*eccs[i]*thrs[i];}var d=sw*swxx-swx*swx;if(Math.abs(d)<1e-12)return[0,thrs[0]||0];var sl=(sw*swxy-swx*swy)/d;return[sl,(swy-sl*swx)/sw];}
  var ws=new Array(n).fill(1),slope=0,intercept=0,res;
  for(var it=0;it<10;it++){res=wls(ws);slope=res[0];intercept=res[1];var rsd=eccs.map(function(e,i){return Math.abs(thrs[i]-(slope*e+intercept));});var sr=rsd.slice().sort(function(a,b){return a-b;}),mad=sr[Math.floor(n/2)]||0.001,hub=mad*1.5;ws=rsd.map(function(r){return r<=hub?1:hub/r;});}
  var k1=slope>0.001?Math.min(200,1/slope):null,k2=k1?Math.max(0.01,Math.min(8,intercept*k1)):null;
  var mean=thrs.reduce(function(a,b){return a+b;},0)/n,sT=0,sR=0;
  for(var i=0;i<n;i++){sT+=(thrs[i]-mean)*(thrs[i]-mean);sR+=(thrs[i]-(slope*eccs[i]+intercept))*(thrs[i]-(slope*eccs[i]+intercept));}
  var r2=sT>0?1-sR/sT:null,fitted=eccs.map(function(e){return Math.max(0,slope*e+intercept);});
  var rs2=eccs.map(function(e,i){return Math.abs(thrs[i]-(slope*e+intercept));});var ss2=rs2.slice().sort(function(a,b){return a-b;}),mad2=ss2[Math.floor(n/2)]||0.001;
  var outliers=rs2.map(function(r){return r>2.5*mad2;});
  return{k1:k1,k2:k2,r2:r2,fitted:fitted,outliers:outliers};
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('on');});
  document.getElementById(id).classList.add('on');
  // restore white area background when leaving trial screen
  if(id!=='trial'){
    var areaEl=document.getElementById('area');
    if(areaEl) areaEl.style.background='';
  }
}
var _sc,_stEl,_pfill;
function getEls(){if(!_sc){_sc=document.getElementById('sc');_stEl=document.getElementById('st');_pfill=document.getElementById('pfill');}}
function setStatus(t){getEls();_stEl.textContent=t;}
function setProgress(done,total,lbl){getEls();_pfill.style.width=(done/total*100)+'%';document.getElementById('pcnt').textContent=done+'/'+total;document.getElementById('plbl').textContent=lbl.toUpperCase();}
function setDebug(sz,ecc){
  var f=floorSize(PPD),eff=Math.max(sz,f);
  if(MODE==='glass'){
    document.getElementById('ds').textContent='coh '+sz.toFixed(3);
    document.getElementById('dd').textContent='k2 '+(eng&&eng.landoltK2?eng.landoltK2.toFixed(2):'1.50');
    document.getElementById('df').textContent='fl '+f.toFixed(3);
    document.getElementById('dp').textContent='ecc '+ecc+'°';
  } else {
    document.getElementById('ds').textContent=sz.toFixed(3)+'°';
    document.getElementById('dd').textContent=eff.toFixed(3)+'°('+Math.round(eff*PPD)+'px)';
    document.getElementById('df').textContent='fl '+f.toFixed(3)+'°';
    document.getElementById('dp').textContent='pop '+popThresh(ecc).toFixed(3)+'°';
  }
}
function sizeBtns(){var bsz=Math.min(Math.max(Math.round(window.innerHeight*0.095),52),88),hgap=Math.min(Math.round(window.innerWidth*0.08),72);document.querySelectorAll('.ab,.bc').forEach(function(b){b.style.width=b.style.height=bsz+'px';});document.querySelectorAll('.ab').forEach(function(b){b.style.fontSize=Math.round(bsz*0.4)+'px';});document.getElementById('mrow').style.gap=hgap+'px';document.getElementById('rpad').style.gap=Math.round(bsz*0.10)+'px';}
function updateButtons(mode){
  var bu=document.getElementById('bup'),bd=document.getElementById('bdown');
  if(mode==='gabor'||mode==='glass'){
    bu.style.visibility='hidden';bd.style.visibility='hidden';
    document.getElementById('bleft').textContent= mode==='glass'?'↺':'↖';
    document.getElementById('bright').textContent=mode==='glass'?'↻':'↗';
  } else {
    // landolt + red-C variants + tumbling-e: all four arrows
    bu.style.visibility='visible';bd.style.visibility='visible';
    document.getElementById('bleft').textContent='←';
    document.getElementById('bright').textContent='→';
  }
}
function flashTrial(sizeDeg,eccDeg,callback){
  getEls();
  var pos=pick(HPOS),gd,tilt,dir;
  if(MODE==='gabor'){
    tilt=pick(TILTS);gd=tilt===0?3:1;drawGabor(_sc,sizeDeg,tilt,1.0);
  } else if(MODE==='glass'){
    dir=pick([-1,1]);gd=dir===1?1:3;
    var k2hint=eng.landoltK2||1.5;
    drawGlass(_sc,sizeDeg,dir,eccDeg,k2hint);
  } else if(MODE==='tumbling-e'){
    gd=pick(GDIRS);drawE(_sc,sizeDeg,gd);
  } else {
    // landolt and all red-C variants
    gd=pick(GDIRS);
    var sc=stimColors(MODE);
    drawC(_sc,sizeDeg,gd,sc.fg,sc.bg);
    // set #area background to match stimulus background
    var areaEl=document.getElementById('area');
    areaEl.style.background=sc.bg;
  }
  eng.gd=gd;eng.pos=pos;eng.acc=false;eng.onR=callback;eng.stimOn=null;eng.eccDeg=eccDeg;eng.sizeDeg=sizeDeg;eng.lastResp=null;eng.lastRT=null;
  function tryPlace(){
    var ok=placeStim(_sc,pos,eccDeg*PPD);
    if(!ok){var ch=(MODE==='landolt'||MODE==='tumbling-e')?0.25:0.5;eng.lastResp=null;eng.lastRT=null;eng.t1=setTimeout(function(){callback(Math.random()<ch);},ITI);return;}
    _sc.style.visibility='hidden';setStatus('· · ·');
    var area=document.getElementById('area'),warned=false;
    function onT(ev){if(warned)return;var r=area.getBoundingClientRect(),t=ev.touches[0]||ev.changedTouches[0];if(!t)return;var dx=t.clientX-(r.left+r.width/2),dy=t.clientY-(r.top+r.height/2);if(Math.sqrt(dx*dx+dy*dy)>r.width*0.20){warned=true;flashFix('var(--orange)',700);setStatus('eyes on cross!');setTimeout(function(){setStatus('');},700);}}
    area.addEventListener('touchstart',onT,{passive:true});
    var statusPrompt=MODE==='gabor'?'tilt? ↖ ↗':MODE==='glass'?'spiral? ← →':'tines? ↑ → ↓ ←';
    eng.t1=setTimeout(function(){_sc.style.visibility='visible';setStatus('');eng.stimOn=performance.now();eng.t2=setTimeout(function(){_sc.style.visibility='hidden';area.removeEventListener('touchstart',onT);eng.t3=setTimeout(function(){eng.acc=true;setStatus(statusPrompt);},MASK);},STIM);},ITI);
  }
  if(!_sc.parentElement||!_sc.parentElement.clientWidth){requestAnimationFrame(tryPlace);}else{tryPlace();}
}
function respond(dirIdx){
  if(!eng||!eng.acc)return;
  var now=performance.now();
  if(now-eng.lastRespondedAt<300)return;
  eng.acc=false;eng.lastRespondedAt=now;
  clearTimeout(eng.t1);clearTimeout(eng.t2);clearTimeout(eng.t3);
  setStatus('');
  var correct=(dirIdx===eng.gd);
  eng.lastRT=eng.stimOn?Math.round(now-eng.stimOn):null;
  eng.lastResp=dirIdx;
  flashFix(correct?'var(--green)':'var(--red)');
  if(eng.onR){var cb=eng.onR;eng.onR=null;cb(correct);}
}
function runBracket(eccIdx,onDone){
  var ecc=ACT[eccIdx],fl=floorSize(PPD);
  var isGlass=(MODE==='glass');
  // Glass: search coherence from 0.5 down to floor
  // Others: search size from startSize down to floor
  var lo=fl,hi=isGlass?0.5:startSize(ecc),current=isGlass?0.4:hi*0.6,trial=0;
  function next(){
    if(trial>=NB){onDone(current);return;}
    trial++;
    setProgress(NP+eccIdx*(NB+NS)+trial,NP+ACT.length*(NB+NS),ACT[eccIdx]+'°  finding range');
    setDebug(current,ecc);
    flashTrial(current,ecc,function(ok){
      if(ok)hi=current;else lo=current;
      current=isGlass?(lo+hi)/2:Math.max(fl,(lo+hi)/2);
      next();
    });
  }
  next();
}
function runStaircase(eccIdx,startSz,startStep,onDone){
  var ecc=ACT[eccIdx],fl=floorSize(PPD),sc={size:startSz,step:startStep,streak:0,reversals:0,lastDir:null},trial=0,hist=eng.history[eccIdx];
  function next(){
    if(trial>=NS||sc.reversals>=14){onDone(calcThreshold(hist));return;}
    setProgress(NP+eccIdx*(NB+NS)+NB+trial,NP+ACT.length*(NB+NS),ACT[eccIdx]+'°  rev '+sc.reversals);
    setDebug(sc.size,ecc);
    flashTrial(sc.size,ecc,function(ok){
      var rec={phase:'staircase',trialN:eng.trialN++,timestamp:new Date().toISOString(),task:MODE,ecc:ecc,posAngle:eng.pos,sizeDeg:sc.size,target:eng.gd,response:eng.lastResp,correct:ok,rt_ms:eng.lastRT,ppd:Math.round(PPD*100)/100,dist_cm:+document.getElementById('sld').value,screenW_cm:+document.getElementById('slw').value,screenPx:+document.getElementById('inpx').value};
      hist.push(rec);hist_push(rec);sc=scStep(sc,ok,fl);trial++;next();
    });
  }
  next();
}
function runAll(eccIdx){
  if(eccIdx>=ACT.length){showResults();return;}
  runBracket(eccIdx,function(est){
    var fl=floorSize(PPD);
    var sz,step;
    if(MODE==='glass'){
      sz   = Math.min(0.9, Math.max(fl*2, est*1.2));  // start just above bracket estimate
      step = glassStartStep();                          // multiplicative ratio 0.25 → size*0.75
    } else {
      sz   = Math.max(fl*2, est);
      step = Math.max(fl, sz*0.30);
    }
    runStaircase(eccIdx,sz,step,function(thresh){
      eng.thresholds[eccIdx]=thresh;
      runAll(eccIdx+1);
    });
  });
}
function hist_push(rec){eng.allH.push(rec);}
function runPractice(){var trial=0;function next(){if(trial>=NP){runAll(0);return;}setProgress(trial,NP+ACT.length*(NB+NS),'practice');setDebug(popThresh(4)*3,4);flashTrial(popThresh(4)*3,4,function(ok){var rec={phase:'practice',trialN:eng.trialN++,timestamp:new Date().toISOString(),task:MODE,ecc:4,posAngle:eng.pos,sizeDeg:popThresh(4)*3,target:eng.gd,response:eng.lastResp,correct:ok,rt_ms:eng.lastRT,ppd:Math.round(PPD*100)/100,dist_cm:+document.getElementById('sld').value,screenW_cm:+document.getElementById('slw').value,screenPx:+document.getElementById('inpx').value};hist_push(rec);trial++;next();});} next();}
function startTask(){
  PPD=calcPPD();
  MODE=document.getElementById('selmode').value;
  // read equiluminant grey value when relevant
  if(MODE==='landolt-red-grey'){
    var greyVal=parseInt(document.getElementById('equilum-grey').value,10);
    EQUILUM_GREY=(!isNaN(greyVal)&&greyVal>=0&&greyVal<=255)?greyVal:128;
  }
  getEls();
  showScreen('trial');
  sizeBtns();
  updateButtons(MODE);
  // Defer calcActive until after the trial screen has painted —
  // getBoundingClientRect() on #area returns 0 until it is visible in the DOM.
  // requestAnimationFrame fires after the browser has done its first layout pass.
  requestAnimationFrame(function(){
    ACT = calcActive(PPD);
    var sid=Date.now().toString(36).toUpperCase();
    var prevK2=eng?eng.landoltK2:null;
    eng={history:ACT.map(function(){return[];}),allH:[],
         thresholds:new Array(ACT.length).fill(null),
         sessionId:sid,sessionStart:new Date().toISOString(),
         trialN:0,gd:1,pos:0,stimOn:null,lastRT:null,lastResp:null,
         acc:false,onR:null,t1:null,t2:null,t3:null,landoltK2:prevK2,lastRespondedAt:0};
    setTimeout(runPractice,250);
  });
}
function storeK2IfLandolt(fitResult){if(MODE==='landolt'&&fitResult&&fitResult.k2){eng.landoltK2=fitResult.k2;}}
function exportCSV(){
  var COLS=['session_id','session_start','trial_n','timestamp','task','phase',
            'ecc_deg','pos_angle_deg','size_deg','target_dir','response_dir',
            'correct','rt_ms','ppd','dist_cm','screen_width_cm','screen_px',
            'target_label','response_label'];
  var DIR_LABEL=['up','right','down','left'];
  var rows=[COLS.join(',')];
  eng.allH.forEach(function(r){
    var tl=DIR_LABEL[r.target]||'';
    var rl=r.response!==null&&r.response!==undefined?DIR_LABEL[r.response]||'':'';
    rows.push([
      r.sessionId||eng.sessionId,
      '"'+(r.sessionStart||eng.sessionStart)+'"',
      r.trialN,
      '"'+r.timestamp+'"',
      r.task,
      r.phase,
      r.ecc,
      r.posAngle,
      (r.sizeDeg||r.size||0).toFixed(4),
      r.target,
      r.response!==null&&r.response!==undefined?r.response:'',
      r.correct?1:0,
      r.rt_ms!==null&&r.rt_ms!==undefined?r.rt_ms:'',
      r.ppd,
      r.dist_cm,
      r.screenW_cm,
      r.screenPx,
      tl,
      rl,
    ].join(','));
  });
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='landolt_'+eng.sessionId+'_'+eng.sessionStart.slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);document.body.removeChild(a);},1000);
}
function showResults(){getEls();_sc.style.visibility='hidden';showScreen('results');
  var thrs=eng.thresholds,hist=eng.allH;
  var vi=ACT.map(function(_,i){return i;}).filter(function(i){return thrs[i]!=null;});
  var ve=vi.map(function(i){return ACT[i];});
  // Glass: fit sensitivity = 1/coherence so E2 is comparable to acuity k2
  var vt=vi.map(function(i){return MODE==='glass'?(1/thrs[i]):thrs[i];});
  var fit=fitMag(ve,vt),k1=fit.k1,k2=fit.k2,r2=fit.r2,fitted=fit.fitted||[],outliers=fit.outliers||[];
  if(MODE==='landolt'&&k2) eng.landoltK2=k2;
  var k2b=k2&&(k2<0.05||k2>5),k1b=k1&&(k1<4||k1>100),r2b=r2!=null&&r2<0.85;
  var modeLabel=MODE==='gabor'?'Gabor — orientation':MODE==='glass'?'Glass patterns — spiral coherence':MODE==='tumbling-e'?'Tumbling E — gap acuity':MODE==='landolt-red-white'?'Landolt C — red on white':MODE==='landolt-red-black'?'Landolt C — red on black':MODE==='landolt-red-grey'?'Landolt C — red on equiluminant grey':'Landolt C — gap acuity';
  document.getElementById('res-mode').textContent=modeLabel;
  // Threshold display: raw coherence in the grid; sensitivity in the chart
  var pg=document.getElementById('pgrid');pg.innerHTML='';
  var k2sub=MODE==='glass'?'integration E₂ — compare to Landolt k₂':'norm ≈ 0.3–1.5°';
  var k1sub=MODE==='glass'?'sensitivity scale (au)':'norm ≈ 15–25';
  [['k₂ / E₂',k2?k2.toFixed(2)+'°':'—',k2b?'outside range':k2sub,k2b],
   ['k₁',k1?k1.toFixed(1):'—',k1b?'outside range':k1sub,k1b],
   ['fit R²',r2!=null?r2.toFixed(3):'—',r2b?'poor fit':'expect > 0.90',r2b]
  ].forEach(function(row){var d=document.createElement('div');d.className='sc2 ac'+(row[3]?' wn':'');d.innerHTML='<div class="sl">'+row[0]+'</div><div class="sv lg'+(row[3]?' wn':'')+'">'+row[1]+'</div><div class="ss'+(row[3]?' wn':'')+'">'+row[2]+'</div>';pg.appendChild(d);});
  var tg=document.getElementById('tgrid');tg.style.gridTemplateColumns='repeat('+ACT.length+',1fr)';tg.innerHTML='';
  // Show raw coherence thresholds in the grid (more intuitive than sensitivity)
  ACT.forEach(function(e,i){
    var raw=thrs[i];
    var disp=raw?(MODE==='glass'?raw.toFixed(2):raw.toFixed(3)+(MODE==='glass'?'':' °')):'—';
    var d=document.createElement('div');d.className='sc2';
    d.innerHTML='<div class="sl">'+e+'°</div><div class="sv md">'+disp+'</div>';
    tg.appendChild(d);
  });
  // Chart: sensitivity (1/C) for Glass, threshold for others
  requestAnimationFrame(function(){
    drawCurveChart(ve,vt,k1,k2,r2,fitted,outliers,MODE==='glass'?'sensitivity (1/C)':'threshold (°)');
    drawTraceChart(hist);
  });
}
function drawCurveChart(eccs,thrs,k1,k2,r2,fitted,outliers,yLabel){
  yLabel=yLabel||'threshold (°)';
  var cv=document.getElementById('cchart'),W=cv.parentElement.offsetWidth-24||460;cv.width=W;cv.height=220;
  var ctx=cv.getContext('2d'),pl=46,pr=14,pt=22,pb=42,pw=W-pl-pr,ph=220-pt-pb;
  var maxT=Math.max.apply(null,thrs.filter(Boolean).concat([0.8]))*1.3,maxE=Math.max.apply(null,eccs.concat([10]))+2;
  function tx(e){return pl+(e/maxE)*pw;}function ty(t){return pt+(1-Math.min(t,maxT)/maxT)*ph;}
  ctx.font='11px monospace';
  [0.1,0.2,0.4,0.6,0.8,1.0,1.2].filter(function(v){return v<=maxT;}).forEach(function(v){var y=ty(v);ctx.strokeStyle='rgba(0,0,0,.05)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(pl+pw,y);ctx.stroke();ctx.fillStyle='rgba(0,0,0,.3)';ctx.textAlign='right';ctx.fillText(v.toFixed(1),pl-5,y+4);});
  [0,2,4,6,8,10,12,14,16].filter(function(e){return e<=maxE;}).forEach(function(e){var x=tx(e);ctx.strokeStyle='rgba(0,0,0,.05)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,pt);ctx.lineTo(x,pt+ph);ctx.stroke();ctx.fillStyle='rgba(0,0,0,.3)';ctx.textAlign='center';ctx.fillText(e,x,pt+ph+16);});
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.textAlign='center';ctx.fillText('eccentricity (°)',pl+pw/2,pt+ph+34);
  ctx.save();ctx.translate(13,pt+ph/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(yLabel,0,0);ctx.restore();
  ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();for(var e=0;e<=maxE;e+=0.3){var t=popThresh(e),x=tx(e),y=ty(t);e===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.textAlign='left';ctx.font='10px monospace';ctx.fillText('P&H pop',tx(Math.min(5,maxE*.4)),ty(popThresh(Math.min(5,maxE*.4)))-7);
  if(k1&&k2){ctx.strokeStyle='#534AB7';ctx.lineWidth=2;ctx.beginPath();for(var e=0;e<=maxE;e+=0.2){var t=(e+k2)/k1,x=tx(e),y=ty(Math.min(t,maxT));e===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
  eccs.forEach(function(e,i){if(!fitted[i])return;ctx.strokeStyle='rgba(83,74,183,.18)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(tx(e),ty(thrs[i]));ctx.lineTo(tx(e),ty(fitted[i]));ctx.stroke();});
  eccs.forEach(function(e,i){var x=tx(e),y=ty(thrs[i]),isO=outliers[i];if(isO){ctx.strokeStyle='#c0392b';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(192,57,43,.18)';ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#c0392b';ctx.textAlign='center';ctx.font='9px monospace';ctx.fillText('outlier',x,y+22);}else{ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}});
  if(k2&&k2<maxE){ctx.strokeStyle='#993C1D';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(tx(k2),pt);ctx.lineTo(tx(k2),pt+ph);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#993C1D';ctx.textAlign='center';ctx.font='10px monospace';ctx.fillText('k2='+k2.toFixed(2)+'°',tx(k2),pt-8);}
  if(r2!=null){ctx.fillStyle='rgba(83,74,183,.65)';ctx.textAlign='right';ctx.font='11px monospace';ctx.fillText('R²='+r2.toFixed(3),pl+pw,pt+14);}
}
function drawTraceChart(history){
  var cv=document.getElementById('tchart'),W=cv.parentElement.offsetWidth-24||460;cv.width=W;cv.height=160;
  var ctx=cv.getContext('2d'),pl=38,pr=8,pt=12,pb=30,pw=W-pl-pr,ph=160-pt-pb;
  var total=history.length||1,maxS=Math.max.apply(null,history.map(function(h){return h.size;}).concat([0.5]))*1.1;
  var pal=['#1a6b3a','#0F6E56','#1D9E75','#378ADD','#534AB7','#993C1D'];
  ctx.font='10px monospace';
  [0.2,0.4,0.6,0.8,1.0].filter(function(v){return v<=maxS;}).forEach(function(v){var y=pt+(1-v/maxS)*ph;ctx.strokeStyle='rgba(0,0,0,.05)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(pl+pw,y);ctx.stroke();ctx.fillStyle='rgba(0,0,0,.28)';ctx.textAlign='right';ctx.fillText(v.toFixed(1),pl-3,y+3);});
  var byE={};history.forEach(function(h){if(!byE[h.ecc])byE[h.ecc]=[];byE[h.ecc].push(h);});
  var offset=0;ACT.forEach(function(ecc,pi){var pts=byE[ecc]||[];if(!pts.length)return;ctx.strokeStyle=pal[pi%pal.length];ctx.lineWidth=1.2;ctx.beginPath();pts.forEach(function(p,i){var x=pl+((offset+i)/total)*pw,y=pt+(1-Math.min(p.size,maxS)/maxS)*ph;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();pts.forEach(function(p,i){var x=pl+((offset+i)/total)*pw,y=pt+(1-Math.min(p.size,maxS)/maxS)*ph;ctx.fillStyle=p.correct?pal[pi%pal.length]:'transparent';ctx.strokeStyle=pal[pi%pal.length];ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);p.correct?ctx.fill():ctx.stroke();});var lx=pl+((offset+pts.length/2)/total)*pw;ctx.fillStyle=pal[pi%pal.length];ctx.textAlign='center';ctx.fillText(ecc+'°',lx,pt+ph+22);offset+=pts.length;});
}
function updateGeo(){
  var ppd=calcPPD(),ac=calcActive(ppd);
  document.getElementById('ld').textContent=document.getElementById('sld').value;
  document.getElementById('lw').textContent=document.getElementById('slw').value;
  document.getElementById('gppd').textContent=ppd.toFixed(1)+' px/deg';
  document.getElementById('geccs').textContent='eccentricities: '+ac.map(function(e){return e+'°';}).join(' · ');
  var ex=ALL_ECCS.filter(function(e){return ac.indexOf(e)<0;});
  document.getElementById('gwarn').textContent=ex.length?ex.map(function(e){return e+'°';}).join(', ')+' excluded':'';
  // also show pixel floor for reference
  var fl=floorSize(ppd);
  var flEl=document.getElementById('gfloor');
  if(flEl) flEl.textContent='pixel floor: '+fl.toFixed(3)+'° ('+Math.round(fl*60*10)/10+' arcmin gap)';
}
window.addEventListener('load',function(){
  var dpr  = window.devicePixelRatio || 1;
  var sw   = window.screen.width;   // CSS logical pixels
  var sh   = window.screen.height;

  document.getElementById('inpx').value  = sw;
  document.getElementById('lauto').textContent = 'auto: '+sw+'px';

  // ── Physical screen width estimation ─────────────────────────────
  // window.screen.width / dpr gives physical pixels, but pixel pitch
  // varies enormously across devices (72–460 PPI) so the generic
  // 0.026 cm/px heuristic (≈96 PPI) is wrong for phones.
  // For known devices we use the manufacturer physical width directly.
  // Fallback: heuristic, user should correct with a ruler.
  var physW_cm = null;

  // Detection by logical resolution + DPR combinations
  // iPhone 16 Pro: 393×852 logical, DPR=3 → physical 71.5mm
  if(sw===393 && sh===852 && dpr===3) physW_cm = 7.15;
  // iPhone 16 Pro Max: 430×932 logical, DPR=3 → physical 77.6mm
  else if(sw===430 && sh===932 && dpr===3) physW_cm = 7.76;
  // iPhone 16 / 15: 390×844 logical, DPR=3 → physical 71.5mm
  else if(sw===390 && sh===844 && dpr===3) physW_cm = 7.15;
  // iPhone 16 Plus / 15 Plus: 430×932, DPR=3 → physical 77.8mm
  else if(sw===430 && sh===932 && dpr===3) physW_cm = 7.78;
  // iPhone SE 3rd gen: 375×667, DPR=2 → physical 58.6mm
  else if(sw===375 && sh===667 && dpr===2) physW_cm = 5.86;
  // iPad common sizes — DPR=2
  else if(sw===768 && dpr===2)  physW_cm = 15.24;
  else if(sw===1024 && dpr===2) physW_cm = 19.74;
  // Fallback: generic heuristic (~96 PPI desktop standard)
  else physW_cm = Math.round(sw / dpr * 0.026);

  document.getElementById('slw').value = physW_cm;
  document.getElementById('lw').textContent = physW_cm;

  document.getElementById('owarn').style.display =
    (window.innerHeight > window.innerWidth) ? 'block' : 'none';
  updateGeo();
});
['sld','slw','inpx'].forEach(function(id){document.getElementById(id).addEventListener('input',updateGeo);});
document.getElementById('selmode').addEventListener('change',function(){
  var greyRow=document.getElementById('equilum-grey-row');
  if(greyRow) greyRow.style.display=(this.value==='landolt-red-grey')?'':'none';
});
document.getElementById('bbeg').addEventListener('click',startTask);
document.getElementById('bres').addEventListener('click',function(){showScreen('setup');updateGeo();});
document.getElementById('bexp').addEventListener('click',exportCSV);
document.addEventListener('keydown',function(ev){var m={ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3};if(m[ev.key]!==undefined){ev.preventDefault();if(ev.repeat)return;respond(m[ev.key]);}});
['bup','bright','bdown','bleft'].forEach(function(id){document.getElementById(id).addEventListener('click',function(){var d=this.dataset.dir;if(d!=='')respond(+d);});});
window.addEventListener('resize',function(){if(document.getElementById('setup').classList.contains('on')){document.getElementById('owarn').style.display=(window.innerHeight>window.innerWidth)?'block':'none';updateGeo();}if(document.getElementById('trial').classList.contains('on'))sizeBtns();});
