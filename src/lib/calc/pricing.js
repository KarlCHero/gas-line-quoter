/**
 * Quote builder — turns a drawn layout + job details + pricing config into a
 * priced quote. Pure function (no framework state) so it's testable and reusable.
 *
 * Margin is a TRUE GROSS MARGIN: total = subtotal / (1 - margin/100).
 *
 * COPPER / PE MIX
 * ----------------
 * Each segment carries a `location`. PE (AS/NZS 4130, tables F20-F22) is only
 * permitted in the configured locations (cfg.peLocations — concealed/non-living:
 * buried, under-house, in-roof); external and internal runs are copper. PE is
 * also unavailable below 1.5 kPa supply (the standard omits it), in which case
 * the whole job falls back to copper.
 *
 * Three scenarios are priced from one analysis:
 *   • copper — every segment copper (conservative baseline)
 *   • mix    — PE wherever the segment's location allows; copper elsewhere
 *              (the recommended quote — primary top-level fields)
 *   • maxPE  — PE everywhere except external (best-case "if fully PE-routed")
 *
 * In any PE area, copper STUBS are forced: cop.copperStubM metres of copper at
 * every appliance connection and at every outside→inside building entry (a node
 * where an external segment meets an inside segment). These add copper + reduce
 * nothing (the ~1 m transition is small); sized at the run's copper DN.
 *
 * NOTE (sizing rigour): each segment is sized independently in its own material
 * over the network's developed length (same conservative convention the copper
 * engine already uses). A single path mixing copper + short PE/stub portions is
 * not sized by the longhand pressure-drop summation method — fine for a quote;
 * the gasfitter performs the final AS/NZS 5601 COC sizing.
 */
import { analyse, findSize, selectBand, selectPEBand, allowableDropKPa } from './sizing.js';
import { labelOf, locOf, GRID } from './constants.js';

/** Geometry the mix costing needs: appliance→branch segment, and entry nodes. */
function mixGeometry(segs, apps) {
  const snap = (v) => Math.round(v / GRID) * GRID;
  const nk = (x, y) => `${snap(x)},${snap(y)}`;
  const incident = {};
  for (const s of segs) {
    for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      (incident[nk(x, y)] ||= []).push(s);
    }
  }
  // Building entries: a node where an external segment meets ≥1 inside segment.
  const entries = [];
  for (const list of Object.values(incident)) {
    if (!list.some((s) => locOf(s).id === 'external')) continue;
    const inside = list.filter((s) => locOf(s).id !== 'external');
    if (inside.length) entries.push({ segIds: inside.map((s) => s.id) });
  }
  // Each appliance's branch = the segment with the nearest endpoint.
  const branch = [];
  for (const a of apps) {
    let best = GRID * 1.5, segId = null;
    for (const s of segs) {
      for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        const d = Math.hypot(a.x - x, a.y - y);
        if (d <= best) { best = d; segId = s.id; }
      }
    }
    if (segId != null) branch.push({ appId: a.id, segId });
  }
  return { entries, branch };
}

/** Material a segment uses in a given scenario. */
function segMaterial(seg, mode, peLocations, peBand) {
  if (mode === 'copper' || !peBand) return 'copper';
  if (mode === 'maxPE') return locOf(seg).id === 'external' ? 'copper' : 'pe';
  return peLocations.includes(locOf(seg).id) ? 'pe' : 'copper'; // mix
}

/**
 * @param {Array} segs  pipe segments [{id,x1,y1,x2,y2,length,location}]
 * @param {Array} apps  appliances [{id,typeId,x,y,mj,label}]
 * @param {object} q    job details {pressure,newMeter,pens,dig,conc,twoS}
 * @param {object} cfg  pricing config (see DEFAULT_CONFIG)
 * @param {number} margin  gross margin %
 * @returns quote object, or null if nothing to price
 */
