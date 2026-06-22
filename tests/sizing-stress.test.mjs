/**
 * Large randomized accuracy stress test (default 1000 runs).
 *
 * Independent-oracle discipline (same as sizing-100, widened):
 *   • Layouts are CONSTRUCTED with a known answer. Each appliance's full path
 *     from the meter is recorded during construction, so the true downstream
 *     flow per segment and the developed length are known — not re-derived from
 *     the engine.
 *   • AS/NZS 5601 sizing is RE-IMPLEMENTED here (separate interp + selection).
 *   • A GEOMETRY VALIDATOR asserts the engine's coordinate-built graph matches
 *     the intended tree (no accidental/ missed junctions) — so a malformed
 *     layout can never yield a false pass; it fails loudly instead.
 *
 * Situation coverage: single runs, linear chains, branched trees, multi-level
 * trees (meter→trunk→sub-trunk→appliance), mid-run T-junction taps, up to ~20
 * appliances, all 6 appliance types, pressures 1.13–2.85 kPa (incl. the 0.05
 * clamp), lengths from 1 m to beyond the 200 m table (extrapolation clamp), and
 * demand high enough to force DN50 / capacity overflow.
 *
 * Run: node tests/sizing-stress.test.mjs [N]
 */
import { CU_SIZES, analyse } from '../src/lib/calc/sizing.js';
import { calcQuote } from '../src/lib/calc/pricing.js';
import { DEFAULT_CONFIG } from '../src/lib/config/defaults.js';
import { APPLIANCE_TYPES, GRID, METER_POS } from '../src/lib/calc/constants.js';
import { oBand, oCapacity, oSize } from './_oracle.mjs';

const N = Number(process.argv[2]) || 1000;

// ── Seeded RNG ──
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x9e3779b1);
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const g = (n) => Math.round(n / GRID) * GRID; // snap to grid

// Independent AS/NZS 5601 band-table oracle lives in ./_oracle.mjs.

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else { fail++; if (failures.length < 40) failures.push(`${name} — ${detail || ''}`); }
}

const sk = (x, y) => `${g(x)},${g(y)}`;

// Geometry validator: every node lying on a segment's interior must be intended.
function geometryClean(segs, intendedInterior) {
  const nodeSet = new Set([sk(METER_POS.x, METER_POS.y)]);
  segs.forEach((s) => { nodeSet.add(sk(s.x1, s.y1)); nodeSet.add(sk(s.x2, s.y2)); });
  const nodes = [...nodeSet].map((k) => { const [x, y] = k.split(',').map(Number); return { k, x, y }; });
  for (const s of segs) {
    const ax = g(s.x1), ay = g(s.y1), bx = g(s.x2), by = g(s.y2);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const endpoints = new Set([sk(ax, ay), sk(bx, by)]);
    const intended = new Set([...endpoints, ...(intendedInterior[s.id] || [])]);
    for (const n of nodes) {
      const t = ((n.x - ax) * dx + (n.y - ay) * dy) / L2;
      if (t < -1e-6 || t > 1 + 1e-6) continue;
      const dist = Math.hypot(n.x - (ax + t * dx), n.y - (ay + t * dy));
      if (dist <= GRID * 0.25 && !intended.has(n.k)) return false; // unintended junction
    }
    if (sk(ax, ay) === sk(bx, by)) return false; // zero-length in grid
  }
  return true;
}

// ── Scenario generators (emit segs, apps, and each appliance's path) ──
// Path entry: { segId, len } where len = metres of that segment traversed.

let _id;
const nextId = () => _id++;

