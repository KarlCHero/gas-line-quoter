/**
 * Supabase client — the single connection the app uses for persistence
 * (pricing settings now; saved quotes later).
 *
 * Reads PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY from `.env.local`.
 * The anon/publishable key is safe to ship to the browser — Row-Level Security
 * (RLS) policies on the database are what actually protect the data.
 *
 * DEMO_MODE (PUBLIC_DEMO_MODE=true): swaps the real client for a no-op stub so
 * the app runs entirely on in-memory defaults with no network/database access.
 * Mirrors the pattern in Invetory-Management/src/lib/services/supabase.js.
 */
import { createClient } from '@supabase/supabase-js';
// Dynamic (not static) public env so the app boots cleanly before any keys are
// configured — missing vars are simply undefined instead of a hard import error.
import { env } from '$env/dynamic/public';

const PUBLIC_SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY;
const PUBLIC_DEMO_MODE = env.PUBLIC_DEMO_MODE;

export const DEMO_MODE = PUBLIC_DEMO_MODE === 'true';

// True once real credentials are present. Lets the UI degrade gracefully (work
// on local defaults, show a "not connected" hint) instead of throwing when the
// Supabase project hasn't been wired yet.
export const SUPABASE_READY =
  !DEMO_MODE &&
  !!PUBLIC_SUPABASE_URL &&
  !!PUBLIC_SUPABASE_ANON_KEY &&
  !PUBLIC_SUPABASE_URL.includes('YOUR-PROJECT');

// A chainable, awaitable stub for `supabase.from(table)…` — any builder method
// resolves to `{ data: [], error: null }` without touching the network.
function stubQueryBuilder() {
  const result = { data: [], error: null, count: 0, status: 200, statusText: 'OK' };
  const builder = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve) => resolve(result);
      if (prop === 'data') return result.data;
      if (prop === 'error') return result.error;
      return () => builder;
    },
    apply() {
      return builder;
    }
  });
  return builder;
}

const stubClient = {
  from: () => stubQueryBuilder(),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({
      data: null,
      error: { message: 'Supabase not configured' }
    }),
    signOut: async () => ({ error: null })
  }
};

export const supabase = SUPABASE_READY
  ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
  : stubClient;
