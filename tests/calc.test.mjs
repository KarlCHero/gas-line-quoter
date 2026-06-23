/**
 * Targeted calc checks — AS/NZS 5601.1:2013 band-table sizing.
 * Run: node tests/calc.test.mjs
 */
import { analyse, selectBand, selectPEBand, capacityAt, findSize, CU_SIZES, PE_SIZES } from '../src/lib/calc/sizing.js';
import { calcQuote } from '../src/lib/calc/pricing.js';
import { DEFAULT_CONFIG } from '../src/lib/config/defaults.js';
import { COPPER_BANDS, PE_BANDS } from '../src/lib/calc/tables.js';
import { oSize, oCapacity, oPESize, oPEBand } from './_oracle.mjs';

const band = (id) => COPPER_BANDS.find((b) => b.id === id);
const peBand = (id) => PE_BANDS.find((b) => b.id === id);

let pass = 0, fail = 0;
const approx = (a, b, e = 0.01) => Math.abs(a - b) <= e;
function ok(name, cond) { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } }

// ── Table data verified against the standard (spot cells) ──
const F8 = COPPER_BANDS.find((b) => b.id === 'F8');
ok('F8 DN15 @2m = 168', F8.sizes[15][0] === 168);
ok('F8 DN20 @20m = 160', F8.sizes[20][9] === 160);
ok('F8 DN25 @200m = 101 (standard; old app had wrong 111)', F8.sizes[25][20] === 101);
ok('F8 DN25 @80m = 166 (standard; old app had wrong 168)', F8.sizes[25][16] === 166);
ok('F8 DN20 omitted @160m (not recommended; old app allowed it)', F8.sizes[20][19] === null);
ok('F8 DN15 omitted @80m (excessive velocity)', F8.sizes[15][16] === null);
const F7 = COPPER_BANDS.find((b) => b.id === 'F7');
ok('F7 DN20 @30m = 71', F7.sizes[20][11] === 71);

// ── Band selection by allowable drop (supply − 1.13 kPa appliance min) ──
ok('1.2 kPa → F6 (drop 0.07 < 0.12 → conservative)', selectBand(1.2).id === 'F6');
ok('1.5 kPa → F7 (drop 0.37 affords 0.25)', selectBand(1.5).id === 'F7');
ok('2.0 kPa → F8 (drop 0.87 affords 0.75)', selectBand(2.0).id === 'F8');
ok('2.6 kPa → F8 (drop 1.47 < 1.5)', selectBand(2.6).id === 'F8');
ok('2.75 kPa → F9 (drop 1.62 affords 1.5)', selectBand(2.75).id === 'F9');
ok('6 kPa → F9', selectBand(6).id === 'F9');

// ── Truly-independent data check: literal cells hand-read from the PDF ──
// (verifies the parser AND the table data without trusting tables.js)
const PDF_CELLS = [
  ['F6', 50, 2, 3356], ['F7', 32, 20, 371], ['F8', 25, 80, 166], ['F8', 25, 200, 101],
  ['F9', 20, 2, 807], ['F9', 15, 10, 102], ['F9', 15, 80, 33]
];
for (const [b, dn, len, mj] of PDF_CELLS) {
  ok(`${b} DN${dn}@${len}m = ${mj} (PDF)`, capacityAt(band(b), dn, len) === mj);
}

// ── Availability: DN15 unavailable beyond its range ──
ok('F8 DN15 capacity null @120m', capacityAt(F8, 15, 120) === null);
ok('F8 DN15 capacity ok @30m', capacityAt(F8, 15, 30) === 39);

// ── Omitted-cell GAP: F9 DN15 is tabulated 2-18 & 65-140 but OMITTED 20-60 ──
// Must NOT interpolate across the gap (was the bug the QA workflow caught).
ok('F9 DN15 @40m = null (omitted, no bridge)', capacityAt(band('F9'), 15, 40) === null);
ok('oracle agrees: F9 DN15 @40m = null', oCapacity(band('F9'), 15, 40) === null);
ok('F9 DN15 @80m = 33 (tabulated again)', capacityAt(band('F9'), 15, 80) === 33);
ok('findSize 30MJ/40m/F9 skips DN15 → DN20', findSize(30, 40, band('F9')).size === 20);

// ── Branch network (flows unchanged by the sizing change) ──
const segs = [
  { id: 's1', x1: 120, y1: 280, x2: 280, y2: 280, length: 10 },
  { id: 's2', x1: 280, y1: 280, x2: 280, y2: 160, length: 5 },
  { id: 's3', x1: 280, y1: 280, x2: 280, y2: 400, length: 5 }
];
const apps = [
  { id: 'a1', typeId: 'storage_hws', x: 280, y: 160, mj: 200, label: 'Storage HWS' },
  { id: 'a2', typeId: 'cooktop', x: 280, y: 400, mj: 30, label: 'Cooktop' }
];
const an = analyse(segs, apps);
ok('tee longest = 15m', an.longest === 15);
ok('tee trunk flow = 230', an.flows.s1 === 230);
ok('tee HWS branch = 200', an.flows.s2 === 200);
ok('tee cooktop branch = 30', an.flows.s3 === 30);

