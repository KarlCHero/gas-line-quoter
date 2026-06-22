/**
 * Auth store (Svelte 5 runes). Email + password via Supabase.
 *
 * When Supabase isn't configured yet (SUPABASE_READY === false) the app runs in
 * "open" mode: no login required, so the tool is fully usable before the backend
 * exists. Once keys are added, a login gate is enforced.
 */
import { supabase, SUPABASE_READY } from '$lib/services/supabase.js';

let session = $state(null);
let ready = $state(false); // initial session check complete
let sub = null; // onAuthStateChange subscription
let started = false;

export const auth = {
  get session() { return session; },
  get ready() { return ready; },
  get user() { return session?.user ?? null; },
  // Login required only when a real backend is wired up.
  get required() { return SUPABASE_READY; },
  get signedIn() { return !SUPABASE_READY || !!session; },

  async init() {
    if (started) return; // idempotent — avoid duplicate subscriptions
    started = true;
    if (!SUPABASE_READY) { ready = true; return; }
    const { data } = await supabase.auth.getSession();
    session = data.session;
    sub = supabase.auth.onAuthStateChange((_event, s) => { session = s; }).data?.subscription;
    ready = true;
  },

  dispose() {
    sub?.unsubscribe?.();
    sub = null;
    started = false;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    session = data.session;
    return { ok: true };
  },

  async signOut() {
    await supabase.auth.signOut();
    session = null;
  }
};
