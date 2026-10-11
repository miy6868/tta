// 수정 가능한 운행 상수. 시간대가 없는 시험 시각은 기기의 현지 시각을 따른다.
const EXAM_TIME = "2026-10-12T09:00:00";
const MAX_SPEED = 100;
const ACCEL_AUTO = 4;
const ACCEL_KEY = 25;
const FRICTION = 6;
const MIN_SPEED = 8;
const JUMP_VELOCITY = -780;
const GRAVITY = 2200;
const COFFEE_MAX = 100;
const WIDTH = 1280, HEIGHT = 720, GROUND = 532, TRAIN_X = 425;
const STAGE_NAMES = ["무궁화호", "KTX", "자기부상열차", "로켓 열차", "빛의 속도", "차원 이동"];
const STAGE_CAPTIONS = ["시작은 언제나 평범했다.", "속도가 의지를 따라잡는다.", "이제 지면도 필요 없다.", "중력과의 협상이 결렬됐다.", "빛도 잠시 길을 비켰다.", "시험은 다른 차원에서도 온다."];
const COLLISION_LINES=["일영은 멈추지 않는다.","방금 뭐 밟았냐?","이 정도로는 못 막는다.","장애물이 일영에게 길을 비켰다.","데미지 0. 정신력 100.","침대는 시험 끝나고 만나자."];
const OBSTACLE_NAMES=['침대','폰 알림','유튜브 추천','졸음 구름','배고픔'];
const BRAKE_LINES=["브레이크는 시험 끝나고 지급됩니다.","브레이크 부품 수급 지연 중입니다.","이 열차에는 브레이크라는 개념이 없습니다.","브레이크를 누르셨습니다. 가속 완료.","고객님의 브레이크는 이미 반납되었습니다.","그만 눌러. 더 빨라져."];
const STATIONS=['공부시작역','벼락치기역','카페인역','새벽3시역','시험장역'];
const STATION_LINES=["이번 역은 공부시작역입니다. 일영님은 이미 시작하셨습니다.","이번 역은 벼락치기역입니다. 내리실 분은 안 계십니다.","이번 역은 카페인역입니다. 이 열차는 정차하지 않습니다.","이번 역은 새벽3시역입니다. 졸음 구름 주의하시기 바랍니다.","이번 역은 종착, 시험장역입니다. 일영님, 준비되셨습니까."];
const LITERATURE_STOPS=['청산별곡역','시조역','가시리역'];
const $ = id => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
const state = {
  speed: MIN_SPEED, autoSpeed: MIN_SPEED, coffee: 30, progress: 0, stage: 1,
  time: 0, scroll: 0, lastTs: 0, scale: 1, offsetX: 0, offsetY: 0, dpr: 1,
  width: 1280, height: 720, jumpY: 0, jumpV: 0, onGround: true,
  obstacles: [], coffees: [], particles: [], texts: [], signs: [],
  cleared: 0, coffeesTaken: 0, brakeCount: 0, input: {keys: new Set(), wheelUntil: 0, touches: new Set()},
  examAt: 0, startRemaining: 0, remaining: 0, lastCountdown: -1,
  flash: 0, evolutionTimer: 0, invincible: 0, overdrive: 0, ending: false, endingTime: 0,
  bubbleUntil: 0, sound: false, audio: null, engine: null, engineGain: null
};

function init() {
  const exam = new URLSearchParams(location.search).get("exam");
  const parsed = exam ? Date.parse(exam) : NaN;
  state.examAt = Number.isFinite(parsed) ? parsed : Date.parse(EXAM_TIME);
  state.requestedExamAt=state.examAt;
  state.startRemaining = Math.max(0, state.examAt - Date.now());
  state.remaining = state.startRemaining;
  resize(); handleInput(); updateCountdown();
  document.querySelector(".route").hidden=false;
  window.addEventListener("resize", resize);
  if(new URLSearchParams(location.search).get("demo")==="end" || state.remaining<=0)triggerEnding();
  requestAnimationFrame(loop);
}

function resize() {
  state.width = window.innerWidth; state.height = window.innerHeight;
  state.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(state.width * state.dpr); canvas.height = Math.round(state.height * state.dpr);
  state.scale = Math.min(state.width / WIDTH, state.height / HEIGHT);
  state.offsetX = (state.width - WIDTH * state.scale) / 2;
  state.offsetY = (state.height - HEIGHT * state.scale) / 2;
}

function handleInput() {
  window.addEventListener("keydown", e => {
    if (e.target instanceof HTMLButtonElement && (e.code === "Space" || e.code === "Enter")) return;
    if (["ArrowRight", "KeyD", "Space", "ArrowUp", "KeyB"].includes(e.code)) e.preventDefault();
    state.input.keys.add(e.code);
    if(!e.repeat && (e.code==='Space'||e.code==='ArrowUp'))jump();
    if(!e.repeat && e.code==='KeyB')brake();
  });
  $("brake").addEventListener("click",brake);
  $("restart").addEventListener("click",resetGame);
  $("sound").addEventListener("click",toggleSound);
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'||state.ending)return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
    if(e.clientX<state.width/2)state.input.touches.add(e.pointerId);else jump();
  });
  const releasePointer=e=>state.input.touches.delete(e.pointerId);
  canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
  document.addEventListener('visibilitychange',()=>{
    state.lastTs=0;state.input.keys.clear();state.input.touches.clear();state.input.wheelUntil=0;
    updateCountdown();
    if(state.engineGain&&state.audio)state.engineGain.gain.setTargetAtTime(document.hidden?0:state.sound?.018:0,state.audio.currentTime,.04);
  });
  window.addEventListener("keyup", e => state.input.keys.delete(e.code));
  window.addEventListener("wheel", e => { if(e.deltaY > 0) state.input.wheelUntil = performance.now() + 280; e.preventDefault(); }, {passive:false});
  window.addEventListener("blur", () => {state.input.keys.clear(); state.input.touches.clear(); state.input.wheelUntil=0;});
}

