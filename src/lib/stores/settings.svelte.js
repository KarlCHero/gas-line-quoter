/**
 * Pricing settings store (Svelte 5 runes). Holds the live config used by the
 * quote engine and edited on the Settings tab. Hydrates from Supabase/local on
 * first load; saves explicitly via save().
 */
import { mergeConfig } from '$lib/config/defaults.js';
import { loadPricing, savePricing } from '$lib/services/pricing.js';

// Deep clone so editing settings can never mutate the module-level defaults.
let cfg = $state(mergeConfig(null));
let loaded = $state(false);
let touched = $state(false); // user edited before hydrate resolved
let saving = $state(false);
let savedAt = $state('');

export const settings = {
  get cfg() {
    return cfg;
  },
  get loaded() {
    return loaded;
  },
  get saving() {
    return saving;
  },
  get savedAt() {
    return savedAt;
  },

  /** Hydrate from backend/local. Safe to call once on mount. */
  async hydrate() {
    const loadedCfg = await loadPricing();
    // Don't clobber edits the user made while the async load was in flight.
    if (!touched) Object.assign(cfg, loadedCfg);
    loaded = true;
  },

  /** Set a dotted-path value, e.g. update('copperRates.20', 26). */
  update(path, val) {
    touched = true;
    const parts = path.split('.');
    let o = cfg;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  },

  /** Persist the current config (new version in Supabase + local copy). */
  async save() {
    saving = true;
    const res = await savePricing($state.snapshot(cfg));
    saving = false;
    if (res.ok) savedAt = new Date().toLocaleTimeString('en-AU');
    return res;
  }
};
