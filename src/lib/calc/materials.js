/**
 * Materials order-guide estimator — turns a sized layout into approximate
 * fitting/pipe quantities for the internal Trades guide. Estimates only.
 */
import { GRID } from './constants.js';

export function calcMaterials(segs, apps, q, qr) {
  if (!qr) return null;
  const sk = (x, y) => `${Math.round(x / GRID) * GRID},${Math.round(y / GRID) * GRID}`;
  const sizeOf = {};
  qr.sized.forEach((s) => { sizeOf[s.id] = s.size; });

  // Endpoint adjacency: node key -> [{segId, vec}] (vectors point away from node).
  const epMap = {};
  segs.forEach((s) => {
    const k1 = sk(s.x1, s.y1), k2 = sk(s.x2, s.y2);
    if (!epMap[k1]) epMap[k1] = [];
    if (!epMap[k2]) epMap[k2] = [];
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
    epMap[k1].push({ segId: s.id, vec: { x: (s.x2 - s.x1) / len, y: (s.y2 - s.y1) / len } });
    epMap[k2].push({ segId: s.id, vec: { x: (s.x1 - s.x2) / len, y: (s.y1 - s.y2) / len } });
  });

  let elbows = 0, tees = 0, couplings = 0, reducers = 0, midRunCouplers = 0;
  Object.values(epMap).forEach((entries) => {
    const n = entries.length;
    if (n === 2) {
      const v1 = entries[0].vec, v2 = entries[1].vec;
      const dot = -(v1.x * v2.x + v1.y * v2.y); // straight-through if ~1
      if (dot > 0.97) { couplings++; } else { elbows += 2; }
      if (sizeOf[entries[0].segId] !== sizeOf[entries[1].segId]) reducers++;
    } else if (n >= 3) {
      tees++;
      const sizes = [...new Set(entries.map((e) => sizeOf[e.segId]))];
      if (sizes.length > 1) reducers += sizes.length - 1;
    }
  });

  // Mid-run couplers — copper comes in ~4m lengths.
  segs.forEach((s) => { if (s.length && s.length > 4) midRunCouplers += Math.floor(s.length / 4); });

  // Appliance stub-in elbows (2 per appliance).
  elbows += apps.length * 2;

  // Supports @ 1.5m centres, by DN size.
  const supportsBySize = {};
  qr.sized.forEach((s) => {
    if (s.length) {
      // Two-storey/vertical runs need tighter support centres (1.0 m vs 1.5 m).
      const centres = q.twoS ? 1.0 : 1.5;
      const count = Math.ceil(s.length / centres);
      supportsBySize[s.size] = (supportsBySize[s.size] || 0) + count;
    }
  });

  // Pipe quantities by size (waste added at display time).
  const pipeBySize = {};
  qr.sized.forEach((s) => { if (s.length) pipeBySize[s.size] = (pipeBySize[s.size] || 0) + s.length; });

  return {
    elbows, tees, couplings, reducers, midRunCouplers, supportsBySize,
    flexHoses: apps.filter((a) => a.typeId === 'cooktop' || a.typeId === 'freestanding_cooker').length,
    isolationValves: apps.length + (q.newMeter ? 1 : 0),
    pipeBySize
  };
}