function updateCountdown() {
  state.remaining = state.ending ? 0 : Math.max(0, state.examAt - Date.now());
  const seconds = Math.ceil(state.remaining / 1000);
  if (seconds !== state.lastCountdown) {
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
    $("countdown").textContent = [h,m,s].map(n=>String(n).padStart(2,"0")).join(":");
    $("countdown").classList.toggle("urgent", seconds > 0 && seconds < 3600);
    state.lastCountdown = seconds;
  }
}

function update(dt) {
  state.time += dt; updateCountdown(); updateAudio();
  if(state.ending){updateEnding(dt);updateParticles(dt);updateBubble();return;}
  updateStations(dt);
  if(state.remaining<=0){triggerEnding();return;}
  const accelerating = state.input.keys.has("ArrowRight") || state.input.keys.has("KeyD") || state.input.touches.size > 0 || performance.now() < state.input.wheelUntil;
  // 자동 주행 속도는 계속 상승하고, 입력으로 더해진 여분의 관성에만 마찰을 적용한다.
  state.autoSpeed = Math.min(MAX_SPEED, state.autoSpeed + ACCEL_AUTO * dt);
  state.speed = accelerating ? Math.min(MAX_SPEED, state.speed + (ACCEL_AUTO + ACCEL_KEY) * dt) : Math.max(state.autoSpeed, state.speed + (ACCEL_AUTO - FRICTION) * dt);
  state.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED,state.speed));
  state.scroll += worldSpeed() * dt;
  updateCoffee(dt); updateObstacles(dt); updateBubble();
  updateStage(dt);
  updateEffects(dt); updateParticles(dt);
  $("speed").textContent = String(Math.round(state.speed)).padStart(3,"0");
}

function gradient(y1,y2,colors) { const g=ctx.createLinearGradient(0,y1,0,y2); colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c)); return g; }
function rounded(x,y,w,h,r,fill,stroke) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function circle(x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.lineWidth=1;}

function drawDuskBackground() {
  ctx.fillStyle=gradient(0,720,["#192124","#674437","#bc7747","#243527"]);ctx.fillRect(0,0,1280,720);
  const far=state.scroll*.1, middle=state.scroll*.4;
  const glow=ctx.createRadialGradient(939,346,5,939,346,235);glow.addColorStop(0,"#ffb25e3f");glow.addColorStop(1,"#f9994200");ctx.fillStyle=glow;ctx.fillRect(650,150,590,400);
  circle(949,350,65,"#efb371");
  for(let i=0;i<7;i++){const x=((i*277-far*.3)%1700+1700)%1700-180;rounded(x,255+(i%3)*35,180+(i%2)*80,4,2,"#e8b78d12");}
  for(let layer=0;layer<3;layer++) {
    ctx.beginPath();ctx.moveTo(-100,600);
    for(let x=-100;x<=1380;x+=20){const q=x+far*(layer+1);const y=435+layer*38+Math.sin(q*.006+layer)*25+Math.sin(q*.014+layer*3)*17;ctx.lineTo(x,y);}
    ctx.lineTo(1380,720);ctx.closePath();ctx.fillStyle=["#4a4c38","#343f30","#293a2b"][layer];ctx.fill();
  }
  for(let i=0;i<16;i++) {const x=((i*103-middle)%1700+1700)%1700-140;const y=482+(i%3)*10;line(x,y,x,GROUND,"#202e23",3);polygon([[x-10,y+3],[x,y-17],[x+10,y+3]],"#27382a");}
  ctx.fillStyle=gradient(535,720,["#233327","#18251f","#17231e"]);ctx.fillRect(0,535,1280,185);
  for(let i=0;i<24;i++){const x=((i*72-state.scroll)%1700+1700)%1700-170;polygon([[x,540],[x+25,540],[x+38,551],[x+6,551]],"#685940");line(x+7,539,x+26,539,"#a48b64",1);}
  line(0,534,1280,534,"#b4b1a0",2);line(0,538,1280,538,"#514d3b",3);line(0,548,1280,548,"#868774",2);
  for(let i=0;i<18;i++){const x=((i*95-state.scroll*1.3)%1800+1800)%1800-200;line(x,578,x+28,578,"#a5ad7910");}
}

function drawLocalTrain() {
  ctx.save();ctx.translate(TRAIN_X,GROUND+state.jumpY);
  ctx.fillStyle="#0005";ctx.beginPath();ctx.ellipse(-139,10,169,9,0,0,Math.PI*2);ctx.fill();
  for(let i=2;i>=0;i--){const x=-109*(i+1);
    rounded(x+4,-70,104,57,4,gradient(-70,-13,["#e6d8b5","#b9b7a0"]),"#111e18");
    rounded(x+5,-72,102,7,3,"#abb099");ctx.fillStyle="#376350";ctx.fillRect(x+5,-36,102,13);ctx.fillStyle="#b05843";ctx.fillRect(x+5,-23,102,5);
    for(let j=0;j<4;j++){rounded(x+11+j*22,-59,17,17,2,"#263e3e","#80958a");ctx.fillStyle="#b9d1b62b";ctx.fillRect(x+13+j*22,-57,3,13);}
    for(const wx of [x+24,x+84]){circle(wx,-8,9,"#111d18");circle(wx,-8,5,"#788276");circle(wx,-8,2,"#c6c1a0");}
    line(x+8,-10,x+100,-10,"#17261c",3);line(x+106,-18,x+113,-18,"#91a091",3);
    if(i===0){rounded(x+79,-61,21,48,2,null,"#6c8570");line(x+97,-39,x+97,-34,"#cfd4b7",2);circle(x+107,-40,3,"#ffd08c");}
  }
  ctx.font="bold 8px sans-serif";ctx.fillStyle="#e5e4ce";ctx.fillText("일영 익스프레스",-199,-27);
  ctx.restore();
}

