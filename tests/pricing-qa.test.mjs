/**
 * Pricing QA — 1000 randomised scenarios verifying every invariant in calcQuote.
 *
 * What this covers that the sizing stress test doesn't:
 *   • All arithmetic decompositions (labour / materials / site works)
 *   • autoDig from buried segments feeding digCost
 *   • Transition labour (transitionMins × stubs)
 *   • Three-scenario pricing (copper / mix / maxPE) at 25% and random margins
 *   • Per-scenario margin math and subtotal decomposition
 *   • copper scenario always has zero PE and zero stubs
 *   • PE segment sizing against oracle (oPESize)
 *   • Sanity bounds: all costs positive, no NaN
 *
 * Layout discipline: star pattern (meter → trunk → junction → 1-4 branches).
 * Simple enough to avoid geometry surprises but still exercises T-junctions,
 * multiple appliances, and all five pipe locations.
 *
 * Run: node tests/pricing-qa.test.mjs [N]   (default 1000)
 */
import { calcQuote } from '../src/lib/calc/pricing.js';
import { DEFAULT_CONFIG } from '../src/lib/config/defaults.js';
import { APPLIANCE_TYPES, GRID, METER_POS, PIPE_LOCATIONS } from '../src/lib/calc/constants.js';
import { oBand, oPEBand, oSize, oPESize, oCapacity } from './_oracle.mjs';

const N = Number(process.argv[2]) || 1000;

// ── Seeded RNG ──────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xdeadbeef);
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];

// ── Assertion machinery ──────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fail++;
  if (failures.length < 60) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
}
function near(a, b, tol = 0.005) { return Math.abs(a - b) < tol; }
function finite(v) { return typeof v === 'number' && isFinite(v); }

// ── Location constants ───────────────────────────────────────────────────────
const ALL_LOCS = PIPE_LOCATIONS.map(l => l.id);
const PE_LOCS = PIPE_LOCATIONS.filter(l => l.pe).map(l => l.id);

// ── Star layout generator ────────────────────────────────────────────────────
// meter → trunk → junction (at jX,jY), then nBranch arms going to appliances.
// Every appliance sits exactly at the far endpoint of its branch → no snap issues.
function starLayout(trunkLen, branches) {
  const jX = METER_POS.x + 6 * GRID;
  const jY = METER_POS.y;
  let id = 1;
  const segs = [];
  const apps = [];

  segs.push({
    id: id++, x1: METER_POS.x, y1: jY, x2: jX, y2: jY,
    length: trunkLen, location: branches[0]?.trunkLoc || 'external'
  });

  branches.forEach((b, i) => {
    // branches alternate above/below the junction, spread horizontally so no overlap
    const bX = jX + (i + 1) * 2 * GRID;
    const bY = jY + (i % 2 === 0 ? 1 : -1) * (i + 1) * 2 * GRID;
    segs.push({ id: id++, x1: jX, y1: jY, x2: bX, y2: bY, length: b.len, location: b.loc });
    const t = b.appType;
    apps.push({ id: i + 1, typeId: t.id, label: t.label, x: bX, y: bY, mj: t.mj });
  });

  return { segs, apps };
}

// ── Scenario generator ───────────────────────────────────────────────────────
function makeScenario(n) {
  // Pressure spans F6/F7/F8/F9 and straddles the PE availability threshold
  const pressure = Number((1.1 + ri(0, 178) * 0.05).toFixed(2)); // 1.10 .. 9.00+

  // First 500 runs at 25%, rest random — Karl's request
  const margin = n < 500 ? 25 : ri(0, 60);

  const q = {
    addr: 'QA',
    pressure,
    newMeter: rng() < 0.6,
    pens: ri(0, 3),
    dig: ri(0, 6),
    conc: ri(0, 2),
    twoS: rng() < 0.3
  };

  const nBranches = ri(1, 4);
  const trunkLen = ri(2, 20);
  const branches = Array.from({ length: nBranches }, () => ({
    len: ri(1, 20),
    loc: pick(ALL_LOCS),
    appType: pick(APPLIANCE_TYPES),
    trunkLoc: pick(ALL_LOCS)
  }));
  const { segs, apps } = starLayout(trunkLen, branches);

  // PE locations config: vary to test all combinations
  const r = rng();
  const peLocations =
    r < 0.15 ? [] :
    r < 0.35 ? ['buried'] :
    r < 0.55 ? ['buried', 'under-house'] :
    r < 0.75 ? DEFAULT_CONFIG.peLocations :
    PE_LOCS;

  const cfg = { ...DEFAULT_CONFIG, peLocations };
  return { segs, apps, q, margin, cfg };
}

