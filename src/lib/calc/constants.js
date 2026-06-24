/** Canvas + domain constants, shared by the calc engine and the UI. */

export const GRID = 40;
export const METER_POS = { x: 120, y: 280 };

/** Natural-gas appliance demand ratings (MJ/hr). NG only. */
// MJ/hr = appliance nameplate max gas input (AS/NZS 5601.1 pipe-sizing basis).
// Sources: Rheem/Rinnai AU datasheets, Westinghouse/F&P specs, ATCO TN09 examples.
export const APPLIANCE_TYPES = [
  { id: 'cooktop',            label: 'Cooktop (4-burner)',          mj: 40  }, // Jemena NOR 40 MJ/apt; AS/NZS 5601.1 F-fig example 50 (cooker); 40 standard allowance
  { id: 'freestanding_cooker',label: 'Freestanding Cooker',         mj: 55  }, // AS/NZS 5601.1 Appx F uses 50 MJ/hr; 2022 draft uses 60; 55 splits the difference
  { id: 'wall_heater',        label: 'Wall / Space Heater',         mj: 25  }, // Braemar WF25N = 25, PWF30N = 28; 25 covers typical living-area wall furnace
  { id: 'ducted_heater',      label: 'Ducted Heater',               mj: 120 }, // Braemar max = 122; AS/NZS 5601.1 example = 95; avg Brivis = 106; 120 covers largest residential
  { id: 'storage_hws',        label: 'Storage HWS',                 mj: 45  }, // Rheem 4-star = 27, Stellar = 42; 45 gives headroom
  { id: 'instant_hws',        label: 'Instantaneous HWS',           mj: 200 }, // Rinnai B26 = 199; 200 correct
  { id: 'bbq',                label: 'BBQ / Outdoor Bayonet',       mj: 68  }, // Beefeater 4-burner = 68; covers typical domestic BBQ
  { id: 'hydronic',           label: 'Hydronic Boiler',             mj: 140 }, // Bosch 8300iW 35P = 138, Baxi 1.330 = 122; 140 covers 35 kW systems
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
 * Pipe-run locations — three, by what actually changes the quote:
 *   • interior — concealed/in-building; PE-eligible, no digging.
 *   • exterior — exposed; copper only (UV would degrade PE), no digging.
 *   • buried   — underground; PE-eligible AND auto-adds to the digging cost.
 * PE is only actually used where it prices cheaper than copper. The PE-eligible
 * set is configurable (cfg.peLocations); this list is the canonical
 * id/label/default-eligibility source for the UI.
 */
export const PIPE_LOCATIONS = [
  { id: 'internal', label: 'Interior', short: 'INT', color: '#FF5815', pe: true },
  { id: 'external', label: 'Exterior', short: 'EXT', color: '#2563eb', pe: false },
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
  instant_hws: { color: '#059669' },
  bbq: { color: '#D97706' },
  hydronic: { color: '#7C3AED' }
};

/** Safe appliance label — never crashes on a missing/legacy label. */
export const labelOf = (a) =>
  a.label || (APPLIANCE_TYPES.find((t) => t.id === a.typeId) || {}).label || 'Appliance';

export const snapV = (v) => Math.round(v / GRID) * GRID;
export const fmt = (v) => `$${Number(v).toFixed(2)}`;
