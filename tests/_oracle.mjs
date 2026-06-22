/**
 * Independent sizing oracle for the test suite. Re-implements the AS/NZS 5601
 * band-table selection, capacity interpolation, and borderline-oversize logic
 * SEPARATELY from src/lib/calc/sizing.js (it only shares the standard's table
 * DATA, which is verified cell-for-cell against the PDF). A logic divergence in
 * the engine therefore shows up as a test failure.
 */
import { COPPER_BANDS, PE_BANDS, RUN_LENGTHS, PE_LENGTHS } from '../src/lib/calc/tables.js';
import { CU_SIZES, PE_SIZES } from '../src/lib/calc/sizing.js';

const byId = (id) => COPPER_BANDS.find((b) => b.id === id);
const byIdPE = (id) => PE_BANDS.find((b) => b.id === id);

/** Copper band selection (independent of selectBand): lower band wins in gaps. */
export function oBand(P) {
  if (P < 1.5) return byId('F6');
  if (P < 2.75) return byId('F7');
  if (P < 5) return byId('F8');
  return byId('F9');
}

/** PE band selection — null below 1.5 kPa (standard omits PE there → use copper). */
export function oPEBand(P) {
  if (P < 1.5) return null;
  if (P < 2.75) return byIdPE('F20');
  if (P < 5) return byIdPE('F21');
  return byIdPE('F22');
}

/**
 * Capacity (MJ/hr) of DN at run length in band, or null if not recommended.
 * Independent re-implementation: walks columns by index and refuses to bridge an
 * omitted cell (a null between two tabulated columns means the size is not valid
 * at that length per the standard). `lengths` is the band's run-length grid.
 */
export function oCapacity(band, dn, runLen, lengths = RUN_LENGTHS) {
  const arr = band.sizes[dn];
  if (!arr) return null;
  const L = Math.max(runLen, 1);
  const last = lengths.length - 1;
  if (L <= lengths[0]) return arr[0];
  if (L >= lengths[last]) return arr[last]; // null if not tabulated at max length
  const exact = lengths.indexOf(L);
  if (exact !== -1) return arr[exact];
  // locate the column pair straddling L
  let i = 0;
  while (i < last && lengths[i + 1] < L) i++;
  const loLen = lengths[i], hiLen = lengths[i + 1];
  const lo = arr[i], hi = arr[i + 1];
  if (lo == null || hi == null) return null; // gap — not recommended
  return lo + ((L - loLen) / (hiLen - loLen)) * (hi - lo);
}

/** Generic size decision over an arbitrary DN list / band / lengths grid. */
function oSizeIn(flow, runLen, band, sizes, lengths, headroom) {
  let base = null, baseCap = null;
  for (const dn of sizes) {
    const c = oCapacity(band, dn, runLen, lengths);
    if (c == null) continue;
    if (c >= flow) { base = dn; baseCap = c; break; }
  }
  if (base == null) {
    for (let i = sizes.length - 1; i >= 0; i--) {
      if (oCapacity(band, sizes[i], runLen, lengths) != null) return { size: sizes[i], oversized: false, overCapacity: true };
    }
    return { size: sizes[sizes.length - 1], oversized: false, overCapacity: true };
  }
  if (flow > baseCap * (1 - headroom)) {
    for (const dn of sizes) {
      if (dn <= base) continue;
      if (oCapacity(band, dn, runLen, lengths) != null) return { size: dn, oversized: true, overCapacity: false };
    }
  }
  return { size: base, oversized: false, overCapacity: false };
}

/** Full copper size decision incl. borderline step-up. {size, oversized, overCapacity}. */
export function oSize(flow, runLen, P, headroom = 0.1) {
  return oSizeIn(flow, runLen, oBand(P), CU_SIZES, RUN_LENGTHS, headroom);
}

/** Full PE size decision, or null if PE is not usable at this supply pressure. */
export function oPESize(flow, runLen, P, headroom = 0.1) {
  const band = oPEBand(P);
  if (!band) return null;
  return oSizeIn(flow, runLen, band, PE_SIZES, PE_LENGTHS, headroom);
}