// ── Per-scenario verifier ────────────────────────────────────────────────────
function verify(n) {
  const { segs, apps, q, margin, cfg } = makeScenario(n);
  const tag = `#${n} P=${q.pressure} margin=${margin}%`;

  const qr = calcQuote(segs, apps, q, cfg, margin);
  check(`${tag} produced a quote`, qr !== null, 'null returned');
  if (!qr) return;

  const m = Math.min(margin, 99.9) / 100;

  // ── No NaN anywhere ──
  const topNums = ['total','subtotal','labourCost','labourHours','materialCost',
    'copperMat','peMat','applianceMat','meterMat','siteWorks',
    'penCost','digCost','concCost','twoCost','cocCost','autoDig','saving'];
  for (const f of topNums) check(`${tag} ${f} is finite`, finite(qr[f]), `${f}=${qr[f]}`);

  // ── Primary total = subtotal / (1 - m) ──
  check(`${tag} margin math`, near(qr.total, qr.subtotal / (1 - m)),
    `${qr.total.toFixed(4)} vs ${(qr.subtotal / (1 - m)).toFixed(4)}`);

  // ── Subtotal decomposition ──
  check(`${tag} subtotal=labour+mat+site`,
    near(qr.subtotal, qr.labourCost + qr.materialCost + qr.siteWorks),
    `${qr.subtotal} vs ${(qr.labourCost + qr.materialCost + qr.siteWorks).toFixed(4)}`);

  // ── Material decomposition ──
  check(`${tag} mat decomp`,
    near(qr.materialCost, qr.copperMat + qr.peMat + qr.applianceMat + qr.meterMat),
    `${qr.materialCost} vs ${(qr.copperMat + qr.peMat + qr.applianceMat + qr.meterMat).toFixed(4)}`);

  // ── Site works decomposition ──
  check(`${tag} site decomp`,
    near(qr.siteWorks, qr.penCost + qr.digCost + qr.concCost + qr.twoCost + qr.cocCost),
    `${qr.siteWorks} vs ${(qr.penCost + qr.digCost + qr.concCost + qr.twoCost + qr.cocCost).toFixed(4)}`);

  // ── autoDig = sum of buried segment lengths ──
  const expectedAutoDig = segs
    .filter(s => (s.location || 'internal') === 'buried')
    .reduce((sum, s) => sum + (s.length || 0), 0);
  check(`${tag} autoDig`, near(qr.autoDig, expectedAutoDig),
    `${qr.autoDig} vs ${expectedAutoDig}`);

  // ── Dig cost uses autoDig + manual ──
  check(`${tag} digCost=(autoDig+dig)*rate`,
    near(qr.digCost, (qr.autoDig + (q.dig || 0)) * (cfg.diggingRate || 0)),
    `${qr.digCost}`);

  // ── Labour: base hours + transition hours ──
  const totalLen = segs.reduce((s, x) => s + (x.length || 0), 0);
  const extraM = Math.max(0, totalLen - cfg.baseMetres);
  const baseHrs = cfg.baseHours
    + extraM * (cfg.perMetreMins / 60)
    + apps.length * (cfg.applianceMins / 60)
    + (q.newMeter ? cfg.meterHours : 0);
  const expectedHrs = baseHrs + qr.stubs.count * (cfg.transitionMins / 60);
  check(`${tag} labourHours`, near(qr.labourHours, expectedHrs),
    `${qr.labourHours.toFixed(4)} vs ${expectedHrs.toFixed(4)}`);
  check(`${tag} labourCost=hrs*rate`, near(qr.labourCost, qr.labourHours * cfg.labourRate));

  // ── Appliance material: sum of per-type costs ──
  const expectedAppMat = apps.reduce((s, a) => s + (cfg.applianceMaterial[a.typeId] || 0), 0);
  check(`${tag} applianceMat`, near(qr.applianceMat, expectedAppMat));

  // ── Meter material ──
  check(`${tag} meterMat`, near(qr.meterMat, q.newMeter ? cfg.meterMaterial : 0));

  // ── Pen cost ──
  check(`${tag} penCost`, near(qr.penCost, (q.pens || 0) * cfg.penetrationCost));

  // ── Two-storey ──
  check(`${tag} twoCost`, near(qr.twoCost, q.twoS ? cfg.twoStoreyFlat : 0));

  // ── Concrete cost ──
  check(`${tag} concCost`, near(qr.concCost, (q.conc || 0) * cfg.concreteCuttingRate));

  // ── At 25%: total = subtotal × 4/3 exactly ──
  if (margin === 25) {
    check(`${tag} 25% exact`, near(qr.total, qr.subtotal * 4 / 3, 0.02),
      `${qr.total.toFixed(2)} vs ${(qr.subtotal * 4 / 3).toFixed(2)}`);
  }

  // ── saving = recommended option's advantage over the other (never negative) ──
  check(`${tag} saving`, near(qr.saving, Math.abs(qr.scenarios.copper.total - qr.scenarios.mix.total)),
    `${qr.saving}`);
  check(`${tag} saving >= 0`, qr.saving >= -1e-9, `${qr.saving}`);

  // ── recommended = the cheaper scenario; primary total matches it ──
  const recScn = qr.recommended === 'mix' ? qr.scenarios.mix : qr.scenarios.copper;
  check(`${tag} recommended is cheaper`,
    recScn.total <= qr.scenarios[qr.recommended === 'mix' ? 'copper' : 'mix'].total + 1e-9,
    `rec=${qr.recommended}`);
  check(`${tag} primary total = recommended`, near(qr.total, recScn.total), `${qr.total} vs ${recScn.total}`);

  // ── hasPE iff the recommended scenario uses PE ──
  check(`${tag} hasPE`, qr.hasPE === (qr.peMat > 0));

  // ── No PE when pressure < 1.5 ──
  if (q.pressure < 1.5) {
    check(`${tag} no PE at low P`, !qr.hasPE, `hasPE=${qr.hasPE}`);
    check(`${tag} peBandId null`, qr.peBandId === null, `peBandId=${qr.peBandId}`);
    check(`${tag} saving=0 at low P`, near(qr.saving, 0), `saving=${qr.saving}`);
  }

  // ── Three-scenario invariants ──
  for (const [mode, sc] of Object.entries(qr.scenarios)) {
    const stag = `${tag} [${mode}]`;
    check(`${stag} total finite`, finite(sc.total));
    check(`${stag} total>0`, sc.total > 0, `total=${sc.total}`);
    check(`${stag} margin math`, near(sc.total, sc.subtotal / (1 - m)),
      `${sc.total.toFixed(4)} vs ${(sc.subtotal / (1 - m)).toFixed(4)}`);
    check(`${stag} subtotal decomp`,
      near(sc.subtotal, sc.labourCost + sc.materialCost + qr.siteWorks),
      `${sc.subtotal.toFixed(4)}`);
    check(`${stag} labourCost=hrs*rate`, near(sc.labourCost, sc.labourHours * cfg.labourRate));
    check(`${stag} transition hrs`,
      near(sc.labourHours, baseHrs + sc.stubs.count * (cfg.transitionMins / 60)),
      `${sc.labourHours.toFixed(4)}`);
    if (margin === 25) {
      check(`${stag} 25% math`, near(sc.total, sc.subtotal * 4 / 3, 0.02));
    }
  }

  // ── Copper scenario: always all-copper, no stubs ──
  const cu = qr.scenarios.copper;
  check(`${tag} copper no stubs`, cu.stubs.count === 0, `count=${cu.stubs.count}`);
  check(`${tag} copper peM=0`, cu.peM === 0, `peM=${cu.peM}`);
  check(`${tag} copper all segs Cu`, cu.sized.every(s => s.material === 'copper'));

  // ── maxPE scenario: external stays copper ──
  const mxPE = qr.scenarios.maxPE;
  const externalSegs = segs.filter(s => (s.location || 'internal') === 'external');
  for (const es of externalSegs) {
    const sized = mxPE.sized.find(s => s.id === es.id);
    if (sized) check(`${tag} maxPE external=copper`, sized.material === 'copper', `loc=${es.location}`);
  }

  // ── Pipe sizing against oracle ──
  const P = q.pressure;
  const cuBand = oBand(P);
  const peBand = oPEBand(P);
  for (const s of qr.sized) {
    if (s.material === 'pe' && peBand) {
      const o = oPESize(s.flow, qr.longest, P);
      if (o) {
        check(`${tag} PE seg${s.id} size=oracle`, s.size === o.size,
          `DN${s.size} vs DN${o.size} flow=${s.flow} run=${qr.longest.toFixed(1)} band=${peBand.id}`);
        check(`${tag} PE seg${s.id} oversized=oracle`, s.oversized === o.oversized);
      }
    } else {
      const o = oSize(s.flow, qr.longest, P);
      check(`${tag} Cu seg${s.id} size=oracle`, s.size === o.size,
        `DN${s.size} vs DN${o.size} flow=${s.flow} run=${qr.longest.toFixed(1)} band=${cuBand.id}`);
      check(`${tag} Cu seg${s.id} oversized=oracle`, s.oversized === o.oversized);
      check(`${tag} Cu seg${s.id} overCapacity=oracle`, s.overCapacity === o.overCapacity);
      // Physical adequacy: chosen size actually carries the flow
      if (!s.overCapacity) {
        const cap = oCapacity(cuBand, s.size, qr.longest);
        check(`${tag} Cu seg${s.id} adequate`, cap == null || cap >= s.flow - 1e-6,
          `DN${s.size} cap=${cap} flow=${s.flow}`);
      }
    }
  }

  // ── Segment count preserved ──
  check(`${tag} all segs appear in mix`, qr.sized.length === segs.length,
    `${qr.sized.length} vs ${segs.length}`);

  // ── Sanity bounds ──
  check(`${tag} total >= cost`, qr.total >= qr.subtotal - 0.01);
  check(`${tag} total < $1M`, qr.total < 1_000_000, `total=${qr.total}`);
  check(`${tag} total > $50`, qr.total > 50, `total=${qr.total}`);
}