function render() {
  ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
  // 고속에서도 기존 픽셀을 남긴다. 배경도 반투명 합성해야 잔상이 지워지지 않는다.
  const trail=state.speed>=50 && !state.ending;
  const alpha=.35-Math.max(0,state.speed-50)/50*.25;
  ctx.fillStyle=trail?`rgba(0,0,0,${alpha})`:"#192320";ctx.fillRect(0,0,state.width,state.height);
  ctx.translate(state.offsetX,state.offsetY);ctx.scale(state.scale,state.scale);
  ctx.save();const shake=Math.max(0,(state.speed-30)/70)*6*(state.coffee>=80?2:1);
  ctx.translate((Math.random()-.5)*shake*2,(Math.random()-.5)*shake*2);
  ctx.globalAlpha=trail?.28:1;drawBackground(state.stage);ctx.globalAlpha=1;
  drawSigns();drawParticles();
  for(const o of state.obstacles)drawObstacle(o);
  for(const c of state.coffees)drawCoffee(c);
  drawLightning();
  if(state.invincible<=0 || Math.floor(state.time*12)%2===0)drawTrain(state.stage);
  drawFloatingTexts();ctx.restore();
  if(state.flash > 0){ctx.save();ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.fillStyle=`rgba(255,255,255,${state.flash / .6 * .65})`;ctx.fillRect(0,0,state.width,state.height);ctx.restore();}
  if(state.ending)drawEnding();
}

function loop(ts) {const dt=state.lastTs?Math.min(.05,(ts-state.lastTs)/1000):0;state.lastTs=ts;update(dt);render();requestAnimationFrame(loop);}


// Phase 2 · 여섯 개의 세계. 속도 경계는 실제 값으로 판단한다.
function updateStage(dt) {
  state.flash=Math.max(0,state.flash-dt); state.evolutionTimer=Math.max(0,state.evolutionTimer-dt);
  const next=state.speed<20?1:state.speed<40?2:state.speed<60?3:state.speed<80?4:state.speed<95?5:6;
  if(next!==state.stage){
    state.stage=next;state.flash=.6;state.evolutionTimer=1.2;
    $('evolution').textContent=`열차 진화: ${STAGE_NAMES[next-1]}`;
    $('trainName').textContent=STAGE_NAMES[next-1];$('stageNumber').textContent=String(next).padStart(2,'0');
    $('stageCaption').textContent=STAGE_CAPTIONS[next-1];
    document.querySelectorAll('.stage-ticks i').forEach((el,i)=>el.classList.toggle('active',i<next));
  }
  $('evolution').classList.toggle('visible',state.evolutionTimer>0);
  document.body.classList.toggle('fast',state.stage>=3);
}

