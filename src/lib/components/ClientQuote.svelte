<script>
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { fmt, APPLIANCE_ICONS } from '$lib/calc/constants.js';
  import LayoutDiagram from './LayoutDiagram.svelte';
  import ApplianceIcon from './ApplianceIcon.svelte';

  let { onBack } = $props();
  const cfg = $derived(settings.cfg);
  const qr = $derived(Q.quote);

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const expiry = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  })();
</script>

<div class="bar no-print">
  <div>
    <h2>Client Quote Preview</h2>
    <div class="sub">Print or Save as PDF to share with your customer.</div>
  </div>
  <div class="acts">
    <button class="ghost" onclick={onBack}>← Back</button>
    <button class="primary" onclick={() => window.print()}>🖨 Print / Save PDF</button>
  </div>
</div>

{#if !qr}
  <div class="empty">Add a layout and appliances to generate a client quote.</div>
{:else}
  <div class="doc">
    <header class="brandhead">
      <div class="logo">◆ Check<span>Hero</span></div>
      <div class="contact">
        <div>{today}</div>
        <div>{cfg.companyPhone} · {cfg.companyEmail}</div>
      </div>
    </header>

    <section class="pad">
      <div class="eyebrow">Gas Installation Proposal For</div>
      <h1>{Q.q.addr || 'Address not specified'}</h1>
      <div class="meta">Natural Gas · Copper pipework · Valid until {expiry}</div>

      <div class="block">
        <div class="sechead">Proposed Gas Line Layout</div>
        <div class="diagram-box">
          <LayoutDiagram segs={Q.segs} apps={Q.apps} />
          <div class="cap">Schematic only — not to scale. Actual routing subject to site conditions.</div>
        </div>
      </div>

      <div class="block">
        <div class="sechead">Scope of Works</div>
        <ul class="scope">
          {#each Q.scope() as item}
            <li><span class="tick">✓</span>{item}</li>
          {/each}
        </ul>
      </div>

      {#if Q.appCounts.length}
        <div class="block">
          <div class="sechead">Appliances Being Connected</div>
          <div class="appgrid">
            {#each Q.appCounts as a (a.id)}
              <div class="appcard">
                <ApplianceIcon typeId={a.id} size={34} />
                <div><div class="acn">{a.count > 1 ? `${a.count}× ` : ''}{a.label}</div><div class="acmj">{a.mj} MJ/hr</div></div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="totalcard">
        <div>
          <div class="tlabel">Total</div>
          <div class="tdesc">All labour, materials &amp; compliance<br />GST included</div>
          <div class="tterms">50% deposit to commence · balance on completion</div>
        </div>
        <div class="tright">
          <div class="tinc">Total inc. GST</div>
          <div class="tbig">{fmt(qr.total * 1.1)}</div>
          <div class="tsplit">{fmt(qr.total)} ex GST + {fmt(qr.total * 0.1)} GST</div>
        </div>
      </div>

      <div class="smallprint">
        <div class="sphead">What's Included &amp; Excluded</div>
        <p>This quote covers the gas pipework, appliance connections, pressure testing to AS/NZS 5601.1, and a Certificate of Compliance. <strong>Excluded:</strong> wall/floor cutting and making good (patching, painting, tiling), supply of appliances unless separately quoted, and any rectification of pre-existing non-compliant gas work uncovered during the job.</p>
        <div class="sphead">Quote Validity &amp; Payment</div>
        <p>Valid for 30 days from {today}. A 50% deposit confirms the booking; the balance is due on completion. Prices include GST.</p>
        <div class="sphead">Scheduling &amp; Compliance</div>
        <p>All gas fitting is carried out by licensed gasfitters; a Certificate of Compliance is issued and lodged as required. CheckHero will use its best efforts to deliver timely service notwithstanding factors beyond its control. {cfg.companyName} may engage appropriately licensed subcontractors to carry out the works.</p>
      </div>
    </section>
  </div>
{/if}

<style>
  .bar { max-width: 820px; margin: 0 auto; padding: 24px 20px 0; display: flex; justify-content: space-between; align-items: center; }
  h2 { font-size: 18px; font-weight: 800; }
  .sub { font-size: 12px; color: #aaa; margin-top: 2px; }
  .acts { display: flex; gap: 10px; }
  .ghost { background: transparent; border: 1.5px solid var(--ch-gray-300); color: var(--ch-gray-600); padding: 9px 18px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
  .primary { background: var(--ch-orange); color: white; border: none; padding: 9px 18px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
  .empty { max-width: 820px; margin: 40px auto; text-align: center; color: #bbb; }
  .doc { max-width: 820px; margin: 16px auto 60px; background: white; border-radius: 14px; overflow: hidden; border: 1px solid var(--ch-gray-200); }
  .brandhead { background: var(--ch-orange); color: white; padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; }
  .logo { font-size: 22px; font-weight: 800; }
  .logo span { opacity: 0.85; }
  .contact { text-align: right; font-size: 12px; opacity: 0.92; line-height: 1.6; }
  .pad { padding: 28px; }
  .eyebrow { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.8px; }
  h1 { font-size: 24px; font-weight: 800; margin: 4px 0 6px; }
  .meta { color: var(--ch-gray-500); font-size: 13px; padding-bottom: 16px; border-bottom: 2px solid #f0e8e0; }
  .block { margin: 22px 0; }
  .sechead { font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .diagram-box { background: var(--ch-cream); border-radius: 10px; padding: 16px 12px; border: 1px solid var(--ch-gray-200); }
  .cap { text-align: center; font-size: 9px; color: #ccc; margin-top: 6px; }
  .scope { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .scope li { display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px; background: var(--ch-cream); border-radius: 7px; border: 1px solid var(--ch-gray-200); font-size: 13px; color: #444; }
  .tick { width: 18px; height: 18px; border-radius: 50%; background: var(--ch-orange); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
  .appgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .appcard { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--ch-gray-200); border-radius: 10px; }
  .acn { font-size: 13px; font-weight: 600; }
  .acmj { font-size: 11px; color: #aaa; }
  .totalcard { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, var(--ch-orange), var(--ch-orange-d)); color: white; border-radius: 14px; padding: 22px 24px; margin: 24px 0; }
  .tlabel { font-weight: 800; font-size: 18px; }
  .tdesc { font-size: 12px; opacity: 0.9; margin-top: 4px; line-height: 1.5; }
  .tterms { font-size: 11px; opacity: 0.75; margin-top: 8px; }
  .tright { text-align: right; }
  .tinc { font-size: 11px; opacity: 0.85; }
  .tbig { font-size: 34px; font-weight: 800; }
  .tsplit { font-size: 11px; opacity: 0.8; }
  .smallprint { margin-top: 22px; font-size: 11px; color: #999; line-height: 1.6; }
  .sphead { font-weight: 800; color: #777; text-transform: uppercase; letter-spacing: 0.4px; font-size: 10px; margin: 14px 0 4px; }
  @media print {
    .no-print { display: none; }
    .doc { border: none; margin: 0; max-width: 100%; }
  }
</style>
