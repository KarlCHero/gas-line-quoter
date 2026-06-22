/** Canvas + domain constants, shared by the calc engine and the UI. */

export const GRID = 40;
export const METER_POS = { x: 120, y: 280 };

/** Natural-gas appliance demand ratings (MJ/hr). NG only. */
export const APPLIANCE_TYPES = [
  { id: 'cooktop', label: 'Cooktop', mj: 30 },
  { id: 'freestanding_cooker', label: 'Freestanding Cooker', mj: 50 },
  { id: 'wall_heater', label: 'Wall / Space Heater', mj: 25 },
  { id: 'ducted_heater', label: 'Ducted Heater', mj: 120 },
  { id: 'storage_hws', label: 'Storage HWS', mj: 200 },
  { id: 'instant_hws', label: 'Instantaneous HWS', mj: 200 }
];

/** Per-DN colours for pipe rendering / size badges. */
export const PIPE_COLORS = {
  15: '#059669',
  20: '#2563eb',
  25: '#d97706',
  32: '#dc2626',
  40: '#7c3aed',
  50: '#db2777'
};

/**
 * Pipe-run locations. The location drives material choice in the copper/PE mix:
 * PE (AS/NZS 4130) is only permitted in concealed/accessible non-living spaces
 * (buried, under-house subfloor, in-roof). External and internal (in-wall) runs
 * are copper. The PE-eligible set is configurable (cfg.peLocations); this list is
 * the canonical id/label/default-eligibility source for the UI.
 */
export const PIPE_LOCATIONS = [
  { id: 'internal', label: 'Internal (in wall)', short: 'INT', color: '#FF5815', pe: false },
  { id: 'external', label: 'External', short: 'EXT', color: '#2563eb', pe: false },
  { id: 'under-house', label: 'Under house', short: 'SUB', color: '#0891b2', pe: true },
  { id: 'in-roof', label: 'In roof', short: 'ROOF', color: '#7c3aed', pe: true },
  { id: 'buried', label: 'Buried', short: 'BUR', color: '#16a34a', pe: true }
];

export const DEFAULT_LOCATION = 'internal';
export const PE_LOCATIONS_DEFAULT = PIPE_LOCATIONS.filter((l) => l.pe).map((l) => l.id);
const LOC_BY_ID = Object.fromEntries(PIPE_LOCATIONS.map((l) => [l.id, l]));

/** Safe location descriptor for a segment (handles legacy/missing values). */
export const locOf = (seg) => LOC_BY_ID[seg?.location] || LOC_BY_ID[DEFAULT_LOCATION];

/** Disc colours for appliance markers. */
export const APPLIANCE_ICONS = {
  cooktop: { color: '#EA580C' },
  freestanding_cooker: { color: '#E8472A' },
  wall_heater: { color: '#DC2626' },
  ducted_heater: { color: '#2563EB' },
  storage_hws: { color: '#0891B2' },
  instant_hws: { color: '#059669' }
};

/** Safe appliance label — never crashes on a missing/legacy label. */
export const labelOf = (a) =>
  a.label || (APPLIANCE_TYPES.find((t) => t.id === a.typeId) || {}).label || 'Appliance';

export const snapV = (v) => Math.round(v / GRID) * GRID;
export const fmt = (v) => `$${Number(v).toFixed(2)}`;