function drawBackground(stage) {
  if(stage===1){drawDuskBackground();return;}
  const palettes=[null,null,['#142e43','#40728a','#86a5ab','#1e3039'],['#111824','#21233e','#36305c','#111b2b'],['#1e2436','#52516d','#ba8390','#2a3045'],['#221a36','#3f2b60','#74538a','#231c35'],['#0b1121','#151932','#222241','#0e1526']];
  ctx.fillStyle=gradient(0,720,palettes[stage]);ctx.fillRect(0,0,1280,720);
  const far=state.scroll*.1,mid=state.scroll*.4;
  if(stage===2){
    circle(1000,305,42,'#d6e6de');
    for(let i=0;i<8;i++){const x=wrap(i*231-far,1650)-160,y=290+(i%3)*48;rounded(x,y,150,12,8,'#dce9e120');rounded(x+40,y-10,86,15,10,'#dce9e115');}
    for(let l=0;l<3;l++){const pts=[[-100,650]];for(let x=-100;x<=1400;x+=25)pts.push([x,450+l*30+Math.sin((x+far*(l+1))*.009)*25+Math.cos((x+far)*.025)*9]);pts.push([1400,720]);polygon(pts,['#456274','#324e61','#283f51'][l]);}
    for(let i=0;i<7;i++){const x=wrap(i*310-mid,1900)-240;line(x,375,x,535,'#233747',5);line(x-29,390,x+29,390,'#233747',4);line(x-22,380,x-22,399,'#819795',3);line(x+22,380,x+22,399,'#819795',3);line(x,386,x+310,404,'#243948',1);}
  } else if(stage===3){
    drawStars(far,48);circle(947,276,29,'#deddd5');circle(958,269,27,'#242439');
    for(let l=0;l<2;l++)for(let i=0;i<20;i++){
      const x=wrap(i*89-mid*(l?.8:.3),1700)-130,h=45+((i*47+l*39)%145),w=47+(i%3)*13,y=530-h;
      ctx.fillStyle=l?'#152333':'#292d47';ctx.fillRect(x,y,w,h);
      for(let a=0;a<4;a++)for(let b=0;b<Math.floor(h/16);b++)if((a*7+b+i)%4===0){ctx.fillStyle=l?'#dfb67b80':'#a2b6d840';ctx.fillRect(x+8+a*11,y+12+b*15,4,6);}
      if(i%5===0)line(x+w/2,y,x+w/2,y-15,'#838097');
    }
  } else if(stage===4){
    for(let i=0;i<25;i++){const x=(i*139)%1300,y=wrap(i*151+state.scroll*.7,920)-160;line(x,y,x,y+90+i%80,'#d5ced529',1+i%2);}
    for(let i=0;i<10;i++){const x=wrap(i*231-mid,1700)-200,y=200+wrap(i*173+state.scroll*.22,550);drawCloud(x,y,1.5,'#e8c9cb20');}
  } else if(stage===5){
    for(let i=0;i<65;i++){const x=wrap(i*89-state.scroll*(.4+i%3*.3),1800)-400,y=190+(i*47)%400;line(x,y,x+120+(i%5)*70,y,i%3?'#d6b4f333':'#f3e9ff55',1+i%3);}
    const g=ctx.createRadialGradient(1150,445,1,1150,445,470);g.addColorStop(0,'#f5e4ff60');g.addColorStop(1,'#5b3d8500');ctx.fillStyle=g;ctx.fillRect(600,0,680,720);
  } else {
    for(let i=0;i<70;i++){const x=wrap(i*31-far*.15,1480)-100,y=360+Math.sin(i*.21)*55-i*2;circle(x,y,1+(i%4),'#af90ef0d');}
    drawStars(far,115);
    circle(1010,322,47,'#908379');circle(998,311,42,'#b8a18c');
    ctx.save();ctx.translate(1010,325);ctx.rotate(-.28);ctx.scale(1,.25);ctx.strokeStyle='#c8b6a37a';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(0,0,83,48,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    if(Math.sin(state.time*.12)>-.3){circle(754,398,15,'#408fa5');polygon([[750,385],[763,393],[755,398],[758,407],[746,402]],'#80b391');}
  }
  if(stage<6){
    ctx.fillStyle=gradient(537,720,['#172a3280','#142128']);ctx.fillRect(0,538,1280,182);
    for(let i=0;i<24;i++){const x=wrap(i*72-state.scroll,1728)-100;polygon([[x,540],[x+24,540],[x+35,550],[x+4,550]],stage===3?'#315369':'#4c515d');}
    line(0,534,1280,534,stage===3?'#50cbfa':'#b9bec1',2);line(0,548,1280,548,stage===3?'#357eab':'#737786',2);
  }
}
function wrap(n,m){return (n%m+m)%m;}
function drawCloud(x,y,s,color){ctx.save();ctx.translate(x,y);ctx.scale(s,s);circle(-20,0,24,color);circle(10,-9,31,color);circle(39,3,23,color);rounded(-35,0,87,23,13,color);ctx.restore();}
function drawStars(scroll,count){for(let i=0;i<count;i++){const x=wrap(i*147.73-scroll,1400)-60,y=180+(i*83.37)%350;circle(x,y,i%5===0?1.6:.7,`rgba(225,230,255,${.25+(Math.sin(i+state.time)*.5+.5)*.6})`);}}

function drawTrain(stage) {
  ctx.save();if(state.coffee>=80)ctx.translate(Math.sin(state.time*85)*4,0);
  if(stage===1){drawLocalTrain();ctx.restore();return;}
  ctx.save();ctx.translate(TRAIN_X,GROUND+state.jumpY-(stage===3?12:0));
  const rainbow=ctx.createLinearGradient(-330,0,10,0);['#ff7e99','#ffd382','#84edcf','#8bb7ff','#dca1ff'].forEach((c,i)=>rainbow.addColorStop(i/4,c));
  if(stage===6)ctx.globalAlpha=.7;
  if(stage>=5){ctx.shadowColor=stage===5?'#eee5ff':'#97beff';ctx.shadowBlur=24;rounded(-336,-65,344,49,23,stage===5?'#f3ebffd9':rainbow);for(let i=0;i<6;i++)line(-400-i*10,-22-i*8,-10,-22-i*8,stage===5?'#efe5ff44':'#a1c8ff40',4);ctx.shadowBlur=0;}
  if(stage===5){line(-360,-42,15,-42,'#fff',12);ctx.restore();ctx.restore();return;}
  const body=stage===2?gradient(-75,-10,['#e6e7dd','#bbc4c6','#889aa2']):stage===3?'#c1dbe4':stage===4?'#ddd1c3':rainbow;
  for(let i=3;i>=1;i--){const x=-i*80-83;rounded(x,-66,78,47,8,body,'#243e4c');rounded(x+9,-55,62,15,4,'#214555');line(x+3,-30,x+76,-30,stage===3?'#68deff':'#4e7e95',stage===3?4:3);if(stage===2)for(const wx of [x+15,x+62]){circle(wx,-10,7,'#152634');circle(wx,-10,3,'#8a969d');}}
  ctx.beginPath();ctx.moveTo(-80,-66);ctx.lineTo(-32,-66);ctx.quadraticCurveTo(-11,-66,4,-35);ctx.quadraticCurveTo(13,-18,-9,-17);ctx.lineTo(-80,-17);ctx.closePath();ctx.fillStyle=body;ctx.fill();ctx.strokeStyle='#314454';ctx.stroke();
  polygon([[-43,-59],[-31,-59],[-13,-39],[-43,-39]],'#224452');line(-80,-29,3,-29,stage===3?'#6be9ff':'#426b8a',4);
  if(stage===2){circle(-53,-10,7,'#152634');circle(-53,-10,3,'#8a969d');}
  if(stage===3){ctx.shadowColor='#67d9ff';ctx.shadowBlur=15;line(-319,-7,-8,-7,'#85e6ff',3);ctx.shadowBlur=0;}
  if(stage===4){polygon([[-300,-58],[-282,-93],[-262,-60]],'#b86251');polygon([[-300,-22],[-282,4],[-254,-22]],'#b86251');const flame=40+Math.sin(state.time*38)*14;polygon([[-323,-59],[-323-flame,-43],[-323,-25]],'#ed7741');polygon([[-324,-53],[-351,-43],[-324,-32]],'#ffdb82');}
  circle(4,-32,3,'#ffe5b1');ctx.fillStyle='#e8eef0';ctx.font='bold 8px sans-serif';ctx.fillText(STAGE_NAMES[stage-1],-184,-34);ctx.restore();ctx.restore();
}


// Phase 3 · 모든 효과는 같은 수명 제한 파티클 풀을 사용한다.
function addParticle(p){if(state.particles.length<300)state.particles.push(p);}
function updateEffects(dt){
  state.emitTimer=(state.emitTimer||0)-dt;state.lineTimer=(state.lineTimer||0)-dt;
  if(state.emitTimer<=0){
    state.emitTimer=.045;
    const stage=state.stage;
    if(stage!==3){const kind=stage<=2?'smoke':stage===4?'flame':'spark';
      addParticle({kind,x:TRAIN_X-321,y:GROUND-42+state.jumpY,vx:-40-state.speed*2,vy:-15-Math.random()*20,life:kind==='smoke'?1.1:.6,maxLife:kind==='smoke'?1.1:.6,r:2+Math.random()*4,color:kind==='smoke'?'#e0ded0':kind==='flame'?'#ffae50':`hsl(${Math.random()*360},90%,75%)`});
    }
  }
  if(state.speed>=40&&state.lineTimer<=0){
    state.lineTimer=.085-(state.speed-40)*.0008;
    if(state.particles.filter(p=>p.kind==='line').length<60)addParticle({kind:'line',x:WIDTH+100,y:205+Math.random()*370,vx:-600-state.speed*15,vy:0,life:1.5,maxLife:1.5,length:30+(state.speed-40)*2+Math.random()*70,r:1,color:'#fff'});
  }
}
function updateParticles(dt){
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.gravity)p.vy+=p.gravity*dt;if(p.kind==='smoke')p.r+=dt*6;}
  state.particles=state.particles.filter(p=>p.life>0&&p.x>-500&&p.y<HEIGHT+100);
}
function drawParticles(){
  ctx.save();for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*(p.kind==='line'?.18:.7);
    if(p.kind==='line')line(p.x,p.y,p.x+p.length,p.y,p.color,p.r);
    else if(p.kind==='star')drawStar(p.x,p.y,p.r,p.color);
    else circle(p.x,p.y,p.r,p.color);
  }ctx.restore();
}
function drawStar(x,y,r,color){const points=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.4:r;points.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}polygon(points,color);}