export function calcQuote(segs, apps, q, cfg, margin) {
  const totalLen = segs.reduce((s, g) => s + (g.length || 0), 0);
  if (!totalLen || !apps.length) return null;
  const autoDig = segs.filter((s) => locOf(s).id === 'buried').reduce((sum, s) => sum + (s.length || 0), 0);
  const { flows, longest } = analyse(segs, apps);
  const L = longest || 1;
  const minApp = cfg.minAppliancePressure;
  const allowDrop = allowableDropKPa(q.pressure, minApp);
  const band = selectBand(q.pressure, minApp);
  const peBand = selectPEBand(q.pressure, minApp);
  const peLocations = cfg.peLocations || [];
  const totalMJ = apps.reduce((s, a) => s + a.mj, 0);
  const flowOf = (s) => flows[s.id] || totalMJ;
  const { entries, branch } = mixGeometry(segs, apps);
  const stubM = cfg.copperStubM || 0;
  const waste = 1 + (cfg.pipeWastePct || 0) / 100;

  // ── Shared (scenario-independent) costs ──
  const rate = cfg.labourRate || 90;
  const extraM = Math.max(0, totalLen - (cfg.baseMetres || 0));
  const baseLabourHours =
    (cfg.baseHours || 0) +
    extraM * ((cfg.perMetreMins || 0) / 60) +
    apps.length * ((cfg.applianceMins || 0) / 60) +
    (q.newMeter ? (cfg.meterHours || 0) : 0);
  const applianceMat = apps.reduce((s, a) => s + ((cfg.applianceMaterial && cfg.applianceMaterial[a.typeId]) || 0), 0);
  const meterMat = q.newMeter ? (cfg.meterMaterial || 0) : 0;
  const cocCost = cfg.cocCost || 0;
  const siteWorks =
    (q.pens || 0) * (cfg.penetrationCost || 0) +
    (autoDig + (q.dig || 0)) * (cfg.diggingRate || 0) +
    (q.conc || 0) * (cfg.concreteCuttingRate || 0) +
    (q.twoS ? (cfg.twoStoreyFlat || 0) : 0) +
    cocCost;

  // Copper DN per segment (used to size copper stubs in any scenario).
  const copperSizeById = {};
  for (const s of segs) copperSizeById[s.id] = findSize(flowOf(s), L, band).size;

  /** Price one scenario. `copperSizes` maps segId→copper DN for stub pricing. */
  function priceScenario(mode) {
    const sized = segs.map((s) => {
      const flow = flowOf(s);
      const usePE = segMaterial(s, mode, peLocations, peBand) === 'pe';
      const r = findSize(flow, L, usePE ? peBand : band);
      return { ...s, flow, material: usePE ? 'pe' : 'copper', size: r.size, oversized: r.oversized, overCapacity: r.overCapacity, capacity: r.capacity };
    });
    const matById = Object.fromEntries(sized.map((s) => [s.id, s.material]));
    const flowById = Object.fromEntries(sized.map((s) => [s.id, s.flow]));

    let copperM = 0, peM = 0, copperPipe = 0, pePipe = 0;
    for (const s of sized) {
      const len = s.length || 0;
      if (s.material === 'pe') { peM += len; pePipe += len * (cfg.peRates[s.size] || 0); }
      else { copperM += len; copperPipe += len * (cfg.copperRates[s.size] || 0); }
    }

    // Copper stubs, only where the adjoining bulk pipe is PE in this scenario.
    let stubCount = 0, stubMetres = 0, stubPipe = 0;
    const addStub = (segId) => {
      stubCount++; stubMetres += stubM;
      stubPipe += stubM * (cfg.copperRates[copperSizeById[segId]] || 0);
    };
    for (const b of branch) if (matById[b.segId] === 'pe') addStub(b.segId);
    for (const e of entries) {
      const pe = e.segIds.filter((id) => matById[id] === 'pe');
      if (!pe.length) continue;
      addStub(pe.reduce((best, id) => (flowById[id] > flowById[best] ? id : best), pe[0]));
    }
    copperM += stubMetres;

    const transitionHours = stubCount * ((cfg.transitionMins || 0) / 60);
    const labourHours = baseLabourHours + transitionHours;
    const labourCost = labourHours * rate;
    const copperMat = (copperPipe + stubPipe) * waste;
    const peMat = pePipe * waste;
    const materialCost = copperMat + peMat + applianceMat + meterMat;
    const subtotal = labourCost + materialCost + siteWorks;
    const total = subtotal / (1 - Math.min(margin, 99.9) / 100);
    return {
      sized,
      labourHours, labourCost,
      copperM, peM, copperMat, peMat, materialCost,
      stubs: { count: stubCount, metres: stubMetres, cost: stubPipe * waste },
      subtotal, marginAmt: total - subtotal, total,
      anyOversized: sized.some((s) => s.oversized),
      anyOverCapacity: sized.some((s) => s.overCapacity)
    };
  }

  const copper = priceScenario('copper');
  const mix = priceScenario('mix');
  const maxPE = priceScenario('maxPE');

  // Recommend whichever is genuinely cheaper. On short PE-eligible runs the
  // copper stub + transition labour outweigh the PE pipe saving, so all-copper
  // wins — recommend that rather than a "mix" that quietly costs more. Ties (incl.
  // no PE-eligible segments) go to copper, the simpler install. `saving` is the
  // recommended option's advantage over the other, so it's never negative.
  const recMix = mix.total < copper.total;
  const rec = recMix ? mix : copper;

  return {
    // analysis
    totalMJ, longest, totalLen, extraM,
    band: { id: band.id, dropKPa: band.dropKPa, supplyRange: band.supplyRange },
    peBandId: peBand ? peBand.id : null,
    allowDrop, minApp,
    // labour / site (recommended scenario's base + transitions)
    rate, labourHours: rec.labourHours, labourCost: rec.labourCost, applianceMat, meterMat,
    autoDig,
    penCost: (q.pens || 0) * (cfg.penetrationCost || 0),
    digCost: (autoDig + (q.dig || 0)) * (cfg.diggingRate || 0),
    concCost: (q.conc || 0) * (cfg.concreteCuttingRate || 0),
    twoCost: q.twoS ? (cfg.twoStoreyFlat || 0) : 0,
    cocCost,
    siteWorks,
    // PRIMARY = the recommended (cheaper) scenario
    sized: rec.sized,
    copperMat: rec.copperMat, peMat: rec.peMat, materialCost: rec.materialCost,
    stubs: rec.stubs,
    anyOversized: rec.anyOversized, anyOverCapacity: rec.anyOverCapacity,
    subtotal: rec.subtotal, marginAmt: rec.marginAmt, total: rec.total,
    // comparison
    scenarios: { copper, mix, maxPE },
    recommended: recMix ? 'mix' : 'copper',
    saving: Math.abs(copper.total - mix.total),
    hasPE: rec.peM > 0
  };
}