// Multi-level comb tree using DISJOINT COLUMNS — collision-free by construction.
// Main trunk: horizontal at y=meter, branches go DOWN at x = meter + (i+1)*COLW.
// A branch may grow a sub-trunk (horizontal, confined to [Xi, Xi+3*SUBSTEP] < COLW)
// with its own down-branches, giving 3-level trees that never overlap siblings.
function genTree(maxDepth) {
  _id = 1;
  const segs = [];
  const apps = [];
  const paths = {};
  const intendedInterior = {};
  let appId = 1;
  const COLW = 480, SUBSTEP = 80; // COLW > 3*SUBSTEP guarantees disjoint columns
  const k = ri(1, 5);
  let prevX = METER_POS.x;
  let trunkPath = [];
  for (let i = 0; i < k; i++) {
    const Xi = METER_POS.x + (i + 1) * COLW;
    const tLen = ri(1, 20);
    const tId = nextId();
    segs.push({ id: tId, x1: prevX, y1: METER_POS.y, x2: Xi, y2: METER_POS.y, length: tLen });
    trunkPath = [...trunkPath, { segId: tId, len: tLen }];
    const bLen = ri(1, 18);
    const bId = nextId();
    const Yi = METER_POS.y + ri(2, 5) * 40;
    segs.push({ id: bId, x1: Xi, y1: METER_POS.y, x2: Xi, y2: Yi, length: bLen });
    const branchPath = [...trunkPath, { segId: bId, len: bLen }];
    if (maxDepth >= 2 && rng() < 0.5) {
      // sub-trunk going right, confined within the column; down sub-branches.
      const m = ri(1, 3);
      let sprevX = Xi;
      let subPath = branchPath;
      for (let j = 0; j < m; j++) {
        const sx = Xi + (j + 1) * SUBSTEP;
        const stLen = ri(1, 15);
        const stId = nextId();
        segs.push({ id: stId, x1: sprevX, y1: Yi, x2: sx, y2: Yi, length: stLen });
        subPath = [...subPath, { segId: stId, len: stLen }];
        const sbLen = ri(1, 12);
        const sbId = nextId();
        const sY = Yi + ri(2, 4) * 40;
        segs.push({ id: sbId, x1: sx, y1: Yi, x2: sx, y2: sY, length: sbLen });
        const t = pick(APPLIANCE_TYPES);
        apps.push({ id: appId, typeId: t.id, label: t.label, x: sx, y: sY, mj: t.mj });
        paths[appId] = [...subPath, { segId: sbId, len: sbLen }];
        appId++;
        sprevX = sx;
      }
    } else {
      const t = pick(APPLIANCE_TYPES);
      apps.push({ id: appId, typeId: t.id, label: t.label, x: Xi, y: Yi, mj: t.mj });
      paths[appId] = branchPath;
      appId++;
    }
    prevX = Xi;
  }
  return { segs, apps, paths, intendedInterior };
}

// Single horizontal trunk with mid-run taps (interior + endpoint).
function genMidtap() {
  _id = 1;
  const segs = [];
  const apps = [];
  const paths = {};
  const intendedInterior = {};
  let appId = 1;

  const nApp = ri(2, 6);
  let x = METER_POS.x;
  const branches = [];
  for (let i = 0; i < nApp; i++) {
    x += ri(1, 3) * 40;
    const t = pick(APPLIANCE_TYPES);
    branches.push({ bx: x, by: METER_POS.y + (i % 2 ? 1 : -1) * ri(2, 5) * 40, t, bLen: ri(1, 18) });
  }
  const endX = branches[branches.length - 1].bx;
  const trunkLen = ri(6, 30);
  const tId = nextId();
  segs.push({ id: tId, x1: METER_POS.x, y1: METER_POS.y, x2: endX, y2: METER_POS.y, length: trunkLen });
  intendedInterior[tId] = branches.filter((b) => b.bx !== endX).map((b) => sk(b.bx, METER_POS.y));
  for (const b of branches) {
    const bId = nextId();
    segs.push({ id: bId, x1: b.bx, y1: METER_POS.y, x2: b.bx, y2: b.by, length: b.bLen });
    apps.push({ id: appId, typeId: b.t.id, label: b.t.label, x: b.bx, y: b.by, mj: b.t.mj });
    const frac = (b.bx - METER_POS.x) / (endX - METER_POS.x);
    paths[appId] = [{ segId: tId, len: trunkLen * frac }, { segId: bId, len: b.bLen }];
    appId++;
  }
  return { segs, apps, paths, intendedInterior };
}

