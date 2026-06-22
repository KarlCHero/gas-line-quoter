/**
 * Quote builder — turns a drawn layout + job details + pricing config into a
 * priced quote. Pure function (no framework state) so it's testable and reusable.
 *
 * Margin is a TRUE GROSS MARGIN: total = subtotal / (1 - margin/100).
 */
import { analyse, findSize, selectBand } from './sizing.js';
import { labelOf } from './constants.js';

/**
 * @param {Array} segs  pipe segments [{id,x1,y1,x2,y2,length}]
 * @param {Array} apps  appliances [{id,typeId,x,y,mj,label}]
 * @param {object} q    job details {pressure,newMeter,pens,dig,conc,twoS}
 * @param {object} cfg  pricing config (see DEFAULT_CONFIG)
 * @param {number} margin  gross margin %
 * @returns quote object, or null if nothing to price
 */
export function calcQuote(segs, apps, q, cfg, margin) {
  const totalLen = segs.reduce((s, g) => s + (g.length || 0), 0);
  if (!totalLen || !apps.length) return null;
  const { flows, longest } = analyse(segs, apps);
  const band = selectBand(q.pressure);
  const totalMJ = apps.reduce((s, a) => s + a.mj, 0);
  const sized = segs.map((s) => {
    const flow = flows[s.id] || totalMJ;
    const r = findSize(flow, longest || 1, band);
    return { ...s, flow, size: r.size, oversized: r.oversized, overCapacity: r.overCapacity, capacity: r.capacity };
  });
  const anyOversized = sized.some((s) => s.oversized);
  const anyOverCapacity = sized.some((s) => s.overCapacity);

  // ── LABOUR = loaded rate × time ──
  const rate = cfg.labourRate || 90;
  const extraM = Math.max(0, totalLen - (cfg.baseMetres || 0));
  const labourHours =
    (cfg.baseHours || 0) +
    extraM * ((cfg.perMetreMins || 0) / 60) +
    apps.length * ((cfg.applianceMins || 0) / 60) +
    (q.newMeter ? (cfg.meterHours || 0) : 0);
  const labourCost = labourHours * rate;

  // ── MATERIAL, grouped by type ──
  const wasteFactor = 1 + (cfg.pipeWastePct || 0) / 100;
  const copperMat = sized.reduce((sum, s) => sum + (s.length || 0) * (cfg.copperRates[s.size] || 0), 0) * wasteFactor;
  const applianceMat = apps.reduce((s, a) => s + ((cfg.applianceMaterial && cfg.applianceMaterial[a.typeId]) || 0), 0);
  const meterMat = q.newMeter ? (cfg.meterMaterial || 0) : 0;
  const materialCost = copperMat + applianceMat + meterMat;

  // ── SITE WORKS (flat) ──
  const penCost = (q.pens || 0) * (cfg.penetrationCost || 0);
  const digCost = (q.dig || 0) * (cfg.diggingRate || 0);
  const concCost = (q.conc || 0) * (cfg.concreteCuttingRate || 0);
  const twoCost = q.twoS ? (cfg.twoStoreyFlat || 0) : 0;
  const siteWorks = penCost + digCost + concCost + twoCost;

  const subtotal = labourCost + materialCost + siteWorks;
  const total = subtotal / (1 - Math.min(margin, 99.9) / 100);
  return {
    sized, totalMJ, longest, totalLen, extraM,
    band: { id: band.id, dropKPa: band.dropKPa, supplyRange: band.supplyRange },
    anyOversized, anyOverCapacity,
    rate, labourHours, labourCost,
    copperMat, applianceMat, meterMat, materialCost,
    penCost, digCost, concCost, twoCost, siteWorks,
    subtotal, marginAmt: total - subtotal, total
  };
}

/** Auto-built scope-of-works checklist for the client quote. */
export function buildScope(segs, apps, q, appCounts) {
  const items = [];
  const totalApps = apps.length;
  items.push('Attend site and set up');
  if (q.newMeter) items.push('Connect to existing gas meter');
  items.push(`Run new pipework to ${totalApps} appliance${totalApps !== 1 ? 's' : ''}`);
  const tl = segs.reduce((s, g) => s + (g.length || 0), 0);
  if (tl > 0) items.push(`Approx. ${tl}m total pipe run`);
  const extCount = segs.filter((s) => s.external).length;
  if (extCount > 0) items.push(`${extCount} external run${extCount > 1 ? 's' : ''} — copper (no PEX)`);
  appCounts.forEach((a) => items.push(`${a.count > 1 ? a.count + '× ' : ''}${labelOf(a)} — connect and commission`));
  if (q.pens > 0) items.push(`${q.pens} wall/floor penetration${q.pens > 1 ? 's' : ''}`);
  if (q.dig > 0) items.push(`Trenching and backfill — ${q.dig}m`);
  if (q.conc > 0) items.push(`Concrete cutting — ${q.conc}m`);
  if (q.twoS) items.push('Multi-storey access included');
  items.push('Pressure test to AS/NZS 5601.1');
  items.push('Tidy up job related rubbish');
  items.push('Supply COC within 5 days');
  return items;
}
