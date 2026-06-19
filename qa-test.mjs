/**
 * CheckHero Gas Line Quoter — Comprehensive QA Test Suite
 * Tests pipe sizing (AS/NZS 5601 Table F8), materials estimation, and quote totals.
 * Run: node qa-test.mjs
 */

// ─── EXACT COPY OF CALCULATION CONSTANTS & FUNCTIONS FROM APP ──────────────

const GRID = 40;
const METER_POS = { x: 120, y: 280 };

const APPLIANCE_TYPES = [
  { id:"cooktop",             label:"Cooktop",             mj:30  },
  { id:"freestanding_cooker", label:"Freestanding Cooker", mj:50  },
  { id:"wall_heater",         label:"Wall / Space Heater", mj:25  },
  { id:"ducted_heater",       label:"Ducted Heater",       mj:120 },
  { id:"storage_hws",         label:"Storage HWS",         mj:200 },
  { id:"instant_hws",         label:"Instantaneous HWS",   mj:200 },
];

const F8 = [
  [2,168,554,1218,2336,3931,9046],[4,115,381,837,1606,2702,6217],
  [6,93,306,672,1289,2170,4993],[8,79,262,575,1104,1857,4273],
  [10,70,232,510,978,1646,3787],[12,64,210,462,886,1491,3431],
  [14,59,193,425,815,1372,3157],[16,54,180,396,758,1276,2937],
  [18,51,169,371,712,1197,2755],[20,48,160,351,672,1131,2603],
  [25,43,141,311,596,1002,2307],[30,39,128,281,540,908,2090],
  [35,36,118,259,497,836,1923],[40,33,110,241,462,777,1789],
  [50,29,97,214,409,689,1585],[60,27,88,193,371,624,1437],
  [80,23,77,168,324,546,1255],[100,20,69,152,293,495,1139],
  [120,18,63,139,269,454,1045],[160,16,57,122,237,400,921],
  [200,14,52,111,218,369,850],
];
const CU_SIZES = [15,20,25,32,40,50];

function interpolate(col, len) {
  if (len <= F8[0][0]) return F8[0][col+1];
  if (len >= F8[F8.length-1][0]) return F8[F8.length-1][col+1];
  for (let i=0;i<F8.length-1;i++) {
    if (F8[i][0]<=len && F8[i+1][0]>=len) {
      const t=(len-F8[i][0])/(F8[i+1][0]-F8[i][0]);
      return F8[i][col+1]+t*(F8[i+1][col+1]-F8[i][col+1]);
    }
  }
  return F8[F8.length-1][col+1];
}

function findSize(flowMJ, runLen, allowDP) {
  const scale = Math.sqrt(Math.max(0.05, allowDP) / 0.75);
  for (let i=0; i<CU_SIZES.length; i++) {
    if (interpolate(i, Math.max(runLen,1)) * scale >= flowMJ) return CU_SIZES[i];
  }
  return CU_SIZES[CU_SIZES.length-1];
}

function analyse(segs, apps) {
  const sk=(x,y)=>`${Math.round(x/GRID)*GRID},${Math.round(y/GRID)*GRID}`;
  const MK=sk(METER_POS.x,METER_POS.y);
  const adj={};
  const addN=k=>{if(!adj[k])adj[k]=[];};
  segs.forEach(s=>{
    const k1=sk(s.x1,s.y1), k2=sk(s.x2,s.y2);
    addN(k1); addN(k2);
    adj[k1].push({id:s.id,other:k2,len:s.length||0});
    adj[k2].push({id:s.id,other:k1,len:s.length||0});
  });
  const allKeys=Object.keys(adj);
  const atNode={};
  apps.forEach(a=>{
    let bestKey=sk(a.x,a.y), bestDist=Infinity;
    allKeys.forEach(k=>{
      const [nx,ny]=k.split(",").map(Number);
      const d=Math.hypot(a.x-nx,a.y-ny);
      if(d<bestDist){bestDist=d;bestKey=k;}
    });
    if(!atNode[bestKey])atNode[bestKey]=[];
    atNode[bestKey].push(a);
  });
  const flows={};
  let longest=0;
  function dfs(node,parent,pathLen){
    const local=(atNode[node]||[]).reduce((s,a)=>s+a.mj,0);
    if(local>0)longest=Math.max(longest,pathLen);
    let total=local;
    for(const e of(adj[node]||[])){
      if(e.other===parent)continue;
      const child=dfs(e.other,node,pathLen+e.len);
      total+=child;
      flows[e.id]=(flows[e.id]||0)+child;
    }
    return total;
  }
  if(adj[MK])dfs(MK,null,0);
  const totalMJ=apps.reduce((s,a)=>s+a.mj,0);
  segs.forEach(s=>{if(!flows[s.id])flows[s.id]=totalMJ;});
  if(!longest)longest=segs.reduce((s,g)=>s+(g.length||0),0);
  return {flows,longest};
}

const DEFAULT = {
  callOutFee:95, baseLabour:500, baseLabourMetres:5, labourPerMetre:45,
  copperRates:{15:18,20:24,25:32,32:42,40:55,50:72},
  meterConnectionFlat:150, meterCopperTail:45,
  applianceCosts:{cooktop:120,freestanding_cooker:145,wall_heater:110,ducted_heater:150,storage_hws:150,instant_hws:165},
  penetrationCost:45, diggingRate:85, concreteCuttingRate:120, twoStoreyFlat:150,
  margin:20,
};