// Sizes must match the independent band oracle, at two pressures.
for (const P of [2.0, 2.75]) {
  const qr = calcQuote(segs, apps, { pressure: P, newMeter: true, pens: 0, dig: 0, conc: 0, twoS: false }, DEFAULT_CONFIG, 20);
  for (const s of qr.sized) {
    const o = oSize(s.flow, qr.longest, P);
    ok(`tee P=${P} ${s.id} → DN${s.size} matches oracle DN${o.size}`, s.size === o.size && s.oversized === o.oversized);
  }
  // pricing recomputed independently (labour rate×time + itemised material)
  const C = DEFAULT_CONFIG, totalLen = 20;
  const hrs = C.baseHours + Math.max(0, totalLen - C.baseMetres) * (C.perMetreMins / 60) + 2 * (C.applianceMins / 60) + C.meterHours;
  const labour = hrs * C.labourRate;
  const copperMat = qr.sized.reduce((t, s) => t + s.length * C.copperRates[s.size], 0) * (1 + C.pipeWastePct / 100);
  const applianceMat = C.applianceMaterial.storage_hws + C.applianceMaterial.cooktop;
  const sub = labour + copperMat + applianceMat + C.meterMaterial + C.cocCost;
  ok(`tee P=${P} subtotal matches formula`, approx(qr.subtotal, sub));
  ok(`tee P=${P} total = subtotal/0.8`, approx(qr.total, sub / 0.8));
}

// ── Borderline oversize: flow just under a size's capacity → step up + flag ──
{
  // P=2.0 → F8. DN15 @30m F8 = 39 MJ/h; 38 is 97% of capacity → borderline → DN20, oversized.
  const s = [{ id: 1, x1: 120, y1: 280, x2: 1320, y2: 280, length: 30 }];
  const a = [{ id: 1, typeId: 'x', mj: 38, x: 1320, y: 280, label: 'x' }];
  const qr = calcQuote(s, a, { pressure: 2.0, newMeter: false, pens: 0, dig: 0, conc: 0, twoS: false }, DEFAULT_CONFIG, 20);
  ok('borderline 38MJ/30m/F8 → DN20 oversized', qr.sized[0].size === 20 && qr.sized[0].oversized === true);
}

// ── Over-capacity: demand beyond DN50 → flagged ──
{
  const s = [{ id: 1, x1: 120, y1: 280, x2: 920, y2: 280, length: 200 }];
  const a = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, typeId: 'storage_hws', mj: 200, x: 920, y: 280, label: 'H' }));
  const qr = calcQuote(s, a, { pressure: 1.2, newMeter: false, pens: 0, dig: 0, conc: 0, twoS: false }, DEFAULT_CONFIG, 20);
  ok('16000 MJ → DN50 overCapacity flag', qr.sized[0].size === 50 && qr.sized[0].overCapacity === true);
}

// ── PE (AS/NZS 4130 SDR 11) tables F20/F21/F22 ──
// Spot cells hand-read from the PDF (verifies parser + table data).
const PE_PDF_CELLS = [
  ['F20', 20, 2, 170], ['F20', 160, 2, 65337], ['F20', 40, 320, 108],
  ['F21', 20, 2, 308], ['F21', 160, 20, 34063], ['F21', 160, 320, 7601],
  ['F22', 110, 2, 64607], ['F22', 25, 18, 317], ['F22', 160, 320, 11059]
];
for (const [b, dn, len, mj] of PE_PDF_CELLS) {
  ok(`PE ${b} DN${dn}@${len}m = ${mj} (PDF)`, capacityAt(peBand(b), dn, len) === mj);
}

// PE band selection — no PE table below 1.5 kPa (must force copper), gap → lower.
ok('PE 1.2 kPa → null (no PE table)', selectPEBand(1.2) === null);
ok('PE 1.5 kPa → F20 (drop 0.37 affords 0.25)', selectPEBand(1.5).id === 'F20');
ok('PE 2.6 kPa → F21 (drop 1.47 affords 0.75)', selectPEBand(2.6).id === 'F21');
ok('PE 2.75 kPa → F22 (drop 1.62 affords 1.5)', selectPEBand(2.75).id === 'F22');
ok('PE 6 kPa → F22', selectPEBand(6).id === 'F22');

// PE availability / omitted cells (small DN drops out at long runs; DN160 at short).
ok('PE F20 DN20 null @20m (omitted past 18m)', capacityAt(peBand('F20'), 20, 20) === null);
ok('PE F20 DN160 @320m = 4195', capacityAt(peBand('F20'), 160, 320) === 4195);
ok('PE F21 DN160 null @2m (omitted at short run)', capacityAt(peBand('F21'), 160, 2) === null);