// ── Targeted 25% scenarios ───────────────────────────────────────────────────
function targeted(name, segs, apps, q, cfg = DEFAULT_CONFIG) {
  const qr = calcQuote(segs, apps, q, cfg, 25);
  check(`25% ${name} not null`, qr !== null);
  if (!qr) return null;
  check(`25% ${name} margin math`, near(qr.total, qr.subtotal * 4 / 3, 0.02),
    `${qr.total.toFixed(2)} vs ${(qr.subtotal * 4 / 3).toFixed(2)}`);
  for (const [k, sc] of Object.entries(qr.scenarios)) {
    check(`25% ${name} [${k}] margin math`, near(sc.total, sc.subtotal * 4 / 3, 0.02));
  }
  return qr;
}
const baseQ = (p = 2, extra = {}) => ({
  addr: '', pressure: p, newMeter: true,
  pens: 1, dig: 3, conc: 0, twoS: false, ...extra
});

// 1. Buried run — autoDig should add 15m to dig
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 6*GRID, y2: METER_POS.y, length: 8, location: 'external' },
    { id: 2, x1: METER_POS.x + 6*GRID, y1: METER_POS.y, x2: METER_POS.x + 6*GRID, y2: METER_POS.y + 8*GRID, length: 15, location: 'buried' },
  ];
  const apps = [{ id: 1, typeId: 'storage_hws', mj: 200, x: METER_POS.x + 6*GRID, y: METER_POS.y + 8*GRID, label: 'H' }];
  const qr = targeted('buried-autoDig', segs, apps, baseQ(2));
  if (qr) {
    check('buried autoDig=15', qr.autoDig === 15, `autoDig=${qr.autoDig}`);
    check('buried digCost=(15+3)*50', near(qr.digCost, 18 * 50), `digCost=${qr.digCost}`);
    check('buried S2=PE in mix', qr.sized.find(s => s.id === 2)?.material === 'pe');
    check('buried S1=Cu in mix', qr.sized.find(s => s.id === 1)?.material === 'copper');
  }
}

