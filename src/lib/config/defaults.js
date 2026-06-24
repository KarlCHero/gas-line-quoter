/**
 * Default pricing config — used as the seed/fallback when Supabase has no saved
 * settings yet, and as the shape the Settings page edits. All prices ex GST.
 * Margin is a TRUE GROSS MARGIN: price = cost / (1 - margin/100).
 */
// ── PRICING MODEL ────────────────────────────────────────────────────────────
// EVERYTHING below is entered at COST (loaded rate $90/hr for labour, ex-GST
// supplier cost for materials). The margin (default 40%) is applied ONCE at the
// end — 40% reproduces the $90 loaded → $150 charge-out rate (90 / (1-0.40) = 150).
// Labour times (confirmed by Karl): 2 hr base (site setup + first 5 m), 15 min/m
// after, 30 min per appliance connect. Materials from Samios trade prices — see
// pricing/Samios-pricing-buildup.xlsx.
export const DEFAULT_CONFIG = {
  // ── LABOUR — loaded rate × time. Margin (40%) at the end → $90 → $150. ──
  labourRate: 90, // loaded $/hr
  baseHours: 2, // site setup + first `baseMetres` of run
  baseMetres: 5,
  perMetreMins: 15, // each metre beyond the base
  applianceMins: 30, // per appliance gas connection
  meterHours: 0.5, // new meter connection
  transitionMins: 20, // per PE→copper transition (appliance stubs + building entry stubs)

  // ── MATERIAL ($/... ex-GST cost, grouped by type) ──
  // Copper all-in $/m (pipe + clips + run-fitting allowance), Samios.
  // DN15 = 12mm stick (~$7.32/m), confirmed vs Reece 15mm ($8.93/m).
  copperRates: { 15: 9, 20: 14, 25: 21, 32: 31, 40: 38, 50: 57 },
  // PE (AS/NZS 4130 SDR 11) all-in $/m for the copper/PE mix — pipe + fittings +
  // tracer/marking allowance. DN are PE OD sizes. 20-32 from Samios PE; 40+ are
  // [est — tune] (rarely needed on residential gas). PE is sized off F20-F22.
  peRates: { 20: 6, 25: 9, 32: 13, 40: 19, 50: 28, 63: 42, 75: 60, 90: 84, 110: 120, 160: 240 },
  // Locations where PE is permitted. Only EXTERNAL is copper-forced (PE can't be
  // UV-exposed); everything else is PE-eligible. PE is only actually used where
  // the quote comes out cheaper than copper (recommend-cheaper) — short runs
  // still fall back to copper. Editable so policy can change per install style.
  peLocations: ['internal', 'buried', 'under-house', 'in-roof'],
  // Copper stub length (m) forced at each appliance connection and at every
  // outside→inside building entry (PE can't be exposed at the transition).
  copperStubM: 1,
  // Gas-side connection material per appliance (isolation valve + flex/bayonet + fittings). Ex-GST.
  applianceMaterial: {
    cooktop: 37,
    freestanding_cooker: 58,
    wall_heater: 25,
    ducted_heater: 45,
    storage_hws: 65,    // valve + flexi + adaptors; Rheem/Rinnai gas-side kit ~$55–90
    instant_hws: 70,    // higher-flow fittings; slightly more than storage
    bbq: 75,            // bayonet fitting + isolation valve + weatherhead
    hydronic: 90,       // isolation valve + flexi + boiler adaptors
  },
  // Meter connection material (adaptor + copper tail + isolation valve).
  meterMaterial: 58,
  pipeWastePct: 10, // applied to copper material + the trades order guide

  // ── SITE WORKS — flat cost each [estimates, tune] ──
  penetrationCost: 27,
  diggingRate: 50, // $/m
  concreteCuttingRate: 70, // $/m
  twoStoreyFlat: 90,
  cocCost: 120, // compliance certificate (COC) — mandatory every job

  // ── SIZING — design basis for AS/NZS 5601 pipe sizing ──
  // Allowable pressure drop = supply pressure − this. NG appliances are rated at
  // a 1.13 kPa nominal inlet; the tool sizes to the largest design-drop table the
  // available pressure can afford. Lower this only if you size to a tighter
  // appliance minimum (more aggressive — smaller pipe).
  minAppliancePressure: 1.13, // kPa min appliance inlet

  margin: 40, // loaded → charge-out; applied to everything at the end
  companyName: 'CheckHero',
  companyPhone: '(03) 9000 0423',
  companyEmail: 'Repairs@checkhero.com.au',
  acceptUrl: '',
  systemUrl: ''
};

/**
 * Returns a fresh config = deep clone of DEFAULT_CONFIG with `saved` merged in.
 * Always deep-clones (never shares nested objects with DEFAULT_CONFIG, so editing
 * settings can't mutate the module-level defaults) and fills any missing keys
 * (incl. nested rate maps) from defaults so a partial/old saved config can't
 * leave undefined rates that silently fall back to magic numbers.
 */
export function mergeConfig(saved) {
  const base = structuredClone(DEFAULT_CONFIG);
  if (!saved || typeof saved !== 'object') return base;
  for (const [k, v] of Object.entries(saved)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      Object.assign(base[k], v); // merge nested maps onto the cloned defaults
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}