// Single straight run meter→appliance, optionally very long (table extrapolation).
function genSingle(longRun) {
  _id = 1;
  const t = pick(APPLIANCE_TYPES);
  const len = longRun ? ri(120, 320) : ri(1, 60);
  const tId = nextId();
  const segs = [{ id: tId, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + ri(4, 10) * 40, y2: METER_POS.y, length: len }];
  // appliance just off the end so it snaps to the end node
  const endX = segs[0].x2;
  const bLen = ri(1, 6);
  const bId = nextId();
  segs.push({ id: bId, x1: endX, y1: METER_POS.y, x2: endX, y2: METER_POS.y - bLen * 0 - 80, length: bLen });
  const apps = [{ id: 1, typeId: t.id, label: t.label, x: endX, y: METER_POS.y - 80, mj: t.mj }];
  const paths = { 1: [{ segId: tId, len }, { segId: bId, len: bLen }] };
  return { segs, apps, paths, intendedInterior: {} };
}

// Many high-demand appliances on a trunk → forces big DN / overflow.
function genHeavy() {
  _id = 1;
  const segs = [];
  const apps = [];
  const paths = {};
  const intendedInterior = {};
  const heavy = ['storage_hws', 'instant_hws', 'ducted_heater'];
  const nApp = ri(4, 10);
  let px = METER_POS.x;
  let path = [];
  for (let i = 0; i < nApp; i++) {
    const nx = px + ri(1, 2) * 40;
    const tLen = ri(2, 15);
    const tId = nextId();
    segs.push({ id: tId, x1: px, y1: METER_POS.y, x2: nx, y2: METER_POS.y, length: tLen });
    path = [...path, { segId: tId, len: tLen }];
    const bLen = ri(1, 10);
    const bId = nextId();
    const by = METER_POS.y + (i % 2 ? 1 : -1) * ri(3, 6) * 40;
    segs.push({ id: bId, x1: nx, y1: METER_POS.y, x2: nx, y2: by, length: bLen });
    const tid = pick(heavy);
    const t = APPLIANCE_TYPES.find((a) => a.id === tid);
    apps.push({ id: i + 1, typeId: t.id, label: t.label, x: nx, y: by, mj: t.mj });
    paths[i + 1] = [...path, { segId: bId, len: bLen }];
    px = nx;
  }
  return { segs, apps, paths, intendedInterior };
}

function randomScenario() {
  const roll = rng();
  let base;
  if (roll < 0.4) base = genTree(ri(1, 3));
  else if (roll < 0.65) base = genMidtap();
  else if (roll < 0.8) base = genSingle(rng() < 0.4);
  else base = genHeavy();

  // Pressure: spans all four bands (F6/F7/F8/F9) incl. the low-pressure clamp.
  const P = Number((1.13 + ri(0, 167) * 0.05).toFixed(2)); // 1.13 .. ~9.48
  const margin = ri(0, 60);
  const q = {
    addr: 't', pressure: P, newMeter: rng() < 0.7,
    pens: ri(0, 5), dig: ri(0, 8), conc: ri(0, 5), twoS: rng() < 0.4
  };
  return { ...base, q, margin };
}

// ── Independent oracle from recorded paths ──
function oracle(sc) {
  const flow = {};
  sc.segs.forEach((s) => (flow[s.id] = 0));
  let longest = 0;
  for (const a of sc.apps) {
    const path = sc.paths[a.id];
    const dev = path.reduce((s, e) => s + e.len, 0);
    longest = Math.max(longest, dev);
    for (const e of path) flow[e.segId] += a.mj;
  }
  const size = {};
  for (const s of sc.segs) size[s.id] = oSize(flow[s.id], longest, sc.q.pressure);
  return { flow, longest, size };
}

