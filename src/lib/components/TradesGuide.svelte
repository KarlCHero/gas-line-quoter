<script>
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { PIPE_COLORS, locOf } from '$lib/calc/constants.js';
  import LayoutDiagram from './LayoutDiagram.svelte';

  let { onBack } = $props();
  const cfg = $derived(settings.cfg);
  const qr = $derived(Q.quote);
  const mat = $derived(Q.materials());

  const wastePct = $derived(cfg.pipeWastePct || 0);
  const rows = $derived.by(() => {
    if (!mat) return [];
    const r = [];
    const wf = 1 + wastePct / 100;
    const wnote = wastePct ? `incl. ${wastePct}% waste` : 'no waste allowance';
    for (const [size, m] of Object.entries(mat.pipeByMat.copper)) {
      r.push({ item: `DN${size} Copper pipe (AS 1432)`, qty: `${(m * wf).toFixed(1)} m`, note: wnote });
    }
    for (const [size, m] of Object.entries(mat.pipeByMat.pe)) {
      r.push({ item: `DN${size} PE pipe (AS/NZS 4130)`, qty: `${(m * wf).toFixed(1)} m`, note: wnote });
    }
    if (mat.transitions) r.push({ item: 'Copper↔PE transition adaptors', qty: `${mat.transitions}`, note: `appliance + entry stubs (${mat.stubMetres} m copper)` });
    r.push({ item: '90° Elbows', qty: `~${mat.elbows}`, note: 'at bends + 2 per appliance connection' });
    if (mat.midRunCouplers) r.push({ item: 'Couplers (mid-run)', qty: `~${mat.midRunCouplers}`, note: 'for runs >4 m (copper length)' });
    if (mat.couplings) r.push({ item: 'Inline couplers', qty: `~${mat.couplings}`, note: 'straight-through joins' });
    if (mat.reducers) r.push({ item: 'Reducers', qty: `~${mat.reducers}`, note: 'size transitions' });
    if (mat.tees) r.push({ item: 'Tees', qty: `${mat.tees}`, note: 'branch junctions' });
    for (const [size, c] of Object.entries(mat.supportsByMat.copper)) {
      r.push({ item: `DN${size} Copper supports / clips`, qty: `~${c}`, note: '@ 1.5m centres — saddle clamps' });
    }
    for (const [size, c] of Object.entries(mat.supportsByMat.pe)) {
      r.push({ item: `DN${size} PE supports / clips`, qty: `~${c}`, note: '@ 1.5m centres' });
    }
    r.push({ item: 'Flexible hose connectors', qty: `${mat.flexHoses}`, note: 'cooktops & freestanding cookers only' });
    r.push({ item: 'Isolation valves', qty: `${mat.isolationValves}`, note: '1 per appliance + 1 at meter' });
    return r;
  });
</script>

<div class="bar no-print">
  <div>
    <h2>Trades Installation Guide</h2>
    <div class="sub">Print or Save as PDF for site use.</div>
  </div>
  <div class="acts">
    <button class="ghost" onclick={onBack}>← Back</button>
    <button class="primary" onclick={() => window.print()}>🖨 Print / Save PDF</button>
  </div>
</div>

{#if !qr}
  <div class="empty">Add a layout and appliances to generate the trades guide.</div>
{:else}
  <div class="doc">
    <header class="head">
      <div class="logo">◆ Check<span>Hero</span><div class="tag">Installation Guide · INTERNAL USE ONLY</div></div>
      <div class="contact">{cfg.companyPhone}</div>
    </header>

    <section class="pad">
      <div class="eyebrow">Installation Address</div>
      <h1>{Q.q.addr || 'Not specified'}</h1>
      <div class="summary">
        <span>Supply: <strong>{Q.q.pressure} kPa</strong></span>
        <span>Demand: <strong>{qr.totalMJ} MJ/hr</strong></span>
        <span>Pipe: <strong>{qr.longest.toFixed(1)} m</strong></span>
        <span>Appliances: <strong>{Q.apps.length}</strong></span>
      </div>

      <div class="block">
        <div class="sechead">Installation Map</div>
        <div class="map"><LayoutDiagram segs={Q.segs} apps={Q.apps} sized={qr.sized} /></div>
      </div>

      <div class="block">
        <div class="sechead">Pipe Sections</div>
        <table>
          <thead><tr><th class="l">Section</th><th class="l">Run</th><th class="l">Length</th><th class="l">Flow</th><th class="r">Size</th></tr></thead>
          <tbody>
            {#each qr.sized as s, i (s.id)}
              <tr>
                <td class="l"><span class="sid">S{i + 1}</span></td>
                <td class="l">{locOf(s).label} · <span class="mat {s.material}">{s.material === 'pe' ? 'PE' : 'Cu'}</span></td>
                <td class="l">{s.length ? `${s.length} m` : '—'}</td>
                <td class="l">{s.flow} MJ/hr</td>
                <td class="r"><span class="dn" style="background:{PIPE_COLORS[s.size]}">DN{s.size}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="block">
        <div class="sechead">Estimated Materials — Order Guide</div>
        <table>
          <thead><tr><th class="l">Item</th><th class="r">Est. Qty</th><th class="l">Notes</th></tr></thead>
          <tbody>
            {#each rows as row}
              <tr><td class="l strong">{row.item}</td><td class="r">{row.qty}</td><td class="l note">{row.note}</td></tr>
            {/each}
          </tbody>
        </table>
        <div class="disclaimer">Quantities are estimates based on the pipe layout. Verify before ordering — actual fittings may vary based on site conditions.</div>
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
  .head { background: var(--ch-charcoal); color: white; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .logo { font-size: 20px; font-weight: 800; }
  .logo span { color: var(--ch-orange); }
  .tag { font-size: 10px; font-weight: 600; opacity: 0.55; margin-top: 2px; }
  .contact { font-size: 12px; opacity: 0.6; }
  .pad { padding: 28px; }
  .eyebrow { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.8px; }
  h1 { font-size: 22px; font-weight: 800; margin: 4px 0 10px; }
  .summary { display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: #888; padding-bottom: 16px; border-bottom: 2px solid #f0e8e0; }
  .summary strong { color: var(--ch-text); }
  .block { margin: 22px 0; }
  .sechead { font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .map { background: var(--ch-cream); border-radius: 10px; padding: 16px 12px; border: 1px solid var(--ch-gray-200); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { padding: 7px 10px; font-weight: 700; color: #bbb; font-size: 11px; border-bottom: 2px solid #f0e8e0; }
  th.l, td.l { text-align: left; }
  th.r, td.r { text-align: right; }
  td { padding: 9px 10px; border-bottom: 1px solid #f7f2ec; color: #666; }
  td.strong { font-weight: 700; color: var(--ch-text); }
  td.note { color: #aaa; font-size: 12px; }
  .sid { background: var(--ch-cream); border-radius: 5px; padding: 2px 8px; font-weight: 700; font-size: 11px; }
  .dn { color: white; border-radius: 4px; padding: 2px 10px; font-size: 11px; font-weight: 800; }
  .mat { font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px; }
  .mat.copper { background: #fff5f2; color: var(--ch-orange); }
  .mat.pe { background: #ecfdf5; color: #16a34a; }
  .disclaimer { margin-top: 8px; padding: 8px 12px; background: #fff9f7; border-radius: 8px; border: 1px solid var(--ch-orange-pale); font-size: 11px; color: #999; }
  @media print {
    .no-print { display: none; }
    .doc { border: none; margin: 0; max-width: 100%; }
  }
</style>