// Phase 4 · 충돌은 사고가 아닌, 또 하나의 안내방송이다.
function worldSpeed(){return 700+state.speed*5;}
function jump(){if(state.ending||!state.onGround)return;state.jumpV=JUMP_VELOCITY;state.onGround=false;beep(340,.12,660);}
function trainBounds(){
  // 보이는 전체 객차의 폭/높이를 각각 90%로 축소, 중심 정렬.
  const w=state.stage===1?327:340,h=state.stage===1?72:66,levitate=state.stage===3?12:0;
  return {x:TRAIN_X-w+w*.05,y:GROUND+state.jumpY-levitate-h+h*.05,w:w*.9,h:h*.9};
}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function spawnObstacle(){
  if(state.obstacles.length||state.ending)return;
  if(!state.obstacleBag?.length)state.obstacleBag=[0,1,2,3,4].sort(()=>Math.random()-.5);
  const type=state.obstacleBag.pop(),w=[75,45,70,80,57][type],h=[48,70,49,51,57][type];
  state.obstacles.push({type,x:WIDTH+75,y:GROUND-h,w,h,passed:false});
}
function updateObstacles(dt){
  state.invincible=Math.max(0,state.invincible-dt);
  if(!state.onGround){state.jumpY+=state.jumpV*dt+.5*GRAVITY*dt*dt;state.jumpV+=GRAVITY*dt;if(state.jumpY>=0){state.jumpY=0;state.jumpV=0;state.onGround=true;}}
  state.obstacleTimer=(state.obstacleTimer??2.7)-dt;
  if(state.obstacleTimer<=0&&state.obstacles.length===0){spawnObstacle();state.obstacleTimer=Math.max(.8,(1.5+Math.random()*2)*(1-state.speed/150));}
  const bounds=trainBounds();
  for(const o of state.obstacles){
    o.x-=worldSpeed()*dt;
    if(overlap(bounds,o)){
      if(state.overdrive>0){state.cleared++;$('cleared').textContent=state.cleared;floatText('+1 돌파',o.x,o.y-20,'#ffe864');}
      else if(state.invincible<=0){state.speed=Math.max(MIN_SPEED,state.speed*.7);state.autoSpeed=Math.min(state.autoSpeed,state.speed);state.invincible=2;beep(110,.16,55);showBubble(COLLISION_LINES[Math.floor(Math.random()*COLLISION_LINES.length)],'#ffd7b0',3000);}
      shatter(o.x+o.w/2,o.y+o.h/2);o.remove=true;
    } else if(o.x+o.w<bounds.x&&!o.passed){o.passed=true;o.remove=true;state.cleared++;floatText('+1 돌파',TRAIN_X-130,GROUND-110,'#ffdc8c');$('cleared').textContent=state.cleared;}
  }
  state.obstacles=state.obstacles.filter(o=>!o.remove&&o.x>-150);
  state.texts.forEach(t=>{t.life-=dt;t.y-=dt*28;});state.texts=state.texts.filter(t=>t.life>0);
}
function shatter(x,y){for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,v=70+Math.random()*170;addParticle({kind:'star',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,gravity:350,life:.8,maxLife:.8,r:3+Math.random()*5,color:['#ffcf75','#ef997b','#fff2bb'][i%3]});}}
function floatText(text,x,y,color){state.texts.push({text,x,y,color,life:1.2});}
function drawFloatingTexts(){ctx.save();ctx.font='bold 18px sans-serif';ctx.textAlign='center';for(const t of state.texts){ctx.globalAlpha=Math.min(1,t.life*2);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x,t.y);}ctx.restore();}
function showBubble(text,color='#e1dfcc',ms=4000){if(state.stationUntil>state.time){state.deferredBubble={text,color,ms};return;}$('bubble').textContent=text;$('bubble').style.color=color;state.bubbleUntil=state.time+ms/1000;}
function updateBubble(){if(state.stationUntil>state.time)return;if(state.stationQueue?.length){announceNextStation();return;}if(state.deferredBubble){const b=state.deferredBubble;state.deferredBubble=null;showBubble(b.text,b.color,b.ms);return;}if(state.bubbleUntil&&state.time>=state.bubbleUntil){state.bubbleUntil=0;$('bubble').style.color='';$('bubble').textContent='일영은 달리고 있습니다. 예정된 정차는 없습니다.';}}
function drawObstacle(o){
  ctx.save();ctx.translate(o.x,o.y);
  ctx.shadowColor='#05081366';ctx.shadowBlur=10;
  if(o.type===0){
    rounded(0,10,75,31,4,'#ded3c0');rounded(3,1,21,18,5,'#f4e6d4');rounded(26,3,49,36,3,'#ba827d');
    for(let i=0;i<4;i++)line(33+i*11,5,33+i*11,37,'#efd9ba',3);line(5,40,5,48,'#b09e83',5);line(70,40,70,48,'#b09e83',5);
    ctx.fillStyle='#f4dcc2';ctx.font='italic 17px serif';ctx.fillText('Zzz',18,-11);
  } else if(o.type===1){
    rounded(0,0,45,70,7,'#aaa9b1');rounded(4,5,37,58,4,'#35475c');line(16,4,29,4,'#333742',2);circle(22,66,2,'#e8e0d9');
    for(let i=0;i<3;i++){rounded(9,17+i*13,26,8,2,'#71909c');}circle(38,5,15,'#eb644f');ctx.fillStyle='#fff4e9';ctx.font='bold 10px sans-serif';ctx.fillText('99+',27,9);
  } else if(o.type===2){rounded(0,0,70,49,11,'#d9544b');polygon([[28,13],[28,37],[49,25]],'#fff0d9');}
  else if(o.type===3){drawCloud(33,23,.8,'#aaa9bc');line(17,29,29,29,'#4b4a60',2);line(43,29,55,29,'#4b4a60',2);ctx.fillStyle='#696679';ctx.font='11px serif';ctx.fillText('Zzz',53,-1);}
  else {circle(28,28,28,'#d6ac84');circle(28,30,3,'#ac795d');line(12,21,19,23,'#97705a',2);line(37,23,44,21,'#97705a',2);ctx.fillStyle='#efd6b3';ctx.font='bold 12px sans-serif';ctx.fillText('꼬르륵',11,-8);}
  ctx.shadowBlur=0;ctx.fillStyle='#d9ddcf';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(OBSTACLE_NAMES[o.type],o.w/2,o.h+23);ctx.restore();
}


