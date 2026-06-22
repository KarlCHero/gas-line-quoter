<script>
  import { auth } from '$lib/stores/auth.svelte.js';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e) {
    e.preventDefault();
    busy = true;
    error = '';
    const res = await auth.signIn(email, password);
    busy = false;
    if (!res.ok) error = res.error || 'Sign-in failed';
  }
</script>

<div class="gate">
  <form class="card" onsubmit={submit}>
    <div class="logo">◆ Check<span>Hero</span></div>
    <div class="title">Gas Line Quoter</div>
    <div class="hint">Staff sign-in</div>

    <label>Email<input type="email" bind:value={email} autocomplete="username" required /></label>
    <label>Password<input type="password" bind:value={password} autocomplete="current-password" required /></label>

    {#if error}<div class="err">{error}</div>{/if}

    <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>
</div>

<style>
  .gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { width: 100%; max-width: 360px; background: #fff; border: 1px solid var(--ch-gray-200); border-radius: 16px; padding: 32px 28px; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.05); }
  .logo { font-size: 22px; font-weight: 800; }
  .logo span { color: var(--ch-orange); }
  .title { font-weight: 700; margin-top: 4px; }
  .hint { font-size: 12px; color: var(--ch-gray-500); margin: 4px 0 20px; }
  label { display: block; font-size: 12px; font-weight: 700; color: var(--ch-gray-600); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 12px; }
  input { width: 100%; margin-top: 5px; border: 1.5px solid var(--ch-gray-300); border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 14px; text-transform: none; letter-spacing: normal; }
  input:focus { outline: none; border-color: var(--ch-orange); box-shadow: 0 0 0 3px rgba(255, 88, 21, 0.1); }
  .err { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 13px; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
  button { width: 100%; background: var(--ch-orange); color: white; border: none; padding: 12px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; margin-top: 4px; }
  button:disabled { opacity: 0.6; }
</style>
