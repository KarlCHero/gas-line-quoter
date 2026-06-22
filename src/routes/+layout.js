// Client-only SPA: this is an interactive internal tool whose stores read
// localStorage at module init. Disabling SSR avoids server/client hydration
// mismatches and any cross-request leakage of the module-level singleton stores.
export const ssr = false;
export const prerender = false;
