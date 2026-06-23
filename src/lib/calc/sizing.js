/**
 * AS/NZS 5601.1:2013 pipe sizing — Natural Gas, Copper AS1432 Type B.
 * Uses the standard's capacity tables (F6/F7/F8/F9, Appendix F) directly — each
 * table is for a specific design pressure DROP, so there is NO √ scaling.
 *
 * Table selection is by ALLOWABLE pressure drop, not raw supply pressure:
 *   allowable drop = meter supply pressure − minimum appliance inlet pressure.
 * The tool then uses the table with the LARGEST design drop it can afford (the
 * smallest valid pipe). A high supply means more allowable drop, so the same job
 * sizes smaller — exactly how a gasfitter takes credit for spare pressure.
 * If supply barely exceeds the appliance minimum (little/no drop to spend) it
 * falls back to the most conservative table. Cells the standard omits (excessive
 * velocity) are null → that size is skipped.
 */
import { GRID, METER_POS } from './constants.js';
import { COPPER_BANDS, PE_BANDS, RUN_LENGTHS } from './tables.js';

export const CU_SIZES = [15, 20, 25, 32, 40, 50];
export const PE_SIZES = [20, 25, 32, 40, 50, 63, 75, 90, 110, 160];

/** Minimum appliance inlet pressure (kPa) for NG — nominal 1.13 kPa data-plate. */
export const MIN_APPLIANCE_KPA = 1.13;

/** Allowable pressure drop (kPa) = supply − minimum appliance inlet pressure (never < 0). */
export function allowableDropKPa(supplyKPa, minApplianceKPa = MIN_APPLIANCE_KPA) {
  return Math.max(0, supplyKPa - minApplianceKPa);
}

/** Largest-drop band (bands ascending by dropKPa) affordable within `drop`; else the smallest. */
function pickByDrop(bands, drop) {
  let chosen = null;
  for (const b of bands) if (b.dropKPa <= drop) chosen = b;
  return chosen || bands[0];
}

/** Copper band for a supply pressure — chosen by the allowable drop it permits. */
export function selectBand(supplyKPa, minApplianceKPa = MIN_APPLIANCE_KPA) {
  return pickByDrop(COPPER_BANDS, allowableDropKPa(supplyKPa, minApplianceKPa));
}

/**
 * PE (AS/NZS 4130) band for a supply pressure, or null if PE is not usable —
 * the standard omits PE below 1.5 kPa, so any lower supply forces copper.
 */
export function selectPEBand(supplyKPa, minApplianceKPa = MIN_APPLIANCE_KPA) {
  if (supplyKPa < PE_BANDS[0].supplyMin) return null;
  return pickByDrop(PE_BANDS, allowableDropKPa(supplyKPa, minApplianceKPa));
}

/**
 * Capacity (MJ/hr) of a DN at a run length within a band, or null if that size
 * is not recommended at that length (omitted/shaded in the standard).
 */
export function capacityAt(band, dn, runLen) {
  const arr = band.sizes[dn];
  if (!arr) return null;
  const lengths = band.lengths || RUN_LENGTHS;
  const L = Math.max(runLen, 1);
  const lastIdx = lengths.length - 1;
  // At/below the shortest tabulated length.
  if (L <= lengths[0]) return arr[0];
  // Exact column hit — return its cell (null if omitted at that exact length).
  const exact = lengths.indexOf(L);
  if (exact !== -1) return arr[exact];
  // Interpolate only between ADJACENT tabulated columns. If either bracketing
  // cell is omitted (null = excessive-velocity / not recommended), the size is
  // not valid at this length — do NOT interpolate across the gap.
  for (let i = 0; i < lastIdx; i++) {
    if (lengths[i] <= L && L <= lengths[i + 1]) {
      if (arr[i] == null || arr[i + 1] == null) return null;
      const t = (L - lengths[i]) / (lengths[i + 1] - lengths[i]);
      return arr[i] + t * (arr[i + 1] - arr[i]);
    }
  }
  // Beyond the table's longest length: clamp only if this DN is tabulated there.
  return arr[lastIdx] != null ? arr[lastIdx] : null;
}

/**
 * Smallest DN in `band` that carries `flowMJ` over `runLen`. If the smallest
 * adequate size would run above (1 − headroom) of its capacity it's "borderline"
 * and we step up one size (flagged `oversized`). Returns
 * { size, capacity, oversized, overCapacity }.
 */
export function findSize(flowMJ, runLen, band, headroom = 0.05) {
  // DN set comes from the band itself (copper 15-50, PE 20-160) — integer-keyed
  // maps iterate in ascending numeric order, so this is the smallest-first list.
  const SIZES = Object.keys(band.sizes).map(Number);
  let chosen = null, cap = null;
  for (const dn of SIZES) {
    const c = capacityAt(band, dn, runLen);
    if (c == null) continue;
    if (c >= flowMJ) { chosen = dn; cap = c; break; }
  }
  if (chosen == null) {
    // Demand exceeds the largest available size at this run length → use the
    // largest available and flag it (needs design review / higher pressure).
    for (let i = SIZES.length - 1; i >= 0; i--) {
      const c = capacityAt(band, SIZES[i], runLen);
      if (c != null) return { size: SIZES[i], capacity: c, oversized: false, overCapacity: true };
    }
    return { size: SIZES[SIZES.length - 1], capacity: 0, oversized: false, overCapacity: true };
  }
  let oversized = false;
  if (flowMJ > cap * (1 - headroom)) {
    for (const dn of SIZES) {
      if (dn <= chosen) continue;
      const c = capacityAt(band, dn, runLen);
      if (c != null) { chosen = dn; cap = c; oversized = true; break; }
    }
  }
  return { size: chosen, capacity: cap, oversized, overCapacity: false };
}