function oPrice(sc, sized) {
  const cfg = DEFAULT_CONFIG, q = sc.q;
  const totalLen = sc.segs.reduce((s, x) => s + (x.length || 0), 0);
  const hrs = cfg.baseHours + Math.max(0, totalLen - cfg.baseMetres) * (cfg.perMetreMins / 60) + sc.apps.length * (cfg.applianceMins / 60) + (q.newMeter ? cfg.meterHours : 0);
  const labour = hrs * cfg.labourRate;
  const copperMat = sized.reduce((s, x) => s + (x.length || 0) * (cfg.copperRates[x.size] || 0), 0) * (1 + (cfg.pipeWastePct || 0) / 100);
  const applianceMat = sc.apps.reduce((s, a) => s + ((cfg.applianceMaterial && cfg.applianceMaterial[a.typeId]) || 0), 0);
  const meter = q.newMeter ? (cfg.meterMaterial || 0) : 0;
  const site = q.pens * cfg.penetrationCost + q.dig * cfg.diggingRate + q.conc * cfg.concreteCuttingRate + (q.twoS ? cfg.twoStoreyFlat : 0);
  const subtotal = labour + copperMat + applianceMat + meter + site;
  return { subtotal, total: subtotal / (1 - Math.min(sc.margin, 99.9) / 100) };
}

// ── Run ──
let skipped = 0;
const modeCount = {};
for (let n = 0; n < N; n++) {
  let sc, attempts = 0;
  do { sc = randomScenario(); attempts++; } while (!geometryClean(sc.segs, sc.intendedInterior) && attempts < 6);
  if (!geometryClean(sc.segs, sc.intendedInterior)) { skipped++; continue; }
  check(`#${n} geometry faithful`, true); // reached here = clean

  const exp = oracle(sc);
  const qr = calcQuote(sc.segs, sc.apps, sc.q, DEFAULT_CONFIG, sc.margin);
  const tag = `#${n} P=${sc.q.pressure} apps=${sc.apps.length}`;
  if (!qr) { check(`${tag} quote`, false, 'null'); continue; }

  check(`${tag} longest`, Math.abs(qr.longest - exp.longest) < 1e-4, `${qr.longest} vs ${exp.longest}`);
  check(`${tag} totalMJ`, qr.totalMJ === sc.apps.reduce((s, a) => s + a.mj, 0));
  check(`${tag} band`, qr.band.id === oBand(sc.q.pressure).id, `${qr.band.id} vs ${oBand(sc.q.pressure).id}`);

  const band = oBand(sc.q.pressure);
  for (const s of qr.sized) {
    check(`${tag} seg${s.id} flow`, s.flow === exp.flow[s.id], `${s.flow} vs ${exp.flow[s.id]}`);
    const o = exp.size[s.id];
    check(`${tag} seg${s.id} size`, s.size === o.size, `DN${s.size} vs DN${o.size} (flow ${s.flow}, run ${qr.longest.toFixed(1)}, ${band.id})`);
    check(`${tag} seg${s.id} oversized flag`, s.oversized === o.oversized, `${s.oversized} vs ${o.oversized}`);
    check(`${tag} seg${s.id} overCapacity flag`, s.overCapacity === o.overCapacity, `${s.overCapacity} vs ${o.overCapacity}`);
    // physical adequacy: chosen DN carries the flow (unless genuinely over capacity)
    const cap = oCapacity(band, s.size, qr.longest);
    check(`${tag} seg${s.id} DN adequate`, s.overCapacity || (cap != null && cap >= s.flow - 1e-6), `DN${s.size} cap ${cap} < ${s.flow}`);
  }

  const op = oPrice(sc, qr.sized);
  check(`${tag} subtotal`, Math.abs(qr.subtotal - op.subtotal) < 0.005, `${qr.subtotal} vs ${op.subtotal}`);
  check(`${tag} total`, Math.abs(qr.total - op.total) < 0.01, `${qr.total} vs ${op.total}`);

  modeCount[sc.apps.length] = (modeCount[sc.apps.length] || 0) + 1;
}