function calcMaterials(segs, apps, q, qr) {
  if (!qr) return null;
  const sk = (x, y) => `${Math.round(x/GRID)*GRID},${Math.round(y/GRID)*GRID}`;
  const sizeOf = {};
  qr.sized.forEach(s => { sizeOf[s.id] = s.size; });
  const epMap = {};
  segs.forEach(s => {
    const k1 = sk(s.x1,s.y1), k2 = sk(s.x2,s.y2);
    if (!epMap[k1]) epMap[k1] = [];
    if (!epMap[k2]) epMap[k2] = [];
    const len = Math.hypot(s.x2-s.x1, s.y2-s.y1) || 1;
    epMap[k1].push({ segId:s.id, vec:{ x:(s.x2-s.x1)/len, y:(s.y2-s.y1)/len } });
    epMap[k2].push({ segId:s.id, vec:{ x:(s.x1-s.x2)/len, y:(s.y1-s.y2)/len } });
  });
  let elbows=0, tees=0, couplings=0, reducers=0, midRunCouplers=0;
  Object.values(epMap).forEach(entries => {
    const n = entries.length;
    if (n === 2) {
      const v1=entries[0].vec, v2=entries[1].vec;
      const dot = -(v1.x*v2.x + v1.y*v2.y);
      if (dot > 0.97) { couplings++; } else { elbows += 2; }
      if (sizeOf[entries[0].segId] !== sizeOf[entries[1].segId]) reducers++;
    } else if (n >= 3) {
      tees++;
      const sizes = [...new Set(entries.map(e => sizeOf[e.segId]))];
      if (sizes.length > 1) reducers += sizes.length - 1;
    }
  });
  segs.forEach(s => { if (s.length && s.length > 4) midRunCouplers += Math.floor(s.length/4); });
  elbows += apps.length * 2;
  const supportsBySize = {};
  qr.sized.forEach(s => {
    if (s.length) {
      const count = Math.ceil((q.twoS ? s.length * 1.5 : s.length) / 1.5);
      supportsBySize[s.size] = (supportsBySize[s.size] || 0) + count;
    }
  });
  const pipeBySize = {};
  qr.sized.forEach(s => { if (s.length) pipeBySize[s.size] = (pipeBySize[s.size]||0) + s.length; });
  return { elbows, tees, couplings, reducers, midRunCouplers, supportsBySize,
    flexHoses: apps.filter(a => a.typeId === 'cooktop' || a.typeId === 'freestanding_cooker').length,
    isolationValves: apps.length + (q.newMeter ? 1 : 0), pipeBySize };
}

function calcQuote(segs, apps, q, cfg=DEFAULT, margin=cfg.margin) {
  const totalLen = segs.reduce((s,g) => s + (g.length||0), 0);
  if (!totalLen || !apps.length) return null;
  const { flows, longest } = analyse(segs, apps);
  const allowDP  = Math.max(0.05, q.pressure - 1.13);
  const totalMJ  = apps.reduce((s,a) => s + a.mj, 0);
  const sized    = segs.map(s => ({ ...s, flow: flows[s.id]||totalMJ, size: findSize(flows[s.id]||totalMJ, longest||1, allowDP) }));
  const matCost  = sized.reduce((sum,s) => sum + (s.length||0) * (cfg.copperRates[s.size]||25), 0);
  const extraM   = Math.max(0, totalLen - cfg.baseLabourMetres);
  const labTot   = cfg.baseLabour + extraM * cfg.labourPerMetre;
  const appCost  = apps.reduce((s,a) => s + (cfg.applianceCosts[a.typeId]||120), 0);
  const metCost  = q.newMeter ? cfg.meterConnectionFlat + cfg.meterCopperTail : 0;
  const penCost  = (q.pens||0) * cfg.penetrationCost;
  const digCost  = (q.dig||0) * cfg.diggingRate;
  const concCost = (q.conc||0) * cfg.concreteCuttingRate;
  const twoCost  = q.twoS ? cfg.twoStoreyFlat : 0;
  const subtotal = cfg.callOutFee + labTot + matCost + appCost + metCost + penCost + digCost + concCost + twoCost;
  const total    = subtotal / (1 - Math.min(margin, 99.9) / 100);
  return { sized, totalMJ, longest, allowDP, totalLen, extraM,
    labTot, matCost, appCost, metCost, subtotal, marginAmt:total-subtotal, total };
}

// ─── TEST HELPERS ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0, warnings = 0;

function makeSeg(id, x1, y1, x2, y2, length) {
  return { id, x1, y1, x2, y2, length };
}

function makeApp(id, typeId, x, y) {
  const t = APPLIANCE_TYPES.find(a => a.id === typeId);
  return { ...t, typeId, id, x, y };
}

