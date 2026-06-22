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
