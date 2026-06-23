<script>
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { PIPE_COLORS, fmt, labelOf } from '$lib/calc/constants.js';

  let { onClient } = $props();
  const cfg = $derived(settings.cfg);
  const qr = $derived(Q.quote);

  const matRate = (s) => (s.material === 'pe' ? (cfg.peRates?.[s.size] ?? 0) : (cfg.copperRates?.[s.size] ?? 0));
  const segCost = (s) => (s.length ? s.length * matRate(s) : 0);
</script>

<div class="wrap">
  {#if !qr}
    <div class="empty">
      <div class="emoji">📐</div>
      <div class="msg">Draw pipe segments, set their lengths, and add at least one appliance.</div>
      <button class="primary" onclick={() => Q.setStep('draw')}>← Draw Layout</button>
    </div>
  {:else}
    <div class="head">
      <div>
        <h2>Gas Installation Quote</h2>
        {#if Q.q.addr}<div class="addr">{Q.q.addr}</div>{/if}
        <div class="meta">Natural Gas · Copper{#if qr.hasPE} / PE{/if} · AS/NZS 5601 · Ex GST</div>
      </div>
      <button class="ghost" onclick={onClient}>📄 Client Quote</button>
    </div>

    <div class="card">
      <h3>Pipe Sizing — AS/NZS 5601 Table {qr.band.id}</h3>
      <div class="stats">
        <div class="stat"><span class="lbl">Supply Pressure</span><div class="v">{Q.q.pressure} kPa</div></div>
        <div class="stat"><span class="lbl">Design Table</span><div class="v">{qr.band.id} · {qr.band.dropKPa} kPa drop</div></div>
        <div class="stat"><span class="lbl">Allowable Drop</span><div class="v">{qr.allowDrop.toFixed(2)} kPa</div></div>
        <div class="stat"><span class="lbl">Longest Run</span><div class="v">{qr.longest.toFixed(1)} m</div></div>
        <div class="stat"><span class="lbl">Total Demand</span><div class="v">{qr.totalMJ} MJ/hr</div></div>
      </div>
      <table>
        <thead><tr><th class="l">Section</th><th>Material</th><th>Length</th><th>Flow</th><th>Size</th><th>Material Cost</th></tr></thead>
        <tbody>
          {#each qr.sized as s, i (s.id)}
            <tr>
              <td class="l">Section {i + 1}</td>
              <td><span class="mat {s.material}">{s.material === 'pe' ? 'PE' : 'Cu'}</span></td>
              <td>{s.length ? `${s.length} m` : '—'}</td>
              <td>{s.flow} MJ/hr</td>
              <td>
                <span class="dn" style="background:{PIPE_COLORS[s.size] || 'var(--ch-orange)'}">DN{s.size}</span>
                {#if s.overCapacity}<span class="flag over" title="Exceeds capacity at this run length — needs design review or higher supply pressure">⚠ over</span>
                {:else if s.oversized}<span class="flag up" title="Stepped up a size — borderline at the smaller size">↑ oversized</span>{/if}
              </td>
              <td>{s.length ? fmt(segCost(s)) : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="tablenote">Sized per AS/NZS 5601.1:2013 Appendix F — copper (AS 1432 Type B, Table {qr.band.id}){#if qr.peBandId} and PE (AS/NZS 4130 SDR 11, Table {qr.peBandId}){/if}, longest-run method. {#if qr.stubs.count}Includes {qr.stubs.count} copper stub{qr.stubs.count > 1 ? 's' : ''} ({qr.stubs.metres} m) at appliance/entry transitions.{/if} Final sizing is the gasfitter's COC responsibility.</div>
      {#if qr.anyOversized || qr.anyOverCapacity}
        <div class="disclaimer">
          {#if qr.anyOverCapacity}<strong>⚠ Capacity exceeded:</strong> one or more runs exceed DN50 at this length/pressure — split the run, raise supply pressure, or seek design advice.<br />{/if}
          {#if qr.anyOversized}<strong>↑ Oversized sections:</strong> some runs were stepped up a size because they were borderline (within 5% of capacity), giving a safety margin for fittings and future load.{/if}
        </div>
      {/if}
    </div>

    {#if qr.peBandId}
      {@const sc = qr.scenarios}
      <div class="card">
        <h3>Copper vs PE — Material Strategy</h3>
        {#if qr.hasPE}
          <div class="savebar">Optimised mix saves <strong>{fmt(qr.saving)}</strong> vs all-copper ({fmt(qr.total * 1.1)} inc GST quoted).</div>
        {:else}
          <div class="savebar muted-bar">No PE-eligible runs marked. Tag under-house / in-roof / buried runs in the layout to use PE and cut material cost.</div>
        {/if}
        <div class="scen">
          <div class="sc"><div class="scl">All copper</div><div class="scv">{fmt(sc.copper.total)}</div></div>
          <div class="sc reco"><div class="scl">Optimised mix ★</div><div class="scv">{fmt(sc.mix.total)}</div><div class="scn">{sc.mix.peM}m PE · {sc.mix.copperM.toFixed(0)}m Cu</div></div>
          <div class="sc"><div class="scl">Max PE</div><div class="scv">{fmt(sc.maxPE.total)}</div><div class="scn">best-case routing</div></div>
        </div>
        <div class="tablenote">PE (AS/NZS 4130) only where the run location allows; external &amp; in-wall runs stay copper, plus 1 m copper stubs at appliances and outside→inside entries. Ex GST.</div>
      </div>
    {/if}

    <div class="card margin">
      <h3>Profit Margin</h3>
      <div class="mrow">
        <input type="range" min="0" max="60" step="1" value={Q.margin} oninput={(e) => Q.setMargin(e.currentTarget.value)} />
        <input class="mnum" type="number" min="0" max="60" value={Q.margin} oninput={(e) => Q.setMargin(e.currentTarget.value)} />
        <span class="pct">%</span>
      </div>
      <div class="mnote">
        You keep <strong>{Q.margin}%</strong> of every dollar charged as profit — the other {100 - Q.margin}% covers materials &amp; labour.
        At this rate, {fmt(qr.subtotal)} in costs → <strong>{fmt(qr.total)}</strong> quoted.
      </div>
    </div>

    <div class="card">
      <h3>Breakdown — Ex GST</h3>
      <div class="rp col">
        <div class="rpline"><span>Labour</span><span>{fmt(qr.labourCost)}</span></div>
        <div class="sub">{qr.labourHours.toFixed(2)} hr @ {fmt(qr.rate)}/hr (2 hr base + run + {Q.apps.length} appliance{Q.apps.length !== 1 ? 's' : ''}{Q.q.newMeter ? ' + meter' : ''}{qr.stubs.count ? ` + ${qr.stubs.count} transition${qr.stubs.count !== 1 ? 's' : ''}` : ''})</div>
      </div>
      <div class="rp section"><span>Materials</span><span>{fmt(qr.materialCost)}</span></div>
      <div class="rp indent"><span>Copper{#if qr.stubs.count} <span class="muted">· incl. {qr.stubs.count} stub{qr.stubs.count > 1 ? 's' : ''}</span>{:else if cfg.pipeWastePct} <span class="muted">· incl. {cfg.pipeWastePct}% waste</span>{/if}</span><span>{fmt(qr.copperMat)}</span></div>
      {#if qr.peMat}<div class="rp indent"><span>PE pipe <span class="muted">· AS/NZS 4130</span></span><span>{fmt(qr.peMat)}</span></div>{/if}
      <div class="rp indent"><span>Appliance connections ({Q.apps.length})</span><span>{fmt(qr.applianceMat)}</span></div>
      {#if qr.meterMat}<div class="rp indent"><span>Meter connection</span><span>{fmt(qr.meterMat)}</span></div>{/if}
      <div class="rp section"><span>Site works</span><span>{fmt(qr.siteWorks)}</span></div>
      {#if qr.penCost}<div class="rp indent"><span>{Q.q.pens} penetration{Q.q.pens > 1 ? 's' : ''}</span><span>{fmt(qr.penCost)}</span></div>{/if}
      {#if qr.digCost}
        {@const totalDig = (qr.autoDig || 0) + (Q.q.dig || 0)}
        {@const digLabel = qr.autoDig && Q.q.dig ? `Digging (${totalDig}m — ${qr.autoDig}m buried + ${Q.q.dig}m extra)` : `Digging (${totalDig}m)`}
        <div class="rp indent"><span>{digLabel}</span><span>{fmt(qr.digCost)}</span></div>
      {/if}
      {#if qr.concCost}<div class="rp indent"><span>Concrete cutting ({Q.q.conc}m)</span><span>{fmt(qr.concCost)}</span></div>{/if}
      {#if qr.twoCost}<div class="rp indent"><span>2-storey allowance</span><span>{fmt(qr.twoCost)}</span></div>{/if}
      <div class="rp indent"><span>Compliance certificate (COC)</span><span>{fmt(qr.cocCost)}</span></div>
      <div class="rp total-line"><span>Cost (before margin)</span><span>{fmt(qr.subtotal)}</span></div>
      <div class="rp dim"><span>Margin ({Q.margin}%)</span><span>{fmt(qr.marginAmt)}</span></div>
      <div class="grand">
        <div>
          <div class="glabel">Total (Ex GST)</div>
          <div class="gsub">+ GST {fmt(qr.total * 0.1)} = <strong>{fmt(qr.total * 1.1)}</strong> inc GST</div>
        </div>
        <div class="gnum">{fmt(qr.total)}</div>
      </div>
    </div>

    <div class="actions">
      <button class="ghost" onclick={() => Q.setStep('questionnaire')}>← Back</button>
      <button class="ghost" onclick={() => Q.newJob()}>🔄 New Job</button>
    </div>
  {/if}
</div>

<style>
  .wrap { max-width: 820px; margin: 0 auto; padding: 28px 20px; }
  .empty { text-align: center; padding: 60px; }
  .empty .emoji { font-size: 48px; margin-bottom: 12px; }
  .empty .msg { font-weight: 700; color: #bbb; font-size: 16px; margin-bottom: 18px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  h2 { font-size: 22px; font-weight: 800; }
  .addr { color: #888; font-size: 13px; margin-top: 3px; }
  .meta { font-size: 11px; color: #bbb; margin-top: 2px; }
  h3 { font-size: 15px; font-weight: 800; margin-bottom: 14px; }
  .card { background: #fff; border: 1px solid var(--ch-gray-200); border-radius: 14px; padding: 20px; margin-bottom: 14px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .stat { background: var(--ch-cream); border-radius: 8px; padding: 10px 12px; }
  .lbl { font-size: 11px; font-weight: 700; color: var(--ch-gray-500); text-transform: uppercase; letter-spacing: 0.6px; }
  .stat .v { font-weight: 800; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: right; padding: 7px 10px; font-weight: 700; color: #bbb; font-size: 11px; border-bottom: 2px solid #f0e8e0; }
  th.l { text-align: left; }
  td { text-align: right; padding: 8px 10px; border-bottom: 1px solid #f7f2ec; color: #666; }
  td.l { text-align: left; font-weight: 600; color: var(--ch-text); }
  .dn { color: white; border-radius: 4px; padding: 2px 10px; font-size: 11px; font-weight: 800; }
  .mat { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; }
  .mat.copper { background: #fff5f2; color: var(--ch-orange); }
  .mat.pe { background: #ecfdf5; color: #16a34a; }
  .savebar { padding: 10px 14px; background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 13px; color: #166534; margin-bottom: 14px; }
  .savebar strong { font-size: 15px; }
  .savebar.muted-bar { background: var(--ch-cream); border-color: var(--ch-gray-200); color: var(--ch-gray-500); }
  .scen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .sc { background: var(--ch-cream); border: 1px solid var(--ch-gray-200); border-radius: 10px; padding: 12px; text-align: center; }
  .sc.reco { background: #fff9f7; border-color: var(--ch-orange); }
  .scl { font-size: 11px; font-weight: 700; color: var(--ch-gray-500); text-transform: uppercase; letter-spacing: 0.4px; }
  .scv { font-size: 20px; font-weight: 800; margin-top: 4px; }
  .sc.reco .scv { color: var(--ch-orange); }
  .scn { font-size: 10px; color: var(--ch-gray-400); margin-top: 2px; }
  .flag { font-size: 10px; font-weight: 700; margin-left: 6px; padding: 1px 6px; border-radius: 4px; }
  .flag.up { background: #fff7ed; color: #b45309; border: 1px solid #fed7aa; }
  .flag.over { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .tablenote { font-size: 11px; color: var(--ch-gray-400); margin-top: 10px; line-height: 1.5; }
  .muted { color: var(--ch-gray-400); font-weight: 400; font-size: 11px; }
  .disclaimer { margin-top: 10px; padding: 10px 14px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; font-size: 12px; color: #92400e; line-height: 1.6; }
  .margin { background: #fff9f7; border-color: var(--ch-orange-pale); }
  .mrow { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .mrow input[type='range'] { flex: 1; accent-color: var(--ch-orange); }
  .mnum { width: 64px; text-align: center; border: 1.5px solid var(--ch-gray-300); border-radius: 8px; padding: 5px 8px; font: inherit; font-weight: 700; font-size: 14px; }
  .pct { color: #888; font-weight: 600; }
  .mnote { padding: 10px 14px; background: #f7f3ee; border-radius: 8px; font-size: 12px; color: #777; line-height: 1.6; }
  .mnote strong { color: var(--ch-orange); }
  .rp { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid #f5f0ea; font-weight: 600; }
  .rp.col { flex-direction: column; align-items: flex-start; gap: 4px; }
  .rpline { display: flex; justify-content: space-between; width: 100%; }
  .sub { font-size: 12px; color: #aaa; padding-left: 8px; font-weight: 400; }
  .rp.section { font-weight: 800; }
  .indent { padding-left: 16px; color: #555; font-weight: 500; }
  .dim { color: #999; }
  .total-line { font-weight: 800; border-top: 1px solid #e8e0d6; }
  .grand { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
  .glabel { font-weight: 800; font-size: 16px; }
  .gsub { font-size: 12px; color: #aaa; margin-top: 2px; }
  .gsub strong { color: var(--ch-text); }
  .gnum { font-size: 34px; font-weight: 800; color: var(--ch-orange); }
  .actions { display: flex; gap: 12px; }
  .ghost { background: transparent; border: 1.5px solid var(--ch-gray-300); color: var(--ch-gray-600); padding: 10px 18px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
  .primary { background: var(--ch-orange); color: white; border: none; padding: 12px 22px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
</style>