// Phase 5 · 브레이크와 커피, 둘 다 가속 장치다.
function brake(){
  if(state.ending)return;
  state.brakeCount++;state.speed=Math.min(MAX_SPEED,state.speed+10);
  showBubble(BRAKE_LINES[state.brakeCount<=6?state.brakeCount-1:Math.floor(Math.random()*6)],'#ff8374',4500);
  floatText('+10 가속',TRAIN_X-80,GROUND-115,'#ff9c7c');
  if(state.brakeCount>=10){$('brakeLabel').textContent='?';$('brake').setAttribute('aria-label','도망가는 브레이크, 가속 기능');}
  if(state.brakeCount>=20){moveBrake();state.brakeEscapeAt=state.time+.85;}
}
function moveBrake(){
  const button=$('brake'),w=178,h=66,edge=Math.floor(Math.random()*4);
  button.style.position='fixed';button.style.width=w+'px';button.style.zIndex='12';
  // 화면 가장자리 밖으로 도망가되 조금 남겨 두어 다시 누를 수 있다.
  let x=Math.random()*Math.max(0,state.width-w),y=90+Math.random()*Math.max(0,state.height-190);
  if(edge===0)x=-w+35;else if(edge===1)x=state.width-35;else if(edge===2)y=-h+20;else y=state.height-22;
  button.style.left=x+'px';button.style.top=y+'px';
}
function spawnCoffee(){
  if(state.coffees.length||state.ending)return;
  state.coffees.push({x:WIDTH+50,y:GROUND-153,w:35,h:40,phase:Math.random()*6});
}
function collectCoffee(c){
  beep(620,.15,990);c.remove=true;state.coffeesTaken++;state.coffee=Math.min(COFFEE_MAX,state.coffee+25);state.speed=Math.min(MAX_SPEED,state.speed+8);
  floatText('카페인 투입',c.x,c.y-13,'#ffe19d');showBubble('카페인 투입. 일영의 연료는 의지와 커피입니다.','#ffe0a0',2500);
  if(state.coffee>=COFFEE_MAX&&state.overdrive<=0){state.overdrive=3;showBubble('카페인 폭주 모드. 이제 장애물이 피해 가세요.','#ecb4ff',3000);}
}
function updateCoffee(dt){
  if(state.overdrive>0){state.overdrive=Math.max(0,state.overdrive-dt);if(state.overdrive===0)state.coffee=60;}
  else state.coffee=Math.max(0,state.coffee-2*dt);
  state.coffeeTimer=(state.coffeeTimer??7)-dt;
  if(state.coffeeTimer<=0&&!state.coffees.length&&!state.obstacles.some(o=>o.x>WIDTH-250)){
    spawnCoffee();state.coffeeTimer=6+Math.random()*4;
  }
  const bounds=trainBounds();
  for(const c of state.coffees){c.x-=worldSpeed()*dt;c.drawY=c.y+Math.sin(state.time*2+c.phase)*5;if(overlap(bounds,{...c,y:c.drawY}))collectCoffee(c);}
  state.coffees=state.coffees.filter(c=>!c.remove&&c.x>-100);
  if(state.coffee>=80&&state.overdrive<=0&&state.time>(state.caffeineBubbleAt||0)){
    showBubble(Math.random()<.5?'손이 떨린다…':'심장이 BPM 200','#f9be82',2500);state.caffeineBubbleAt=state.time+7;
  }
  if(state.brakeCount>=20&&state.time>state.brakeEscapeAt){moveBrake();state.brakeEscapeAt=state.time+1.2;}
  $('coffeeValue').textContent=Math.round(state.coffee);$('coffeeFill').style.width=state.coffee+'%';
  $('coffeeFill').style.background=state.coffee>=80?'#d7a0ff':'#e3b46e';$('coffeeMeter').setAttribute('aria-valuenow',Math.round(state.coffee));
  $('coffeeStatus').textContent=state.overdrive>0?'과학으로 설명할 수 없는 상태.':state.coffee>=80?'권장 섭취량? 그런 건 잊었다.':'커피 한 잔의 힘을 믿습니다.';
  $('overdrive').hidden=state.overdrive<=0;
}
function drawCoffee(c){
  ctx.save();ctx.translate(c.x,c.drawY??c.y);ctx.shadowColor='#ffd78c';ctx.shadowBlur=16;
  rounded(0,8,30,30,4,'#ac784e');rounded(29,14,10,17,4,null,'#d9b488');ctx.shadowBlur=0;
  rounded(-2,4,34,7,3,'#e7d0a5');rounded(2,15,26,14,2,'#e7c28e');ctx.fillStyle='#795535';ctx.font='bold 10px sans-serif';ctx.fillText('커피',4,26);
  for(let i=0;i<3;i++){const x=5+i*9;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+7,-7,x-5,-12,x+Math.sin(state.time*3+i)*3,-19);ctx.strokeStyle='#f5e4c980';ctx.stroke();}ctx.restore();
}
function drawLightning(){
  if(state.overdrive<=0)return;
  const frame=Math.floor(state.time*8);
  ctx.save();ctx.globalAlpha=.6;ctx.lineWidth=3;
  for(let i=0;i<6;i++){const x=80+i*223+Math.sin(frame+i)*45;ctx.beginPath();ctx.moveTo(x,190);ctx.lineTo(x-35,280);ctx.lineTo(x+16,270);ctx.lineTo(x-28,370);ctx.strokeStyle=i%2?'#e4b6ff':'#ffee6c';ctx.stroke();}
  ctx.restore();
}