// 2. All external → no PE (external is the only copper-forced location), no stubs, autoDig=0
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 8*GRID, y2: METER_POS.y, length: 10, location: 'external' },
    { id: 2, x1: METER_POS.x + 8*GRID, y1: METER_POS.y, x2: METER_POS.x + 8*GRID, y2: METER_POS.y + 4*GRID, length: 5, location: 'external' },
  ];
  const apps = [{ id: 1, typeId: 'cooktop', mj: 30, x: METER_POS.x + 8*GRID, y: METER_POS.y + 4*GRID, label: 'C' }];
  const qr = targeted('all-external', segs, apps, baseQ(2));
  if (qr) {
    check('all-external no PE', !qr.hasPE);
    check('all-external no stubs', qr.stubs.count === 0);
    check('all-external autoDig=0', qr.autoDig === 0);
    check('all-external digCost=3*50', near(qr.digCost, 150), `digCost=${qr.digCost}`);
    check('all-external all Cu', qr.sized.every(s => s.material === 'copper'));
  }
}

// 3. Low pressure — no PE at all even on buried runs
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 6*GRID, y2: METER_POS.y, length: 10, location: 'buried' },
  ];
  const apps = [{ id: 1, typeId: 'cooktop', mj: 30, x: METER_POS.x + 6*GRID, y: METER_POS.y, label: 'C' }];
  const qr = targeted('low-pressure-no-pe', segs, apps, baseQ(1.2));
  if (qr) {
    check('low-P peBandId null', qr.peBandId === null);
    check('low-P no PE', !qr.hasPE);
    check('low-P all Cu', qr.sized.every(s => s.material === 'copper'));
    check('low-P autoDig still=10', qr.autoDig === 10, `autoDig=${qr.autoDig}`);
    check('low-P band=F6', qr.band.id === 'F6');
  }
}

