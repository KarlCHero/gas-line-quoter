<script>
  import { onMount } from 'svelte';
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { auth } from '$lib/stores/auth.svelte.js';
  import DrawStep from '$lib/components/DrawStep.svelte';
  import JobDetails from '$lib/components/JobDetails.svelte';
  import QuoteView from '$lib/components/QuoteView.svelte';
  import ClientQuote from '$lib/components/ClientQuote.svelte';
  import TradesGuide from '$lib/components/TradesGuide.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import Login from '$lib/components/Login.svelte';

  let tab = $state('main'); // main | client | trades | settings

  const tabs = [
    { id: 'main', icon: '🏠', label: 'Quote Tool' },
    { id: 'client', icon: '📄', label: 'Client Quote' },
    { id: 'trades', icon: '📋', label: 'Trades' },
    { id: 'settings', icon: '⚙️', label: 'Settings' }
  ];
  const steps = [
    { id: 'draw', label: 'Draw Layout' },
    { id: 'questionnaire', label: 'Job Details' },
    { id: 'quote', label: 'View Quote' }
  ];

  onMount(() => {
    auth.init();
    settings.hydrate();
  });

  // Re-load pricing once a user signs in (initial hydrate may have run while
  // logged out and been blocked by RLS).
  let lastUser = $state(null);
  $effect(() => {
    const u = auth.user?.id ?? null;
    if (u && u !== lastUser) settings.hydrate();
    lastUser = u;
  });
</script>

{#if auth.ready && auth.required && !auth.signedIn}
  <Login />
{:else}
  <header class="topbar">
    <div class="brand">
      <span class="logo">◆</span>
      <div><div class="name">Check<span>Hero</span></div><div class="bsub">Gas Line Quoter</div></div>
    </div>
    <nav>
      {#each tabs as t}
        <button class:active={tab === t.id} onclick={() => (tab = t.id)}><span class="ti">{t.icon}</span> {t.label}</button>
      {/each}
    </nav>
    {#if auth.required && auth.signedIn}
      <button class="signout" onclick={() => auth.signOut()}>Sign out</button>
    {/if}
  </header>

  {#if tab === 'main'}
    <div class="stepper">
      {#each steps as s, i}
        <button class="step" class:active={Q.step === s.id} onclick={() => Q.setStep(s.id)}>
          <span class="num">{i + 1}</span>{s.label}
        </button>
        {#if i < steps.length - 1}<span class="arrow">›</span>{/if}
      {/each}
    </div>
  {/if}

  <svelte:boundary>
    {#if tab === 'main'}
      {#if Q.step === 'draw'}<DrawStep />
      {:else if Q.step === 'questionnaire'}<JobDetails />
      {:else}<QuoteView onClient={() => (tab = 'client')} />{/if}
    {:else if tab === 'client'}
      <ClientQuote onBack={() => (tab = 'main')} />
    {:else if tab === 'trades'}
      <TradesGuide onBack={() => (tab = 'main')} />
    {:else}
      <Settings />
    {/if}

    {#snippet failed(error, reset)}
      <div class="crash" role="alert">
        <div class="emoji">⚠️</div>
        <div class="ctitle">Something went wrong</div>
        <p>The app hit an unexpected error. Your saved layout is kept — try again, or start fresh.</p>
        <div class="crow">
          <button class="primary" onclick={reset}>Try again</button>
          <button class="ghost" onclick={() => { try { Object.keys(localStorage).filter((k) => /^chk_gq/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) {} location.reload(); }}>Start fresh</button>
        </div>
      </div>
    {/snippet}
  </svelte:boundary>

  {#if Q.toast}<div class="toast" role="status" aria-live="polite">{Q.toast}</div>{/if}
{/if}

<style>
  .topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: #fff; border-bottom: 1px solid var(--ch-gray-200); }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { color: var(--ch-orange); font-size: 22px; }
  .name { font-weight: 800; font-size: 17px; }
  .name span { color: var(--ch-orange); }
  .bsub { font-size: 11px; color: var(--ch-gray-500); }
  nav { display: flex; gap: 2px; background: var(--ch-gray-100); padding: 4px; border-radius: 10px; }
  nav button { border: none; background: transparent; padding: 7px 14px; border-radius: 8px; font: inherit; font-weight: 700; font-size: 12px; color: var(--ch-gray-500); cursor: pointer; }
  nav button.active { background: #fff; color: var(--ch-orange); box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1); }
  .ti { font-size: 12px; }
  .signout { margin-left: 12px; border: 1.5px solid var(--ch-gray-300); background: transparent; color: var(--ch-gray-600); padding: 6px 12px; border-radius: 8px; font: inherit; font-weight: 600; font-size: 12px; cursor: pointer; }
  .signout:hover { border-color: var(--ch-orange); color: var(--ch-orange); }
  .stepper { display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-bottom: 1px solid var(--ch-gray-200); background: var(--ch-cream); }
  .step { display: flex; align-items: center; gap: 8px; border: none; background: transparent; font: inherit; font-weight: 700; font-size: 13px; color: var(--ch-gray-400); cursor: pointer; padding: 6px 12px; border-radius: 20px; }
  .step.active { background: var(--ch-orange); color: white; }
  .num { width: 20px; height: 20px; border-radius: 50%; background: var(--ch-gray-200); color: var(--ch-gray-500); display: flex; align-items: center; justify-content: center; font-size: 11px; }
  .step.active .num { background: rgba(255, 255, 255, 0.3); color: white; }
  .arrow { color: var(--ch-gray-300); }
  .toast { position: fixed; top: 20px; right: 20px; z-index: 9999; background: var(--ch-charcoal); color: white; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25); pointer-events: none; }
  .crash { max-width: 420px; margin: 60px auto; text-align: center; background: #fff; border: 1px solid var(--ch-gray-200); border-radius: 14px; padding: 32px 28px; }
  .crash .emoji { font-size: 40px; margin-bottom: 12px; }
  .ctitle { font-weight: 800; font-size: 18px; margin-bottom: 8px; }
  .crash p { font-size: 13px; color: #777; line-height: 1.6; margin-bottom: 20px; }
  .crow { display: flex; gap: 10px; justify-content: center; }
  .primary { background: var(--ch-orange); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
  .ghost { background: transparent; border: 1.5px solid var(--ch-gray-300); color: #555; padding: 10px 20px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
</style>