/** Auto-built scope-of-works checklist for the client quote. */
export function buildScope(segs, apps, q, appCounts, cfg = {}) {
  const items = [];
  const totalApps = apps.length;
  const peLocations = cfg.peLocations || [];
  items.push('Attend site and set up');
  if (q.newMeter) items.push('Connect to existing gas meter');
  items.push(`Run new pipework to ${totalApps} appliance${totalApps !== 1 ? 's' : ''}`);
  const tl = segs.reduce((s, g) => s + (g.length || 0), 0);
  if (tl > 0) items.push(`Approx. ${tl}m total pipe run`);
  const extCount = segs.filter((s) => locOf(s).id === 'external').length;
  if (extCount > 0) items.push(`${extCount} external run${extCount > 1 ? 's' : ''} — copper`);
  const peCount = segs.filter((s) => peLocations.includes(locOf(s).id)).length;
  if (peCount > 0) items.push(`${peCount} concealed run${peCount > 1 ? 's' : ''} — PE (AS/NZS 4130), copper stubs at connections`);
  appCounts.forEach((a) => items.push(`${a.count > 1 ? a.count + '× ' : ''}${labelOf(a)} — connect and commission`));
  if (q.pens > 0) items.push(`${q.pens} wall/floor penetration${q.pens > 1 ? 's' : ''}`);
  const scopeDig = segs.filter((s) => locOf(s).id === 'buried').reduce((sum, s) => sum + (s.length || 0), 0) + (q.dig || 0);
  if (scopeDig > 0) items.push(`Trenching and backfill — ${scopeDig}m`);
  if (q.conc > 0) items.push(`Concrete cutting — ${q.conc}m`);
  if (q.twoS) items.push('Multi-storey access included');
  items.push('Pressure test to AS/NZS 5601.1');
  items.push('Tidy up job related rubbish');
  items.push('Supply COC within 5 days');
  return items;
}