// 4. Transition labour: known layout = 2 stubs → 2 × transitionMins/60 × labourRate extra
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 6*GRID, y2: METER_POS.y, length: 6, location: 'external' },
    { id: 2, x1: METER_POS.x + 6*GRID, y1: METER_POS.y, x2: METER_POS.x + 6*GRID, y2: METER_POS.y + 8*GRID, length: 12, location: 'buried' },
    { id: 3, x1: METER_POS.x + 6*GRID, y1: METER_POS.y, x2: METER_POS.x + 12*GRID, y2: METER_POS.y, length: 5, location: 'internal' },
  ];
  const apps = [
    { id: 1, typeId: 'storage_hws', mj: 200, x: METER_POS.x + 6*GRID, y: METER_POS.y + 8*GRID, label: 'H' },
    { id: 2, typeId: 'cooktop', mj: 30, x: METER_POS.x + 12*GRID, y: METER_POS.y, label: 'C' },
  ];
  const q = { addr: '', pressure: 2, newMeter: true, pens: 0, dig: 0, conc: 0, twoS: false };
  const qr = targeted('transition-labour', segs, apps, q);
  if (qr) {
    // Transition labour is a property of the mix scenario; assert the arithmetic
    // against its actual stub count (internal is now PE-eligible, so the cooktop
    // branch adds a stub too — count is whatever the geometry yields).
    const mix = qr.scenarios.mix;
    check('transition stubs > 0', mix.stubs.count > 0, `stubs=${mix.stubs.count}`);
    const tHrs = mix.stubs.count * (DEFAULT_CONFIG.transitionMins / 60);
    check('transition extra hrs', near(mix.labourHours - tHrs, qr.scenarios.copper.labourHours),
      `mix=${mix.labourHours.toFixed(3)} copper=${qr.scenarios.copper.labourHours.toFixed(3)} diff=${tHrs}`);
    check('transition labour cost', near(mix.labourCost, qr.scenarios.copper.labourCost + tHrs * DEFAULT_CONFIG.labourRate),
      `diff=${(mix.labourCost - qr.scenarios.copper.labourCost).toFixed(2)} expected=${(tHrs * DEFAULT_CONFIG.labourRate).toFixed(2)}`);
  }
}

