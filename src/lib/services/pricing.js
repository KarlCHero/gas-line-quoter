/**
 * Pricing persistence. When Supabase is configured (and the user is signed in),
 * the config is read from / written to the append-only `pricing_settings` table.
 * Otherwise it falls back to localStorage so the tool is fully usable offline /
 * before the backend exists.
 */
import { supabase, SUPABASE_READY } from './supabase.js';
import { mergeConfig } from '$lib/config/defaults.js';

const LS_KEY = 'chk_gq_cfg';

/**
 * Load the latest pricing config. Always returns a complete config (defaults
 * deep-merged). The returned object includes a `_stale` flag when Supabase is
 * configured but the server read failed (e.g. logged out / expired session), so
 * the UI can warn instead of silently trusting a possibly-stale local copy.
 */
export async function loadPricing() {
  if (SUPABASE_READY) {
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('config')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      // Auth/RLS/network failure — fall back to local but flag it as unverified.
      return Object.assign(mergeConfig(loadLocalRaw()), { _stale: true, _staleReason: error.message });
    }
    if (data && data.length) return mergeConfig(data[0].config);
    // No row yet on the server — first run; local/defaults are fine.
  }
  return mergeConfig(loadLocalRaw());
}

/** Persist a new pricing config version. Returns { ok, error }. */
export async function savePricing(config) {
  if (SUPABASE_READY) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    const { error } = await supabase.from('pricing_settings').insert({ config, updated_by: uid });
    if (error) return { ok: false, error: error.message };
    saveLocal(config); // only cache locally AFTER the server accepted it
    return { ok: true };
  }
  saveLocal(config);
  return { ok: true, local: true };
}

function loadLocalRaw() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function saveLocal(config) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}