// Phase 6 · 시간표만이 이 열차의 도착을 결정한다. 속도는 진행도에 관여하지 않는다.
function updateStations(dt){
  state.progress=state.startRemaining>0?Math.max(0,Math.min(1,(state.startRemaining-state.remaining)/state.startRemaining)):1;
  state.stationsPassed=state.stationsPassed||0;state.stationQueue=state.stationQueue||[];
  while(state.stationsPassed<5&&state.progress+1e-9>=(state.stationsPassed+1)/5){
    state.stationQueue.push(state.stationsPassed);state.stationsPassed++;
  }
  if(!(state.stationUntil>state.time)&&state.stationQueue.length)announceNextStation();
  if(state.stationsPassed>=3){
    state.literatureTimer=(state.literatureTimer??30)-dt;
    if(state.literatureTimer<=0){state.signs.push({x:WIDTH+40,name:LITERATURE_STOPS[(state.literatureIndex||0)%3],fake:true});state.literatureIndex=(state.literatureIndex||0)+1;state.literatureTimer=30;}
  }
  for(const sign of state.signs)sign.x-=worldSpeed()*.4*dt;
  state.signs=state.signs.filter(s=>s.x>-230);
  const percent=state.progress*100;
  $('routeFill').style.width=percent+'%';$('routeTrain').style.left=percent+'%';$('progressText').textContent=Math.floor(percent)+'% 이동';
  $('routeTrack').setAttribute('aria-valuenow',Math.floor(percent));
  document.querySelectorAll('.stations span').forEach((s,i)=>s.classList.toggle('passed',i<state.stationsPassed));
}
function announceNextStation(){
  const i=state.stationQueue.shift();if(i===undefined)return;
  state.signs.push({x:WIDTH+40,name:STATIONS[i],fake:false});
  state.stationUntil=state.time+5;state.bubbleUntil=state.stationUntil;
  $('bubble').textContent=STATION_LINES[i];$('bubble').style.color='#c2e0ed';
}
function drawSigns(){
  for(const sign of state.signs){ctx.save();ctx.translate(sign.x,GROUND);line(14,-130,14,1,'#8b9ba0',4);line(162,-130,162,1,'#8b9ba0',4);
    rounded(0,-161,176,62,3,sign.fake?'#234b5b':'#24516b','#92b4be');line(8,-152,168,-152,'#8abec94f');
    ctx.textAlign='center';ctx.fillStyle='#eef3df';ctx.font='bold 20px sans-serif';ctx.fillText(sign.name,88,-126);
    ctx.font='8px sans-serif';ctx.fillStyle='#b2ced1';ctx.fillText(sign.fake?'고전시가 · 무정차 통과':'일영 익스프레스 · 정차하지 않습니다',88,-110);ctx.restore();
  }
}