/**
 * Network analysis: DFS from the meter node to compute downstream demand per
 * segment (`flows`) and the developed length to the most remote appliance
 * (`longest`, used as the table-lookup length for every section).
 */
export function analyse(segs, apps) {
  const sk = (x, y) => `${Math.round(x / GRID) * GRID},${Math.round(y / GRID) * GRID}`;
  const keyXY = (k) => k.split(',').map(Number);

  // Candidate junction nodes: the meter + every segment's grid-snapped endpoints.
  const nodeSet = new Set([sk(METER_POS.x, METER_POS.y)]);
  segs.forEach((s) => { nodeSet.add(sk(s.x1, s.y1)); nodeSet.add(sk(s.x2, s.y2)); });
  const nodes = [...nodeSet].map((k) => { const [x, y] = keyXY(k); return { k, x, y }; });

  // Build adjacency, SPLITTING each segment at any node that lands on its
  // interior (T-junctions where a branch taps the middle of a run). Sub-edges
  // carry the parent segment's id so flow maps back to the drawn segment.
  const adj = {};
  const addN = (k) => { if (!adj[k]) adj[k] = []; };
  segs.forEach((s) => {
    const ax = Math.round(s.x1 / GRID) * GRID, ay = Math.round(s.y1 / GRID) * GRID;
    const bx = Math.round(s.x2 / GRID) * GRID, by = Math.round(s.y2 / GRID) * GRID;
    const dx = bx - ax, dy = by - ay;
    const pxLen = Math.hypot(dx, dy) || 1;
    // Nodes lying on this segment (collinear + within its span).
    const on = [];
    nodes.forEach((n) => {
      const t = ((n.x - ax) * dx + (n.y - ay) * dy) / (pxLen * pxLen);
      if (t < -1e-6 || t > 1 + 1e-6) return;
      const dist = Math.hypot(n.x - (ax + t * dx), n.y - (ay + t * dy));
      if (dist <= GRID * 0.25) on.push({ k: n.k, t: Math.max(0, Math.min(1, t)) });
    });
    const aKey = sk(ax, ay), bKey = sk(bx, by);
    if (!on.some((o) => o.k === aKey)) on.push({ k: aKey, t: 0 });
    if (!on.some((o) => o.k === bKey)) on.push({ k: bKey, t: 1 });
    on.sort((p, q) => p.t - q.t);
    const seq = on.filter((o, i) => i === 0 || o.k !== on[i - 1].k);
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i], b = seq[i + 1];
      if (a.k === b.k) continue;
      const mLen = (s.length || 0) * (Math.abs(b.t - a.t)); // metres apportioned along the run
      addN(a.k); addN(b.k);
      adj[a.k].push({ id: s.id, other: b.k, len: mLen });
      adj[b.k].push({ id: s.id, other: a.k, len: mLen });
    }
  });

  // Assign each appliance to the nearest graph node.
  const allKeys = Object.keys(adj);
  const atNode = {};
  apps.forEach((a) => {
    let bestKey = null, bestDist = Infinity;
    allKeys.forEach((k) => {
      const [nx, ny] = keyXY(k);
      const d = Math.hypot(a.x - nx, a.y - ny);
      if (d < bestDist) { bestDist = d; bestKey = k; }
    });
    if (bestKey) { (atNode[bestKey] ||= []).push(a); }
  });

  // Root the DFS at the graph node nearest the meter (the meter may not sit
  // exactly on a drawn endpoint after grid-snapping).
  let root = null, rootDist = Infinity;
  allKeys.forEach((k) => {
    const [nx, ny] = keyXY(k);
    const d = Math.hypot(METER_POS.x - nx, METER_POS.y - ny);
    if (d < rootDist) { rootDist = d; root = k; }
  });

  const flows = {};
  const visited = new Set();
  let longest = 0;
  function dfs(node, pathLen) {
    visited.add(node);
    const local = (atNode[node] || []).reduce((s, a) => s + a.mj, 0);
    if (local > 0) longest = Math.max(longest, pathLen);
    let total = local;
    for (const e of adj[node] || []) {
      if (visited.has(e.other)) continue;
      const child = dfs(e.other, pathLen + e.len);
      total += child;
      // A segment's flow = the heaviest-loaded part of it (sizes the whole pipe).
      flows[e.id] = Math.max(flows[e.id] || 0, child);
    }
    return total;
  }
  if (root && adj[root]) dfs(root, 0);

  const totalMJ = apps.reduce((s, a) => s + a.mj, 0);
  segs.forEach((s) => { if (flows[s.id] == null) flows[s.id] = totalMJ; });
  if (!longest) longest = segs.reduce((s, g) => s + (g.length || 0), 0);
  return { flows, longest };
}
