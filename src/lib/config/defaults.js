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

  // ── MATERIAL ($/... ex-GST cost, grouped by type) ──
  // Copper all-in $/m (pipe + clips + run-fitting allowance), Samios.
  // DN15 = 12mm stick (~$7.32/m), confirmed vs Reece 15mm ($8.93/m).
  copperRates: { 15: 9, 20: 14, 25: 21, 32: 31, 40: 38, 50: 57 },
  // PEX/multilayer all-in $/m — PLACEHOLDER for the upcoming copper/PEX mix
  // feature (Stesso/Auspex ~$3/m pipe + clips + fittings). Tune when it lands.
  pexRates: { 20: 6, 25: 9, 32: 13 },
  // Gas-side connection material per appliance (isolation valve + flex/bayonet).
  applianceMaterial: {
    cooktop: 37,
    freestanding_cooker: 58,
    wall_heater: 25,
    ducted_heater: 30,
    storage_hws: 23,
    instant_hws: 25
  },
  // Meter connection material (adaptor + copper tail + isolation valve).
  meterMaterial: 58,
  pipeWastePct: 10, // applied to copper material + the trades order guide

  // ── SITE WORKS — flat cost each [estimates, tune] ──
  penetrationCost: 27,
  diggingRate: 50, // $/m
  concreteCuttingRate: 70, // $/m
  twoStoreyFlat: 90,

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