// Single straight run from meter (120,280) going right
function straightRun(length, appTypeId, pressure=2.0) {
  const segs = [makeSeg(1, METER_POS.x, METER_POS.y, METER_POS.x+200, METER_POS.y, length)];
  const apps = [makeApp(1, appTypeId, METER_POS.x+200, METER_POS.y)];
  const q = { pressure, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  return { segs, apps, q, qr };
}

function assert(condition, msg, detail='') {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${msg}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function warn(condition, msg, detail='') {
  if (!condition) {
    console.log(`  ⚠️  WARN: ${msg}${detail ? ' — ' + detail : ''}`);
    warnings++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}

// ─── SECTION 1: F8 TABLE INTERPOLATION ────────────────────────────────────────

section('1. F8 Table Interpolation Accuracy');

// Exact table values (no interpolation)
assert(interpolate(0, 10) === 70,  'DN15 at 10m exactly = 70 MJ/hr (F8 exact)');
assert(interpolate(1, 20) === 160, 'DN20 at 20m exactly = 160 MJ/hr (F8 exact)');
assert(interpolate(2, 30) === 281, 'DN25 at 30m exactly = 281 MJ/hr (F8 exact)');
assert(interpolate(3, 40) === 462, 'DN32 at 40m exactly = 462 MJ/hr (F8 exact)');
assert(interpolate(4, 50) === 689, 'DN40 at 50m exactly = 689 MJ/hr (F8 exact)');
assert(interpolate(5, 2)  === 9046,'DN50 at 2m exactly = 9046 MJ/hr (F8 exact)');

// Boundary clamping
assert(interpolate(0, 1) === 168,  'DN15 at 1m (< min 2m) clamps to 168');
assert(interpolate(0, 250) === 14, 'DN15 at 250m (> max 200m) clamps to 14');

// Linear interpolation at midpoint 15m (between 14m=59 and 16m=54 for DN15)
const interp15 = interpolate(0, 15);
const expected15 = 59 + (15-14)/(16-14) * (54-59); // = 59 - 2.5 = 56.5
assert(Math.abs(interp15 - expected15) < 0.001, `DN15 at 15m interpolates to ${expected15}`, `got ${interp15.toFixed(3)}`);

// Midpoint 25m DN20 (between 20m=160 and 25m=141 for DN20 col1)
const interp25 = interpolate(1, 22.5);  // halfway between 20 and 25
const exp25 = 160 + (22.5-20)/(25-20) * (141-160); // 160 + 0.5*(-19) = 150.5
assert(Math.abs(interp25 - exp25) < 0.001, `DN20 at 22.5m interpolates to ${exp25}`, `got ${interp25.toFixed(3)}`);

// ─── SECTION 2: PIPE SIZING — SINGLE APPLIANCE, VARIOUS PRESSURES ─────────────

section('2. Pipe Sizing — Single Appliance, Varying Pressure');

// Manual calculation helper
function manualSize(flowMJ, runLen, pressure) {
  const allowDP = Math.max(0.05, pressure - 1.13);
  const scale = Math.sqrt(allowDP / 0.75);
  for (let i=0; i<CU_SIZES.length; i++) {
    const cap = interpolate(i, Math.max(runLen,1)) * scale;
    if (cap >= flowMJ) return CU_SIZES[i];
  }
  return 50;
}

// Cooktop (30 MJ/hr) at 2.0 kPa supply
// allowDP=0.87, scale=sqrt(0.87/0.75)=1.077
// DN15@10m: 70*1.077=75.4 ≥30 → DN15
assert(findSize(30,10,0.87) === 15, 'Cooktop 30MJ/hr, 10m, 2.0kPa → DN15');
assert(findSize(30,30,0.87) === 15, 'Cooktop 30MJ/hr, 30m, 2.0kPa → DN15 (39*1.077=42.0≥30)');
// 100m at 2kPa: DN15@100m=20, *1.077=21.5 < 30 → should be DN20
const size100_2kpa = findSize(30,100,0.87);
assert(size100_2kpa === 20, `Cooktop 30MJ/hr, 100m, 2.0kPa → DN20 (DN15@100m=20*1.077=21.5<30)`, `got DN${size100_2kpa}`);

// Cooktop at 1.5 kPa
// allowDP=0.37, scale=sqrt(0.37/0.75)=0.7027
// DN15@30m: 39*0.7027=27.4 < 30 → need DN20
// DN20@30m: 128*0.7027=89.9 ≥ 30 → DN20
assert(findSize(30,30,0.37) === 20, 'Cooktop 30MJ/hr, 30m, 1.5kPa → DN20 (low pressure forces up)');
assert(findSize(30,10,0.37) === 15, 'Cooktop 30MJ/hr, 10m, 1.5kPa → DN15 (70*0.703=49.2≥30)');

// Cooktop at 1.3 kPa (very low)
// allowDP=0.17, scale=sqrt(0.17/0.75)=0.476
// DN15@10m: 70*0.476=33.3 ≥30 → DN15
// DN15@20m: 48*0.476=22.8 <30 → DN20
assert(findSize(30,10,0.17) === 15, 'Cooktop 30MJ/hr, 10m, 1.3kPa → DN15 (33.3≥30)');
assert(findSize(30,20,0.17) === 20, 'Cooktop 30MJ/hr, 20m, 1.3kPa → DN20 (22.8<30)');

// Wall heater (25 MJ/hr) — lower demand than cooktop
assert(findSize(25,30,0.87) === 15, 'Wall heater 25MJ/hr, 30m, 2.0kPa → DN15');
assert(findSize(25,50,0.87) === 15, 'Wall heater 25MJ/hr, 50m, 2.0kPa → DN15 (29*1.077=31.2≥25)');
assert(findSize(25,80,0.87) === 20, 'Wall heater 25MJ/hr, 80m, 2.0kPa → DN20 (23*1.077=24.8<25)');

// Ducted heater (120 MJ/hr)
// DN20@10m=232, *1.077=249.9 ≥120 → DN20
// DN15@10m=70, *1.077=75.4 <120 → not DN15
assert(findSize(120,10,0.87) === 20, 'Ducted heater 120MJ/hr, 10m, 2.0kPa → DN20');
assert(findSize(120,30,0.87) === 20, 'Ducted heater 120MJ/hr, 30m, 2.0kPa → DN20 (128*1.077=137.9≥120)');
// DN20@30m=128, *0.7027=89.9 <120 → need DN25
// DN25@30m=281, *0.7027=197.5 ≥120 → DN25
assert(findSize(120,30,0.37) === 25, 'Ducted heater 120MJ/hr, 30m, 1.5kPa → DN25 (low pressure)');
assert(findSize(120,80,0.87) === 25, 'Ducted heater 120MJ/hr, 80m, 2.0kPa → DN25 (DN20@80m=77*1.077=83<120)');

// Storage HWS (200 MJ/hr)
assert(findSize(200,10,0.87) === 20, 'Storage HWS 200MJ/hr, 10m, 2.0kPa → DN20 (232*1.077=249.9≥200)');
assert(findSize(200,20,0.87) === 25, 'Storage HWS 200MJ/hr, 20m, 2.0kPa → DN25 (DN20@20m=160*1.077=172.3<200)');
assert(findSize(200,30,0.37) === 32, 'Storage HWS 200MJ/hr, 30m, 1.5kPa → DN32 (DN25@30m=281*0.703=197.5<200)');

// Freestanding cooker (50 MJ/hr)
assert(findSize(50,10,0.87) === 15, 'Freestanding cooker 50MJ/hr, 10m, 2.0kPa → DN15 (70*1.077=75.4≥50)');
assert(findSize(50,30,0.87) === 20, 'Freestanding cooker 50MJ/hr, 30m, 2.0kPa → DN20 (DN15@30m=39*1.077=42<50)');

// High pressure 2.75 kPa — scale=sqrt(1.62/0.75)=1.470
// DN15@80m=23, *1.470=33.8 ≥25 → DN15 for wall heater
assert(findSize(25,80,1.62)  === 15, 'Wall heater 25MJ/hr, 80m, 2.75kPa → DN15 (high pressure advantage)');

// ─── SECTION 3: PIPE SIZING — COMBINED DEMAND & LONGEST RUN ──────────────────

section('3. Pipe Sizing — Network Flow Analysis');

// Test: Two appliances on a single straight run — meter end carries both
{
  // meter → (5m) → node A → (10m) → cooktop (30)
  //                              → (8m) → ducted heater (120)
  // WAIT: a T-junction layout instead:
  // meter(120,280) → seg1 → (200,280) → seg2 → (280,280) cooktop
  //                                   → seg3 → (200,200) ducted heater
  const segs = [
    makeSeg(1, 120, 280, 200, 280, 10), // meter → junction
    makeSeg(2, 200, 280, 280, 280, 5),  // → cooktop
    makeSeg(3, 200, 280, 200, 200, 8),  // → ducted heater
  ];
  const apps = [
    makeApp(1, 'cooktop',       280, 280),
    makeApp(2, 'ducted_heater', 200, 200),
  ];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const { flows, longest } = analyse(segs, apps);

  // Seg1 (meter→junction): carries ALL demand = 30+120=150 MJ/hr
  assert(flows[1] === 150, 'T-branch: seg1 carries full demand 150 MJ/hr', `got ${flows[1]}`);
  // Seg2 (→cooktop): carries only cooktop demand = 30
  assert(flows[2] === 30,  'T-branch: seg2 carries cooktop demand 30 MJ/hr', `got ${flows[2]}`);
  // Seg3 (→ducted): carries only ducted heater demand = 120
  assert(flows[3] === 120, 'T-branch: seg3 carries ducted heater demand 120 MJ/hr', `got ${flows[3]}`);
  // Longest run: meter→junction(10) + junction→ducted(8) = 18m (cooktop path = 10+5=15m, ducted = 18m)
  assert(longest === 18, 'T-branch: longest run = 18m (meter→ducted path)', `got ${longest}`);

  const allowDP = 0.87;
  // Seg1 must carry 150 MJ/hr, run=18m: DN20@18m=169*1.077=182≥150 → DN20
  assert(findSize(150,18,allowDP)===20, 'Trunk DN20 for 150MJ/hr at 18m, 2.0kPa');
  // Seg2: 30MJ/hr at 18m: DN15@18m=51*1.077=54.9≥30 → DN15
  assert(findSize(30,18,allowDP)===15,  'Cooktop branch DN15 for 30MJ/hr at 18m');
  // Seg3: 120MJ/hr at 18m: DN20@18m=169*1.077=182≥120 → DN20
  assert(findSize(120,18,allowDP)===20, 'Ducted heater branch DN20 for 120MJ/hr at 18m');
}

// Test: Three appliances in series — demand decreases along pipe
{
  // meter(120,280) → seg1 5m → (200,280) w.heater(25) → seg2 10m → (400,280) cooktop(30) → seg3 8m → (520,280) ducted(120)
  const segs = [
    makeSeg(1, 120, 280, 200, 280, 5),
    makeSeg(2, 200, 280, 400, 280, 10),
    makeSeg(3, 400, 280, 520, 280, 8),
  ];
  const apps = [
    makeApp(1, 'wall_heater',   200, 280),
    makeApp(2, 'cooktop',       400, 280),
    makeApp(3, 'ducted_heater', 520, 280),
  ];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const { flows, longest } = analyse(segs, apps);

  // Total demand = 25+30+120 = 175 MJ/hr
  assert(flows[1] === 175, 'Series 3-app: seg1 carries full 175 MJ/hr', `got ${flows[1]}`);
  assert(flows[2] === 150, 'Series 3-app: seg2 carries 150 MJ/hr (cooktop+ducted)', `got ${flows[2]}`);
  assert(flows[3] === 120, 'Series 3-app: seg3 carries 120 MJ/hr (ducted only)', `got ${flows[3]}`);
  // Longest run = 5+10+8 = 23m
  assert(longest === 23, 'Series 3-app: longest run = 23m', `got ${longest}`);
}

// Test: High-demand scenario — 2× HWS (400 MJ/hr total)
{
  const segs = [makeSeg(1, 120, 280, 280, 280, 15)];
  const apps = [makeApp(1, 'storage_hws', 280, 280), makeApp(2, 'storage_hws', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(qr !== null, 'Two HWS: quote generated');
  assert(qr.totalMJ === 400, 'Two HWS: total demand 400 MJ/hr', `got ${qr.totalMJ}`);
  // DN25@15m: interpolate(14m=425, 16m=396) → 425-14.5=410.5; *1.077=442.1 MJ/hr ≥ 400 → DN25 ✓
  assert(qr.sized[0].size === 25, `Two HWS 400MJ/hr, 15m, 2.0kPa → DN25 (cap 442MJ/hr ≥ 400)`, `got DN${qr.sized[0].size}`);
}

// ─── SECTION 4: ALLOWABLE PRESSURE DROP EDGE CASES ────────────────────────────

section('4. Allowable Pressure Drop Edge Cases');

// Minimum DP floor: if pressure=1.13, allowDP=max(0.05,0)=0.05
const sizeFloor = findSize(30, 10, 0.05);  // scale=sqrt(0.05/0.75)=0.258; DN15@10m=70*0.258=18.1<30; DN20=232*0.258=59.9≥30
assert(sizeFloor === 20, 'Very low pressure (1.13 kPa) forces DN20 for cooktop at 10m', `got DN${sizeFloor}`);

// allowDP at 1.5 kPa = 0.37; at 2.0 = 0.87; same run should give smaller pipe at higher pressure
const size15 = findSize(120, 20, 0.37);  // 1.5 kPa
const size20 = findSize(120, 20, 0.87);  // 2.0 kPa
assert(size20 <= size15, `Higher pressure → same or smaller pipe (ducted 20m: 2.0kPa=DN${size20}, 1.5kPa=DN${size15})`);

// 2.75 kPa is the maximum practical supply; verify it gives best (smallest) sizing
const sizeMax = findSize(200, 30, 1.62);  // 2.75-1.13=1.62
const sizeMid = findSize(200, 30, 0.87);  // 2.0 kPa
assert(sizeMax <= sizeMid, `2.75kPa ≤ pipe size vs 2.0kPa for 200MJ/hr at 30m (${sizeMax} vs ${sizeMid})`);

// Verify specific 2.75 kPa case: scale=sqrt(1.62/0.75)=1.470
// DN20@30m=128*1.470=188.2≥120 → ducted heater at 30m should now be DN20 instead of DN25 at 1.5kPa
assert(findSize(120,30,1.62) === 20, 'Ducted heater 120MJ/hr, 30m, 2.75kPa → DN20 (vs DN25 at 1.5kPa)');

// ─── SECTION 5: MATERIALS ESTIMATION ──────────────────────────────────────────

section('5. Materials — Supports Per DN Size');

{
  // Single run, single size → supports at 1.5m centres
  const segs = [makeSeg(1, 120, 280, 280, 280, 9)]; // 9m run
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(qr !== null, 'Single run: quote generated for materials test');
  const mat = calcMaterials(segs, apps, q, qr);
  // 9m at 1.5m centres = ceil(9/1.5) = 6 supports
  const dn = qr.sized[0].size;
  assert(mat.supportsBySize[dn] === 6, `9m run → 6 supports for DN${dn}`, `got ${JSON.stringify(mat.supportsBySize)}`);
}

{
  // Mixed sizes: seg1 (large demand) + seg2 (small demand) → different DN sizes → separate support counts
  const segs = [
    makeSeg(1, 120, 280, 280, 280, 12), // carries 200+30=230 MJ/hr — likely DN25
    makeSeg(2, 280, 280, 440, 280, 6),  // carries only 30 MJ/hr — likely DN15
  ];
  const apps = [
    makeApp(1, 'storage_hws', 120+200, 280), // placed at end of seg1 (approx)
    makeApp(2, 'cooktop', 440, 280),
  ];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  if (qr) {
    const mat = calcMaterials(segs, apps, q, qr);
    assert(Object.keys(mat.supportsBySize).length >= 1, 'Mixed run: supportsBySize has at least 1 size entry');
    // Total supports across all sizes
    const totalSupports = Object.values(mat.supportsBySize).reduce((a,b)=>a+b,0);
    // Total pipe = 12+6=18m; ceil(18/1.5)=12 total supports
    assert(totalSupports === 12, `Mixed run (18m total): 12 total supports across all sizes`, `got ${totalSupports}`);
  }
}

{
  // 2-storey multiplier: 1.5× on pipe length for support count
  const segs = [makeSeg(1, 120, 280, 280, 280, 6)]; // 6m
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:true };
  const qr = calcQuote(segs, apps, q);
  const mat = calcMaterials(segs, apps, q, qr);
  // 6m × 1.5 = 9m effective; ceil(9/1.5) = 6 supports
  const dn = qr.sized[0].size;
  assert(mat.supportsBySize[dn] === 6, `2-storey: 6m * 1.5 multiplier → 6 supports for DN${dn}`, `got ${JSON.stringify(mat.supportsBySize)}`);
  // vs single storey: ceil(6/1.5)=4 supports
  const q1 = { ...q, twoS:false };
  const mat1 = calcMaterials(segs, apps, q1, qr);
  assert(mat1.supportsBySize[dn] === 4, `Single-storey: 6m → 4 supports for DN${dn}`, `got ${JSON.stringify(mat1.supportsBySize)}`);
}

section('6. Materials — Flex Hoses (Cookers Only)');

{
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };
  const segs = [makeSeg(1, 120, 280, 280, 280, 5)];

  // Cooktop only → 1 flex hose
  const apps1 = [makeApp(1, 'cooktop', 280, 280)];
  const qr1 = calcQuote(segs, apps1, q);
  const mat1 = calcMaterials(segs, apps1, q, qr1);
  assert(mat1.flexHoses === 1, 'Cooktop (1): 1 flex hose');

  // Freestanding cooker → 1 flex hose
  const apps2 = [makeApp(1, 'freestanding_cooker', 280, 280)];
  const qr2 = calcQuote(segs, apps2, q);
  const mat2 = calcMaterials(segs, apps2, q, qr2);
  assert(mat2.flexHoses === 1, 'Freestanding cooker (1): 1 flex hose');

  // Wall heater → 0 flex hoses (rigid copper connection)
  const apps3 = [makeApp(1, 'wall_heater', 280, 280)];
  const qr3 = calcQuote(segs, apps3, q);
  const mat3 = calcMaterials(segs, apps3, q, qr3);
  assert(mat3.flexHoses === 0, 'Wall heater: 0 flex hoses (rigid copper)');

  // Ducted heater → 0 flex hoses
  const apps4 = [makeApp(1, 'ducted_heater', 280, 280)];
  const qr4 = calcQuote(segs, apps4, q);
  const mat4 = calcMaterials(segs, apps4, q, qr4);
  assert(mat4.flexHoses === 0, 'Ducted heater: 0 flex hoses');

  // Storage HWS → 0 flex hoses
  const apps5 = [makeApp(1, 'storage_hws', 280, 280)];
  const qr5 = calcQuote(segs, apps5, q);
  const mat5 = calcMaterials(segs, apps5, q, qr5);
  assert(mat5.flexHoses === 0, 'Storage HWS: 0 flex hoses');

  // Instant HWS → 0 flex hoses
  const apps6 = [makeApp(1, 'instant_hws', 280, 280)];
  const qr6 = calcQuote(segs, apps6, q);
  const mat6 = calcMaterials(segs, apps6, q, qr6);
  assert(mat6.flexHoses === 0, 'Instant HWS: 0 flex hoses');

  // Mixed: cooktop + ducted + HWS → only 1 flex hose (cooktop)
  const segsLong = [makeSeg(1, 120, 280, 520, 280, 10)];
  const appsMixed = [
    makeApp(1, 'cooktop',        280, 280),
    makeApp(2, 'ducted_heater',  360, 280),
    makeApp(3, 'storage_hws',    520, 280),
  ];
  const qrM = calcQuote(segsLong, appsMixed, q);
  const matM = calcMaterials(segsLong, appsMixed, q, qrM);
  assert(matM.flexHoses === 1, 'Mixed (cooktop+ducted+HWS): only 1 flex hose (cooktop only)');

  // 2× cooktop + 1× freestanding → 3 flex hoses
  const appsCC = [
    makeApp(1, 'cooktop',             280, 280),
    makeApp(2, 'cooktop',             360, 280),
    makeApp(3, 'freestanding_cooker', 520, 280),
  ];
  const qrCC = calcQuote(segsLong, appsCC, q);
  const matCC = calcMaterials(segsLong, appsCC, q, qrCC);
  assert(matCC.flexHoses === 3, '2× cooktop + 1× freestanding → 3 flex hoses');
}

section('7. Materials — Fittings (Elbows, Tees, Couplings, Reducers)');

{
  // Straight run (no bends at midpoint) with single segment: 2 endpoint nodes
  // Meter-end: 1 entry → counted as endpoint only (no fitting)
  // Appliance-end: 1 entry → endpoint
  // BUT: 2 appliance elbows (2 per appliance) are added unconditionally
  const segs = [makeSeg(1, 120, 280, 280, 280, 5)];
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  const mat = calcMaterials(segs, apps, q, qr);
  // Single segment, straight: only endpoint nodes (each degree-1, no junctions)
  // Elbows from appliance stub-ins: 1 appliance × 2 = 2
  assert(mat.elbows === 2, 'Straight single seg + 1 app: 2 elbows (appliance stub-ins only)', `got ${mat.elbows}`);
  assert(mat.tees === 0,   'Straight single seg: 0 tees', `got ${mat.tees}`);
}

{
  // L-shaped run (2 segs at 90°): bend counts as 2 elbows + appliance stub 2 = 4 total
  const segs = [
    makeSeg(1, 120, 280, 280, 280, 5), // horizontal
    makeSeg(2, 280, 280, 280, 120, 4), // vertical from same point
  ];
  const apps = [makeApp(1, 'cooktop', 280, 120)];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  const mat = calcMaterials(segs, apps, q, qr);
  // Junction at (280,280): degree-2 node, 90° angle → elbows += 2
  // Appliance stub: elbows += 2
  // Total elbows = 4
  assert(mat.elbows === 4, 'L-shaped run + 1 app: 4 elbows (2 bend + 2 stub-in)', `got ${mat.elbows}`);
  assert(mat.tees === 0, 'L-shaped: 0 tees', `got ${mat.tees}`);
}

{
  // T-junction: 3 segs meeting at one node → 1 tee
  const segs = [
    makeSeg(1, 120, 280, 280, 280, 5),  // meter → junction
    makeSeg(2, 280, 280, 440, 280, 5),  // → right appliance
    makeSeg(3, 280, 280, 280, 120, 5),  // → top appliance
  ];
  const apps = [
    makeApp(1, 'cooktop',     440, 280),
    makeApp(2, 'wall_heater', 280, 120),
  ];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  const mat = calcMaterials(segs, apps, q, qr);
  assert(mat.tees === 1, 'T-junction: 1 tee fitting', `got ${mat.tees}`);
  // 2 appliances → 4 stub-in elbows; no bend elbows (all straight)
  assert(mat.elbows === 4, 'T-junction: 4 elbows (2×2 appliance stub-ins)', `got ${mat.elbows}`);
}

{
  // Mid-run couplers: run > 4m on single segment → floor(length/4) couplers
  const segs = [makeSeg(1, 120, 280, 280, 280, 13)]; // 13m → floor(13/4)=3 couplers
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  const mat = calcMaterials(segs, apps, q, qr);
  assert(mat.midRunCouplers === 3, '13m run → 3 mid-run couplers (floor(13/4))', `got ${mat.midRunCouplers}`);

  const segs2 = [makeSeg(1, 120, 280, 280, 280, 4)]; // exactly 4m → no coupler
  const qr2 = calcQuote(segs2, apps, q);
  const mat2 = calcMaterials(segs2, apps, q, qr2);
  assert(mat2.midRunCouplers === 0, '4m run → 0 mid-run couplers (not > 4m)', `got ${mat2.midRunCouplers}`);

  const segs3 = [makeSeg(1, 120, 280, 280, 280, 4.1)]; // 4.1m → floor(4.1/4)=1 coupler
  const qr3 = calcQuote(segs3, apps, q);
  const mat3 = calcMaterials(segs3, apps, q, qr3);
  assert(mat3.midRunCouplers === 1, '4.1m run → 1 mid-run coupler', `got ${mat3.midRunCouplers}`);
}

// ─── SECTION 8: QUOTE TOTAL ARITHMETIC ────────────────────────────────────────

section('8. Quote Total Arithmetic');

{
  const segs = [makeSeg(1, 120, 280, 280, 280, 8)]; // 8m run
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:true, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(qr !== null, 'Basic quote: generated');

  // Verify component arithmetic
  const cfg = DEFAULT;
  const expectedLabour = cfg.baseLabour + Math.max(0, 8 - cfg.baseLabourMetres) * cfg.labourPerMetre;
  // 8m: extraM = 8-5 = 3m; labour = 500 + 3*45 = 635
  assert(Math.abs(qr.labTot - 635) < 0.01, `Labour: $500 base + 3m×$45 = $635`, `got $${qr.labTot}`);

  // Material cost: DN15 at 8m = 8 * $18 = $144
  const dnSize = qr.sized[0].size;
  const expectedMat = 8 * cfg.copperRates[dnSize];
  assert(Math.abs(qr.matCost - expectedMat) < 0.01, `Pipe cost: 8m × $${cfg.copperRates[dnSize]}/m (DN${dnSize}) = $${expectedMat}`, `got $${qr.matCost}`);

  // Appliance cost: cooktop = $120
  assert(Math.abs(qr.appCost - 120) < 0.01, 'Appliance cost: cooktop = $120', `got $${qr.appCost}`);

  // Meter cost: 150 + 45 = $195
  assert(Math.abs(qr.metCost - 195) < 0.01, 'Meter cost: $150 + $45 = $195', `got $${qr.metCost}`);

  // Subtotal = callOut(95) + labour(635) + mat + appCost(120) + meter(195)
  const expectedSubtotal = 95 + 635 + expectedMat + 120 + 195;
  assert(Math.abs(qr.subtotal - expectedSubtotal) < 0.01, `Subtotal = $${expectedSubtotal.toFixed(2)}`, `got $${qr.subtotal.toFixed(2)}`);

  // Total at 20% margin: subtotal / (1-0.20)
  const expectedTotal = expectedSubtotal / 0.80;
  assert(Math.abs(qr.total - expectedTotal) < 0.01, `Total at 20% margin = $${expectedTotal.toFixed(2)}`, `got $${qr.total.toFixed(2)}`);

  // Verify total > subtotal
  assert(qr.total > qr.subtotal, 'Total > subtotal (margin applied)');

  // GST consistency: total * 1.1
  const gst = qr.total * 0.1;
  assert(gst > 0, `GST = $${gst.toFixed(2)} (positive)`);
}

{
  // No new meter → metCost = 0
  const segs = [makeSeg(1, 120, 280, 280, 280, 5)];
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(Math.abs(qr.metCost) < 0.01, 'No new meter → metCost = $0', `got $${qr.metCost}`);
}

{
  // Extra works: 2 pens, 5m dig, 3m conc, 2-storey
  const segs = [makeSeg(1, 120, 280, 280, 280, 5)];
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:2, dig:5, conc:3, twoS:true };
  const qr = calcQuote(segs, apps, q);
  const cfg = DEFAULT;
  const penCost  = 2 * cfg.penetrationCost;       // 2 × 45 = 90
  const digCost  = 5 * cfg.diggingRate;            // 5 × 85 = 425
  const concCost = 3 * cfg.concreteCuttingRate;    // 3 × 120 = 360
  const twoCost  = cfg.twoStoreyFlat;              // 150
  assert(Math.abs(qr.subtotal - (95 + 500 + qr.matCost + 120 + penCost + digCost + concCost + twoCost)) < 0.01,
    `Subtotal includes all extras: pen=$${penCost}, dig=$${digCost}, conc=$${concCost}, 2s=$${twoCost}`);
}

{
  // Margin edge cases
  const segs = [makeSeg(1, 120, 280, 280, 280, 5)];
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };

  const qr0 = calcQuote(segs, apps, q, DEFAULT, 0);
  assert(Math.abs(qr0.total - qr0.subtotal) < 0.01, '0% margin → total = subtotal');

  const qr50 = calcQuote(segs, apps, q, DEFAULT, 50);
  assert(Math.abs(qr50.total - qr50.subtotal * 2) < 0.01, '50% margin → total = 2× subtotal');

  const qr30 = calcQuote(segs, apps, q, DEFAULT, 30);
  const expected30 = qr30.subtotal / 0.70;
  assert(Math.abs(qr30.total - expected30) < 0.01, `30% margin: total = subtotal/0.70 = $${expected30.toFixed(2)}`);
}

section('9. Base Labour Threshold');

{
  const segs = [makeSeg(1, 120, 280, 280, 280, 3)]; // 3m — under base threshold
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(Math.abs(qr.labTot - 500) < 0.01, '3m run (under 5m base): labour = $500 flat', `got $${qr.labTot}`);
  assert(Math.abs(qr.extraM) < 0.01, '3m run: extraM = 0', `got ${qr.extraM}`);
}
{
  const segs = [makeSeg(1, 120, 280, 280, 280, 5)]; // exactly 5m = base
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(Math.abs(qr.labTot - 500) < 0.01, '5m run (= base): labour = $500 flat', `got $${qr.labTot}`);
}
{
  const segs = [makeSeg(1, 120, 280, 280, 280, 20)]; // 20m = 15m extra
  const apps = [makeApp(1, 'cooktop', 280, 280)];
  const q = { pressure:2.0, newMeter:false, pens:0, dig:0, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  // 500 + 15 * 45 = 1175
  assert(Math.abs(qr.labTot - 1175) < 0.01, '20m run: labour = $500 + 15m×$45 = $1175', `got $${qr.labTot}`);
}

section('10. Full Multi-Appliance Scenario QA');

{
  // Real-world: residential gas upgrade
  // 1× cooktop, 1× ducted heater, 1× storage HWS on 3-branch layout
  const segs = [
    makeSeg(1, 120, 280, 280, 280, 8),   // trunk to junction
    makeSeg(2, 280, 280, 440, 280, 5),   // → cooktop
    makeSeg(3, 280, 280, 280, 160, 6),   // → ducted heater
    makeSeg(4, 280, 280, 120, 280, 12),  // → HWS (goes back toward another part)
  ];
  const apps = [
    makeApp(1, 'cooktop',       440, 280),  // seg2 end
    makeApp(2, 'ducted_heater', 280, 160),  // seg3 end
    makeApp(3, 'storage_hws',   120, 280),  // seg4 end — but this is meter position!
  ];
  // Note: storage_hws placed at meter position will snap to meter node
  const q = { pressure:2.0, newMeter:true, pens:1, dig:3, conc:0, twoS:false };
  const qr = calcQuote(segs, apps, q);
  assert(qr !== null, 'Full scenario: quote generated');
  assert(qr.totalMJ === 350, `Full scenario: total demand 30+120+200=350 MJ/hr`, `got ${qr.totalMJ}`);

  const mat = calcMaterials(segs, apps, q, qr);
  assert(mat.tees >= 1, 'Full scenario: at least 1 tee fitting');
  assert(mat.flexHoses === 1, 'Full scenario: 1 flex hose (cooktop only)', `got ${mat.flexHoses}`);

  // Isolation valves: 3 appliances + 1 meter = 4
  assert(mat.isolationValves === 4, 'Full scenario: 4 isolation valves (3 apps + 1 meter)', `got ${mat.isolationValves}`);

  // All pipe sizes present in supportsBySize
  const supportSizes = Object.keys(mat.supportsBySize).map(Number);
  assert(supportSizes.every(s => [15,20,25,32,40,50].includes(s)), 'All support sizes are valid DN sizes');

  // Total supports correct (sum of all segments)
  // Supports are summed per-segment using ceil(), so totals are slightly higher than
  // ceil(totalLen/1.5) due to ceiling accumulation per run.
  // seg1(8m)=6, seg2(5m)=4, seg3(6m)=4, seg4(12m)=8 → total=22 (vs ceil(31/1.5)=21)
  const totalSupports = Object.values(mat.supportsBySize).reduce((a,b)=>a+b,0);
  const perSegSum = segs.reduce((acc,s) => acc + (s.length ? Math.ceil(s.length/1.5) : 0), 0);
  assert(totalSupports === perSegSum, `Total supports = per-segment sum=${perSegSum} (conservative ceiling per run)`, `got ${totalSupports}`);

  warn(qr.total > 1000, 'Full scenario: total quote > $1000 (sanity check)', `got $${qr.total.toFixed(2)}`);
  warn(qr.total < 20000, 'Full scenario: total quote < $20000 (sanity check)', `got $${qr.total.toFixed(2)}`);
  console.log(`  ℹ️  Full scenario quote: $${qr.total.toFixed(2)} ex GST / $${(qr.total*1.1).toFixed(2)} inc GST`);
}

// ─── SECTION 11: PIPE SIZE MONOTONICITY ───────────────────────────────────────

section('11. Pipe Size Monotonicity (longer run = same or bigger pipe)');

{
  const lengths = [2,5,10,15,20,30,50,80,100,150,200];
  const pressures = [0.87, 0.37, 0.17];
  const demands = [25, 30, 50, 120, 200];
  let mono = true;
  let worst = '';
  for (const dp of pressures) {
    for (const mj of demands) {
      let prevSize = 0;
      for (const len of lengths) {
        const sz = findSize(mj, len, dp);
        if (sz < prevSize) {
          mono = false;
          worst = `demand=${mj}MJ/hr dp=${dp} len=${len}m: got DN${sz} but prev was DN${prevSize}`;
        }
        prevSize = sz;
      }
    }
  }
  assert(mono, 'Pipe size never decreases as run length increases', worst);
}

{
  // Higher demand = same or bigger pipe at same run/pressure
  const len = 20; const dp = 0.87;
  let prev = 0; let ok = true; let worst = '';
  for (const mj of [10, 20, 25, 30, 50, 80, 100, 120, 150, 200, 300, 400]) {
    const sz = findSize(mj, len, dp);
    if (sz < prev) { ok = false; worst = `mj=${mj}: DN${sz} < prev DN${prev}`; }
    prev = sz;
  }
  assert(ok, 'Pipe size never decreases as demand increases (at fixed run/pressure)', worst);
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`  QA SUMMARY`);
console.log('═'.repeat(70));
console.log(`  ✅ Passed:   ${passed}`);
console.log(`  ❌ Failed:   ${failed}`);
console.log(`  ⚠️  Warnings: ${warnings}`);
console.log('═'.repeat(70));

if (failed > 0) {
  console.log('\n  🚨 ACTION REQUIRED: Fix the failing tests before using in production.\n');
  process.exit(1);
} else {
  console.log('\n  🎉 All tests passed! Calculation engine is verified.\n');
}