// PE findSize over a deterministic flow×length×pressure grid vs the independent oracle.
{
  let peChecks = 0, peOk = 0;
  for (const P of [1.5, 2.0, 2.7, 2.75, 4.0, 6.0, 9.0]) {
    const pb = selectPEBand(P);
    ok(`PE selectPEBand(${P}) matches oracle`, (pb && pb.id) === (oPEBand(P) && oPEBand(P).id));
    for (const flow of [20, 50, 120, 200, 500, 2000, 8000]) {
      for (const len of [2, 5, 12, 28, 55, 90, 150, 250, 320]) {
        const e = findSize(flow, len, pb);
        const o = oPESize(flow, len, P);
        peChecks++;
        if (e.size === o.size && e.oversized === o.oversized && e.overCapacity === o.overCapacity && PE_SIZES.includes(e.size)) peOk++;
      }
    }
  }
  ok(`PE findSize matches oracle across ${peChecks} flow×length cases`, peOk === peChecks);
}

// ── Copper / PE mix costing ──
const mixJob = (P) => ({ addr: '', pressure: P, newMeter: false, pens: 0, dig: 0, conc: 0, twoS: false });
const segOf = (qr, id) => qr.sized.find((s) => s.id === id);
{
  // s1 internal (copper-only), s2 buried (PE-eligible), one cooktop on s2's end.
  const ms = [
    { id: 's1', x1: 120, y1: 280, x2: 440, y2: 280, length: 10, location: 'internal' },
    { id: 's2', x1: 440, y1: 280, x2: 440, y2: 160, length: 8, location: 'buried' }
  ];
  const ma = [{ id: 'a1', typeId: 'cooktop', x: 440, y: 160, mj: 30, label: 'Cooktop' }];
  // 1.6 kPa (F7): copper stays DN20 on this short buried branch, so swapping to
  // PE clearly out-saves the 1-stub transition labour. (At higher supply the
  // bigger allowable drop sizes copper down to DN15 and PE no longer pays here.)
  const qr = calcQuote(ms, ma, mixJob(1.6), DEFAULT_CONFIG, 40);
  ok('mix: internal seg → copper', segOf(qr, 's1').material === 'copper');
  ok('mix: buried seg → PE', segOf(qr, 's2').material === 'pe');
  ok('mix: PE DN comes from PE_SIZES', PE_SIZES.includes(segOf(qr, 's2').size));
  ok('mix: copper scenario all copper', qr.scenarios.copper.sized.every((s) => s.material === 'copper'));
  ok('mix: maxPE puts internal on PE too', qr.scenarios.maxPE.sized.find((s) => s.id === 's1').material === 'pe');
  ok('mix: appliance on PE branch → 1 copper stub', qr.stubs.count === 1);
  ok('mix: hasPE flag set', qr.hasPE === true);
  ok('mix: PE is cheaper → positive saving', qr.saving > 0);
  ok('mix: primary total = mix scenario', approx(qr.total, qr.scenarios.mix.total));
  ok('mix: copper total ≥ mix total', qr.scenarios.copper.total >= qr.scenarios.mix.total);
}
{
  // External seg meets a buried seg → outside→inside entry; appliance on PE end.
  const ms = [
    { id: 's1', x1: 120, y1: 280, x2: 440, y2: 280, length: 5, location: 'external' },
    { id: 's2', x1: 440, y1: 280, x2: 440, y2: 160, length: 8, location: 'buried' }
  ];
  const ma = [{ id: 'a1', typeId: 'cooktop', x: 440, y: 160, mj: 30, label: 'Cooktop' }];
  // Stub geometry is a property of the mix scenario; assert on it directly (the
  // recommended primary may be all-copper here, since on this short run the stubs
  // + transition labour make the mix dearer).
  const qr = calcQuote(ms, ma, mixJob(2.0), DEFAULT_CONFIG, 40);
  ok('entry: external seg stays copper', segOf(qr.scenarios.mix, 's1').material === 'copper');
  ok('entry: mix has 2 stubs (appliance + building entry)', qr.scenarios.mix.stubs.count === 2);
  ok('entry: stub metres = 2 × copperStubM', approx(qr.scenarios.mix.stubs.metres, 2 * DEFAULT_CONFIG.copperStubM));
}
{
  // Below 1.5 kPa the standard omits PE → mix must fall back to all copper.
  const ms = [{ id: 's1', x1: 120, y1: 280, x2: 440, y2: 280, length: 10, location: 'buried' }];
  const ma = [{ id: 'a1', typeId: 'cooktop', x: 440, y: 280, mj: 30, label: 'Cooktop' }];
  const qr = calcQuote(ms, ma, mixJob(1.2), DEFAULT_CONFIG, 40);
  ok('low P: peBandId null', qr.peBandId === null);
  ok('low P: no PE used', qr.hasPE === false && segOf(qr, 's1').material === 'copper');
  ok('low P: no saving', approx(qr.saving, 0));
  ok('low P: no stubs', qr.stubs.count === 0);
}

// ── Guards ──
ok('empty → null', calcQuote([], [], { pressure: 2 }, DEFAULT_CONFIG, 20) === null);
ok('no appliances → null', calcQuote(segs, [], { pressure: 2 }, DEFAULT_CONFIG, 20) === null);

console.log(`\n  ${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
