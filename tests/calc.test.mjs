/**
 * Targeted calc checks — AS/NZS 5601.1:2013 band-table sizing.
 * Run: node tests/calc.test.mjs
 */
import { analyse, selectBand, capacityAt, findSize, CU_SIZES } from '../src/lib/calc/sizing.js';
import { calcQuote } from '../src/lib/calc/pricing.js';
import { DEFAULT_CONFIG } from '../src/lib/config/defaults.js';
import { COPPER_BANDS } from '../src/lib/calc/tables.js';
import { oSize, oCapacity } from './_oracle.mjs';

const band = (id) => COPPER_BANDS.find((b) => b.id === id);

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

// ── Band selection by supply pressure ──
ok('1.2 kPa → F6', selectBand(1.2).id === 'F6');
ok('2.0 kPa → F7', selectBand(2.0).id === 'F7');
ok('2.6 kPa → F7 (gap → lower band)', selectBand(2.6).id === 'F7');
ok('2.75 kPa → F8', selectBand(2.75).id === 'F8');
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
  const sub = labour + copperMat + applianceMat + C.meterMaterial;
  ok(`tee P=${P} subtotal matches formula`, approx(qr.subtotal, sub));
  ok(`tee P=${P} total = subtotal/0.8`, approx(qr.total, sub / 0.8));
}

// ── Borderline oversize: flow just under a size's capacity → step up + flag ──
{
  // DN15 @30m F8 = 39 MJ/h; 38 is 97% of capacity → borderline → DN20, oversized.
  const s = [{ id: 1, x1: 120, y1: 280, x2: 1320, y2: 280, length: 30 }];
  const a = [{ id: 1, typeId: 'x', mj: 38, x: 1320, y: 280, label: 'x' }];
  const qr = calcQuote(s, a, { pressure: 2.75, newMeter: false, pens: 0, dig: 0, conc: 0, twoS: false }, DEFAULT_CONFIG, 20);
  ok('borderline 38MJ/30m/F8 → DN20 oversized', qr.sized[0].size === 20 && qr.sized[0].oversized === true);
}

// ── Over-capacity: demand beyond DN50 → flagged ──
{
  const s = [{ id: 1, x1: 120, y1: 280, x2: 920, y2: 280, length: 200 }];
  const a = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, typeId: 'storage_hws', mj: 200, x: 920, y: 280, label: 'H' }));
  const qr = calcQuote(s, a, { pressure: 1.2, newMeter: false, pens: 0, dig: 0, conc: 0, twoS: false }, DEFAULT_CONFIG, 20);
  ok('16000 MJ → DN50 overCapacity flag', qr.sized[0].size === 50 && qr.sized[0].overCapacity === true);
}

// ── Guards ──
ok('empty → null', calcQuote([], [], { pressure: 2 }, DEFAULT_CONFIG, 20) === null);
ok('no appliances → null', calcQuote(segs, [], { pressure: 2 }, DEFAULT_CONFIG, 20) === null);

console.log(`\n  ${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