// 5. No PE locations configured — mix = copper
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 8*GRID, y2: METER_POS.y, length: 8, location: 'buried' },
  ];
  const apps = [{ id: 1, typeId: 'storage_hws', mj: 200, x: METER_POS.x + 8*GRID, y: METER_POS.y, label: 'H' }];
  const cfgNoPE = { ...DEFAULT_CONFIG, peLocations: [] };
  const qr = targeted('no-pe-locations', segs, apps, baseQ(2), cfgNoPE);
  if (qr) {
    check('no-pe-locs no PE', !qr.hasPE);
    check('no-pe-locs mix=copper total', near(qr.scenarios.mix.total, qr.scenarios.copper.total));
    check('no-pe-locs saving=0', near(qr.saving, 0));
  }
}

// 6. High-pressure (F9) with buried run — PE uses F22
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 6*GRID, y2: METER_POS.y, length: 10, location: 'buried' },
  ];
  const apps = [{ id: 1, typeId: 'storage_hws', mj: 200, x: METER_POS.x + 6*GRID, y: METER_POS.y, label: 'H' }];
  const qr = targeted('high-pressure-F9', segs, apps, baseQ(6));
  if (qr) {
    check('F9 band correct', qr.band.id === 'F9', qr.band.id);
    check('F9 peBandId=F22', qr.peBandId === 'F22', `peBandId=${qr.peBandId}`);
    check('F9 PE in mix scenario', qr.scenarios.mix.peM > 0, `mix peM=${qr.scenarios.mix.peM}`);
  }
}

// 7. Waste applied: copperMat = raw pipe cost × (1 + wasteP/100)
{
  const segs = [
    { id: 1, x1: METER_POS.x, y1: METER_POS.y, x2: METER_POS.x + 8*GRID, y2: METER_POS.y, length: 10, location: 'internal' },
  ];
  const apps = [{ id: 1, typeId: 'cooktop', mj: 30, x: METER_POS.x + 8*GRID, y: METER_POS.y, label: 'C' }];
  const qr = targeted('copper-waste', segs, apps, { addr:'', pressure:2, newMeter:false, pens:0, dig:0, conc:0, twoS:false });
  if (qr) {
    // All copper, no stubs: copperMat = segLength * rate[DN] * (1 + waste/100)
    const s = qr.sized[0];
    const raw = 10 * (DEFAULT_CONFIG.copperRates[s.size] || 0);
    const withWaste = raw * (1 + DEFAULT_CONFIG.pipeWastePct / 100);
    check('copper waste applied', near(qr.copperMat, withWaste, 0.01), `${qr.copperMat} vs ${withWaste}`);
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
for (let n = 0; n < N; n++) verify(n);

console.log(`\n  Ran ${N} randomised pricing scenarios (first 500 at 25% margin) + targeted edge cases`);
console.log(`  ${fail === 0 ? '🎉' : '⚠️'}  ${pass} assertions passed, ${fail} failed`);
if (fail) {
  console.log(`\n  First ${Math.min(fail, 60)} failures:`);
  failures.forEach(f => console.log('   ✗ ' + f));
}
process.exit(fail === 0 ? 0 : 1);
