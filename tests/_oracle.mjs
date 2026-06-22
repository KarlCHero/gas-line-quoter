/**
 * Independent sizing oracle for the test suite. Re-implements the AS/NZS 5601
 * band-table selection, capacity interpolation, and borderline-oversize logic
 * SEPARATELY from src/lib/calc/sizing.js (it only shares the standard's table
 * DATA, which is verified cell-for-cell against the PDF). A logic divergence in
 * the engine therefore shows up as a test failure.
 */
import { COPPER_BANDS, RUN_LENGTHS } from '../src/lib/calc/tables.js';
import { CU_SIZES } from '../src/lib/calc/sizing.js';

const byId = (id) => COPPER_BANDS.find((b) => b.id === id);

/** Band selection (independent of selectBand): lower band wins in gaps. */
export function oBand(P) {
  if (P < 1.5) return byId('F6');
  if (P < 2.75) return byId('F7');
  if (P < 5) return byId('F8');
  return byId('F9');
}

/**
 * Capacity (MJ/hr) of DN at run length in band, or null if not recommended.
 * Independent re-implementation: walks columns by index and refuses to bridge an
 * omitted cell (a null between two tabulated columns means the size is not valid
 * at that length per the standard).
 */
export function oCapacity(band, dn, runLen) {
  const arr = band.sizes[dn];
  if (!arr) return null;
  const L = Math.max(runLen, 1);
  const last = RUN_LENGTHS.length - 1;
  if (L <= RUN_LENGTHS[0]) return arr[0];
  if (L >= RUN_LENGTHS[last]) return arr[last]; // null if not tabulated at max length
  const exact = RUN_LENGTHS.indexOf(L);
  if (exact !== -1) return arr[exact];
  // locate the column pair straddling L
  let i = 0;
  while (i < last && RUN_LENGTHS[i + 1] < L) i++;
  const loLen = RUN_LENGTHS[i], hiLen = RUN_LENGTHS[i + 1];
  const lo = arr[i], hi = arr[i + 1];
  if (lo == null || hi == null) return null; // gap — not recommended
  return lo + ((L - loLen) / (hiLen - loLen)) * (hi - lo);
}

/** Full size decision incl. borderline step-up. Returns {size, oversized, overCapacity}. */
export function oSize(flow, runLen, P, headroom = 0.1) {
  const band = oBand(P);
  let base = null, baseCap = null;
  for (const dn of CU_SIZES) {
    const c = oCapacity(band, dn, runLen);
    if (c == null) continue;
    if (c >= flow) { base = dn; baseCap = c; break; }
  }
  if (base == null) {
    for (let i = CU_SIZES.length - 1; i >= 0; i--) {
      if (oCapacity(band, CU_SIZES[i], runLen) != null) return { size: CU_SIZES[i], oversized: false, overCapacity: true };
    }
    return { size: CU_SIZES[CU_SIZES.length - 1], oversized: false, overCapacity: true };
  }
  if (flow > baseCap * (1 - headroom)) {
    for (const dn of CU_SIZES) {
      if (dn <= base) continue;
      if (oCapacity(band, dn, runLen) != null) return { size: dn, oversized: true, overCapacity: false };
    }
  }
  return { size: base, oversized: false, overCapacity: false };
}
