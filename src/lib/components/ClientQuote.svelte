<script>
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { fmt, labelOf } from '$lib/calc/constants.js';

  let { onBack } = $props();
  const cfg = $derived(settings.cfg);
  const qr = $derived(Q.quote);
  let copied = $state(false);

  // Plain-text job description built from the tool, to paste into your own quote.
  const description = $derived.by(() => {
    if (!qr) return '';
    const L = [];
    L.push(`Gas Installation${Q.q.addr ? ` — ${Q.q.addr}` : ''}`);
    L.push('Natural Gas · Copper · AS/NZS 5601.1:2013');
    L.push('');
    L.push('Scope of works:');
    for (const item of Q.scope()) L.push(`• ${item}`);
    L.push('');
    const sizes = [...new Set(qr.sized.map((s) => `DN${s.size}`))].join(', ');
    L.push(`Pipe sizing (Table ${qr.band.id}, ${qr.q?.pressure ?? Q.q.pressure} kPa supply): ${sizes}`);
    L.push(`Total demand ${qr.totalMJ} MJ/hr over ${qr.longest.toFixed(1)} m longest run.`);
    L.push('');
    L.push(`Total: ${fmt(qr.total * 1.1)} inc GST (${fmt(qr.total)} ex GST + ${fmt(qr.total * 0.1)} GST).`);
    L.push('Quote valid 30 days · 50% deposit to commence, balance on completion.');
    L.push('Excludes wall/floor cutting & making good, and supply of appliances unless quoted.');
    return L.join('\n');
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(description);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }
</script>

<div class="wrap">
  <div class="bar">
    <div>
      <h2>Quote Description</h2>
      <div class="sub">Copy this into your quote — built from the layout, appliances and job details.</div>
    </div>
    <div class="acts">
      <button class="ghost" onclick={onBack}>← Back</button>
      <button class="primary" onclick={copy} disabled={!qr}>{copied ? '✓ Copied' : '📋 Copy'}</button>
    </div>
  </div>

  {#if !qr}
    <div class="empty">Add a layout and appliances to generate a description.</div>
  {:else}
    <textarea readonly value={description} rows={description.split('\n').length + 1}></textarea>
  {/if}
</div>

<style>
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px 20px; }
  .bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  h2 { font-size: 20px; font-weight: 800; }
  .sub { font-size: 12px; color: var(--ch-gray-500); margin-top: 2px; max-width: 420px; }
  .acts { display: flex; gap: 10px; }
  .ghost { background: transparent; border: 1.5px solid var(--ch-gray-300); color: var(--ch-gray-600); padding: 9px 18px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
  .primary { background: var(--ch-orange); color: white; border: none; padding: 9px 20px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
  .primary:disabled { opacity: 0.5; }
  .empty { text-align: center; color: #bbb; padding: 40px; }
  textarea { width: 100%; border: 1px solid var(--ch-gray-200); border-radius: 12px; padding: 18px 20px; font: inherit; font-size: 14px; line-height: 1.7; color: var(--ch-text); background: #fff; resize: vertical; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04); }
  textarea:focus { outline: none; border-color: var(--ch-orange); }
</style>