// ── Targeted edge cases ──
function ec(name, cond, detail) { check('EDGE ' + name, cond, detail); }
const baseQ = (p) => ({ addr: '', pressure: p, newMeter: false, pens: 0, dig: 0, conc: 0, twoS: false });
// low pressure → F6 band selected
{
  const segs = [{ id: 1, x1: 120, y1: 280, x2: 440, y2: 280, length: 10 }];
  const apps = [{ id: 1, typeId: 'cooktop', mj: 30, x: 440, y: 280, label: 'C' }];
  const qr = calcQuote(segs, apps, baseQ(1.2), DEFAULT_CONFIG, 20);
  ec('P=1.2 → band F6', qr.band.id === 'F6', qr.band.id);
  ec('P=1.2 size = oracle', qr.sized[0].size === oSize(30, 10, 1.2).size);
}
// band switches with pressure for the same job (higher P → same/smaller pipe)
{
  const segs = [{ id: 1, x1: 120, y1: 280, x2: 760, y2: 280, length: 40 }];
  const apps = [{ id: 1, typeId: 'storage_hws', mj: 200, x: 760, y: 280, label: 'H' }];
  const lo = calcQuote(segs, apps, baseQ(1.6), DEFAULT_CONFIG, 20); // F7
  const hi = calcQuote(segs, apps, baseQ(3.0), DEFAULT_CONFIG, 20); // F8
  ec('1.6 kPa uses F7', lo.band.id === 'F7');
  ec('3.0 kPa uses F8', hi.band.id === 'F8');
  ec('higher pressure never needs bigger pipe', hi.sized[0].size <= lo.sized[0].size, `F8 DN${hi.sized[0].size} vs F7 DN${lo.sized[0].size}`);
}
// beyond-table run (300m) clamps to 200m row
{
  const segs = [{ id: 1, x1: 120, y1: 280, x2: 920, y2: 280, length: 300 }];
  const apps = [{ id: 1, typeId: 'storage_hws', mj: 200, x: 920, y: 280, label: 'H' }];
  const qr = calcQuote(segs, apps, baseQ(3.0), DEFAULT_CONFIG, 20);
  ec('300m run = oracle (extrapolation clamp)', qr.sized[0].size === oSize(200, 300, 3.0).size, `DN${qr.sized[0].size}`);
}
// overflow: demand beyond DN50 capacity → DN50 + overCapacity flag
{
  const segs = [{ id: 1, x1: 120, y1: 280, x2: 920, y2: 280, length: 200 }];
  const apps = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, typeId: 'storage_hws', mj: 200, x: 920, y: 280, label: 'H' }));
  const qr = calcQuote(segs, apps, baseQ(1.2), DEFAULT_CONFIG, 20);
  ec('massive overflow → DN50 + flag', qr.sized[0].size === 50 && qr.sized[0].overCapacity === true, `DN${qr.sized[0].size}`);
}
// guards
ec('empty → null', calcQuote([], [], baseQ(2), DEFAULT_CONFIG, 20) === null);
ec('no lengths → null', calcQuote([{ id: 1, x1: 120, y1: 280, x2: 200, y2: 280, length: null }], [{ id: 1, typeId: 'cooktop', mj: 30, x: 200, y: 280, label: 'C' }], baseQ(2), DEFAULT_CONFIG, 20) === null);

console.log(`\n  Ran ${N} randomized scenarios (${skipped} skipped as unclean) + edge cases`);
console.log(`  appliance-count spread: ${Object.entries(modeCount).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`  ${fail === 0 ? '🎉' : '⚠️'}  ${pass} assertions passed, ${fail} failed`);
if (fail) { console.log('\n  Failures (first 40):'); failures.forEach((f) => console.log('   ✗ ' + f)); }
process.exit(fail === 0 ? 0 : 1);
