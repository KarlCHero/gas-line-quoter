<script>
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import { selectBand, allowableDropKPa } from '$lib/calc/sizing.js';

  const minApp = $derived(settings.cfg.minAppliancePressure ?? 1.13);
  const band = $derived(selectBand(Q.q.pressure, minApp));
  const drop = $derived(allowableDropKPa(Q.q.pressure, minApp));
  const pressureNote = $derived(
    Q.q.pressure < 1.5
      ? { cls: 'caution', text: 'Low-pressure supply — little drop to spend, conservative sizing.' }
      : { cls: 'ok', text: `✓ ${drop.toFixed(2)} kPa allowable drop (supply − ${minApp} kPa appliance min).` }
  );

  const num = (v) => (v === '' ? 0 : Number(v) || 0);
  const buriedM = $derived(
    Q.segs.filter((s) => (s.location || 'internal') === 'buried').reduce((sum, s) => sum + (s.length || 0), 0)
  );
</script>

<div class="wrap">
  <h2>Job Details</h2>

  <div class="card">
    <span class="lbl">Property Address <span class="req">*</span></span>
    <input type="text" placeholder="e.g. 42 Smith Street, Kew VIC 3101" value={Q.q.addr} oninput={(e) => Q.setQ({ addr: e.currentTarget.value })} />
    <div class="help">Required for Client Quote PDF</div>
  </div>

  <div class="card">
    <h3>Gas Supply Pressure at Meter</h3>
    <span class="lbl">Meter Outlet Pressure (kPa)</span>
    <input class="narrow" type="number" step="0.05" min="1.1" max="10" value={Q.q.pressure}
      oninput={(e) => { const v = e.currentTarget.value; if (v === '') return; Q.setQ({ pressure: Math.max(1.1, Number(v) || 1.1) }); }} />
    <div class="pbox {pressureNote.cls}">
      <div>Sizing table: <strong>{band.id}</strong> <span class="dim">({band.dropKPa} kPa design drop · AS/NZS 5601.1 App. F)</span></div>
      <div class="pnote">{pressureNote.text}</div>
    </div>
  </div>

  <div class="card">
    <h3>Additional Works</h3>

    <span class="lbl">New Meter Connection?</span>
    <div class="toggle">
      <button class:on={Q.q.newMeter} onclick={() => Q.setQ({ newMeter: true })}>Yes</button>
      <button class:on={!Q.q.newMeter} onclick={() => Q.setQ({ newMeter: false })}>No</button>
    </div>

    <span class="lbl">2-Storey?</span>
    <div class="toggle">
      <button class:on={Q.q.twoS} onclick={() => Q.setQ({ twoS: true })}>Yes</button>
      <button class:on={!Q.q.twoS} onclick={() => Q.setQ({ twoS: false })}>No</button>
    </div>

    <span class="lbl">Penetrations</span>
    <input type="number" min="0" value={Q.q.pens} oninput={(e) => Q.setQ({ pens: num(e.currentTarget.value) })} />

    <span class="lbl">Extra digging beyond buried runs (metres)</span>
    {#if buriedM > 0}<div class="help">{buriedM}m already included from buried segments.</div>{/if}
    <input type="number" min="0" value={Q.q.dig} oninput={(e) => Q.setQ({ dig: num(e.currentTarget.value) })} />

    <span class="lbl">Concrete Cutting (metres)</span>
    <input type="number" min="0" value={Q.q.conc} oninput={(e) => Q.setQ({ conc: num(e.currentTarget.value) })} />
  </div>

  <div class="actions">
    <button class="ghost" onclick={() => Q.setStep('draw')}>← Back</button>
    <button class="primary" onclick={() => Q.setStep('quote')}>Calculate Quote →</button>
  </div>
</div>

<style>
  .wrap { max-width: 660px; margin: 0 auto; padding: 28px 20px; }
  h2 { font-size: 22px; font-weight: 800; margin-bottom: 18px; }
  h3 { font-size: 15px; font-weight: 800; margin-bottom: 12px; }
  .card { background: #fff; border: 1px solid var(--ch-gray-200); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
  .lbl { font-size: 11px; font-weight: 700; color: var(--ch-gray-500); text-transform: uppercase; letter-spacing: 0.6px; display: block; margin: 14px 0 6px; }
  .lbl:first-of-type { margin-top: 0; }
  .req { color: var(--ch-orange); }
  input { width: 100%; border: 1.5px solid var(--ch-gray-300); border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 14px; background: white; color: var(--ch-text); }
  input:focus { outline: none; border-color: var(--ch-orange); box-shadow: 0 0 0 3px rgba(255, 88, 21, 0.1); }
  input.narrow { max-width: 160px; }
  .help { font-size: 11px; color: var(--ch-gray-400); margin-top: 6px; }
  .pbox { margin-top: 12px; padding: 12px 14px; border-radius: 8px; font-size: 13px; }
  .pbox.ok { background: #f7f3ee; }
  .pbox.caution { background: #fffbeb; border: 1px solid #fde68a; }
  .pbox.warn { background: #fff7ed; border: 1px solid #fed7aa; }
  .pbox strong { color: var(--ch-orange); }
  .dim { color: var(--ch-gray-400); font-size: 12px; }
  .pnote { margin-top: 6px; font-weight: 600; }
  .pbox.ok .pnote { color: var(--ch-green); }
  .pbox.caution .pnote { color: #b45309; }
  .pbox.warn .pnote { color: #b45309; }
  .toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .toggle button { padding: 11px; border: 1.5px solid var(--ch-gray-300); background: white; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; color: var(--ch-gray-600); }
  .toggle button.on { border-color: var(--ch-orange); background: #fff5f2; color: var(--ch-orange); font-weight: 700; }
  .actions { display: flex; gap: 12px; margin-top: 8px; }
  .ghost { background: transparent; border: 1.5px solid var(--ch-gray-300); color: var(--ch-gray-600); padding: 12px 22px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
  .primary { flex: 1; background: var(--ch-orange); color: white; border: none; padding: 12px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
  .primary:hover { background: var(--ch-orange-d); }
</style>
