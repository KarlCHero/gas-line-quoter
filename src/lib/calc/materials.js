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

  // Pipe + supports, split by MATERIAL (copper & PE DN sets overlap, so they
  // must not be merged) then by size. Supports @ 1.5 m centres (1.0 m vertical).
  const mt = (s) => (s.material === 'pe' ? 'pe' : 'copper');
  const pipeByMat = { copper: {}, pe: {} };
  const supportsByMat = { copper: {}, pe: {} };
  qr.sized.forEach((s) => {
    if (!s.length) return;
    const m = mt(s);
    pipeByMat[m][s.size] = (pipeByMat[m][s.size] || 0) + s.length;
    const centres = q.twoS ? 1.0 : 1.5;
    supportsByMat[m][s.size] = (supportsByMat[m][s.size] || 0) + Math.ceil(s.length / centres);
  });

  return {
    elbows, tees, couplings, reducers, midRunCouplers, supportsByMat,
    flexHoses: apps.filter((a) => a.typeId === 'cooktop' || a.typeId === 'freestanding_cooker').length,
    isolationValves: apps.length + (q.newMeter ? 1 : 0),
    pipeByMat,
    stubMetres: qr.stubs ? qr.stubs.metres : 0,
    transitions: qr.stubs ? qr.stubs.count : 0
  };
}