// Phase 7 · 도착은 끝이 아니다.
function triggerEnding(){
  if(state.ending)return;
  state.ending=true;state.endingTime=0;state.remaining=0;state.progress=1;state.lastCountdown=-1;
  state.flash=0;state.evolutionTimer=0;state.overdrive=0;state.invincible=0;
  state.input.keys.clear();state.input.touches.clear();state.input.wheelUntil=0;
  state.obstacles=[];state.coffees=[];state.texts=[];state.particles=[];
  $('evolution').classList.remove('visible');$('overdrive').hidden=true;
  $('resultCleared').textContent=state.cleared+'개';$('resultCoffee').textContent=state.coffeesTaken+'잔';
  $('resultBrake').textContent=`시도 ${state.brakeCount}회 / 성공 0회`;
  $('routeFill').style.width='100%';$('routeTrain').style.left='100%';$('progressText').textContent='100% 도착';$('routeTrack').setAttribute('aria-valuenow','100');
  document.querySelectorAll('.stations span').forEach(el=>el.classList.add('passed'));
  updateCountdown();
}
function updateEnding(dt){
  state.endingTime+=dt;state.scroll+=worldSpeed()*dt;
  if(state.endingTime>=2.75){
    if($('ending').hidden){$('ending').hidden=false;document.querySelector('.interface').inert=true;$('restart').focus();}
    state.fireworkTimer=(state.fireworkTimer||0)-dt;
    if(state.fireworkTimer<=0){state.fireworkTimer=.3+Math.random()*.2;launchFirework();}
  }
}
function launchFirework(){
  const x=150+Math.random()*980,y=170+Math.random()*270,hue=Math.random()*360;
  for(let i=0;i<45;i++){const a=Math.PI*2*i/45,v=65+Math.random()*125;addParticle({kind:'firework',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-15,gravity:90,life:1.5,maxLife:1.5,r:2+Math.random()*2,color:`hsl(${hue+i%4*15},90%,73%)`});}
}
function drawEnding(){
  const t=state.endingTime;
  const fade=t<.75?t/.75:t<2.75?1:Math.max(0,1-(t-2.75)/.7);
  ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
  if(fade>0){ctx.fillStyle=`rgba(247,243,228,${fade})`;ctx.fillRect(0,0,state.width,state.height);}
  if(t>=.75&&t<2.75){ctx.textAlign='center';ctx.fillStyle='#26362e';ctx.font=`900 ${Math.min(54,state.width*.085)}px sans-serif`;ctx.fillText('시험장역 도착',state.width/2,state.height/2);ctx.font='13px sans-serif';ctx.fillStyle='#647469';ctx.fillText('일영님, 준비되셨습니까.',state.width/2,state.height/2+39);ctx.textAlign='left';}
}
function resetGame(){
  const now=Date.now();
  Object.assign(state,{
    speed:MIN_SPEED,autoSpeed:MIN_SPEED,coffee:30,progress:0,stage:1,time:0,scroll:0,lastTs:0,
    jumpY:0,jumpV:0,onGround:true,obstacles:[],coffees:[],particles:[],texts:[],signs:[],
    cleared:0,coffeesTaken:0,brakeCount:0,flash:0,evolutionTimer:0,invincible:0,overdrive:0,
    ending:false,endingTime:0,fireworkTimer:0,bubbleUntil:0,stationUntil:0,stationQueue:[],stationsPassed:0,
    deferredBubble:null,literatureTimer:30,literatureIndex:0,brakeEscapeAt:0,caffeineBubbleAt:0,
    obstacleTimer:2.7,coffeeTimer:7,obstacleBag:[],emitTimer:0,lineTimer:0,lastCountdown:-1,
    examAt:state.requestedExamAt>now?state.requestedExamAt:now+12*60*60*1000
  });
  state.startRemaining=state.examAt-now;state.remaining=state.startRemaining;
  state.input.keys.clear();state.input.touches.clear();state.input.wheelUntil=0;
  $('ending').hidden=true;document.querySelector('.interface').inert=false;
  $('brake').removeAttribute('style');$('brake').removeAttribute('aria-label');$('brakeLabel').textContent='브레이크';
  $('trainName').textContent=STAGE_NAMES[0];$('stageNumber').textContent='01';$('stageCaption').textContent=STAGE_CAPTIONS[0];$('cleared').textContent='0';
  document.querySelectorAll('.stage-ticks i').forEach((el,i)=>el.classList.toggle('active',i===0));
  $('evolution').classList.remove('visible');$('overdrive').hidden=true;
  showBubble('다시 출발합니다. 역시나 브레이크는 없습니다.','#e1dfcc',4000);
  document.body.classList.remove('fast');
  updateCountdown();updateStations(0);updateCoffee(0);$('speed').textContent='008';
  canvas.setAttribute('tabindex','-1');canvas.focus({preventScroll:true});
}


// Phase 8 · AudioContext는 소리 버튼의 직접 입력에서만 생성한다.
async function toggleSound(){
  try{
    if(!state.audio){
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass){showBubble('이 브라우저에서는 소리를 지원하지 않습니다.');return;}
      state.audio=new AudioContextClass();state.engine=state.audio.createOscillator();state.engineGain=state.audio.createGain();
      state.engine.type='triangle';state.engine.frequency.value=44;state.engineGain.gain.value=0;
      state.engine.connect(state.engineGain).connect(state.audio.destination);state.engine.start();
    }
    if(state.audio.state==='suspended')await state.audio.resume();
    state.sound=!state.sound;
    $('sound').textContent=state.sound?'🔊':'🔇';$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').setAttribute('aria-label',state.sound?'소리 끄기':'소리 켜기');
    updateAudio();
  }catch{showBubble('소리를 켤 수 없습니다. 열차는 계속 달립니다.');}
}
function updateAudio(){
  if(!state.audio||!state.engine)return;
  state.engine.frequency.setTargetAtTime(42+state.speed*1.8,state.audio.currentTime,.12);
  state.engineGain.gain.setTargetAtTime(state.sound&&!document.hidden&&!state.ending?.018:0,state.audio.currentTime,.12);
}
function beep(from,duration,to){
  if(!state.sound||!state.audio||state.audio.state!=='running')return;
  const oscillator=state.audio.createOscillator(),gain=state.audio.createGain(),now=state.audio.currentTime;
  oscillator.type='sine';oscillator.frequency.setValueAtTime(from,now);oscillator.frequency.exponentialRampToValueAtTime(to,now+duration);
  gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
  oscillator.connect(gain).connect(state.audio.destination);oscillator.start(now);oscillator.stop(now+duration);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}

init();
