<script>
  import { settings } from '$lib/stores/settings.svelte.js';
  import { SUPABASE_READY } from '$lib/services/supabase.js';
  import { APPLIANCE_TYPES, PIPE_LOCATIONS } from '$lib/calc/constants.js';

  const cfg = $derived(settings.cfg);
  let saveMsg = $state('');

  const numUpd = (path) => (e) => settings.update(path, Number(e.currentTarget.value) || 0);
  const txtUpd = (path) => (e) => settings.update(path, e.currentTarget.value);
  const DN = [15, 20, 25, 32, 40, 50];
  const PE_DN = [20, 25, 32, 40, 50, 63, 75, 90, 110, 160];
  const PE_LOC_CHOICES = PIPE_LOCATIONS.filter((l) => l.pe);
  const togglePE = (id) => {
    const cur = cfg.peLocations || [];
    settings.update('peLocations', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  async function save() {
    const res = await settings.save();
    saveMsg = res.ok
      ? res.local
        ? '✓ Saved locally (Supabase not connected yet)'
        : '✓ Saved to Supabase'
      : `⚠ ${res.error}`;
    setTimeout(() => (saveMsg = ''), 4000);
  }
</script>

<div class="wrap">
  <div class="top">
    <div>
      <h2>Pricing Settings</h2>
      <div class="sub">All prices ex GST.</div>
    </div>
    <div class="saverow">
      {#if saveMsg}<span class="msg">{saveMsg}</span>{/if}
      <button class="primary" onclick={save} disabled={settings.saving}>{settings.saving ? 'Saving…' : 'Save settings'}</button>
    </div>
  </div>

  {#if !SUPABASE_READY}
    <div class="banner">⚠ Supabase not connected — settings save to this browser only. Add keys to <code>.env.local</code> to sync across devices.</div>
  {/if}

  <div class="grid">
    <div class="card">
      <h3>🏢 Company Details</h3>
      <label>Company Name<input type="text" value={cfg.companyName} oninput={txtUpd('companyName')} /></label>
      <label>Phone<input type="text" value={cfg.companyPhone} oninput={txtUpd('companyPhone')} /></label>
      <label>Email<input type="text" value={cfg.companyEmail} oninput={txtUpd('companyEmail')} /></label>
      <label>Send-to-System URL Template<input type="text" value={cfg.systemUrl} oninput={txtUpd('systemUrl')} placeholder="https://app.checkhero.com.au/...?ref={'{ref}'}" /></label>
    </div>

    <div class="card">
      <h3>👷 Labour (loaded cost)</h3>
      <label class="inline">Loaded rate<span class="dollar"><i>$</i><input type="number" value={cfg.labourRate} oninput={numUpd('labourRate')} /><em>/hr</em></span></label>
      <label class="inline">Base hours (setup + first {cfg.baseMetres}m)<span class="dollar"><input type="number" step="0.25" value={cfg.baseHours} oninput={numUpd('baseHours')} /><em>hr</em></span></label>
      <label class="inline">Base covers metres<span class="dollar"><input type="number" value={cfg.baseMetres} oninput={numUpd('baseMetres')} /><em>m</em></span></label>
      <label class="inline">Minutes per metre (beyond base)<span class="dollar"><input type="number" value={cfg.perMetreMins} oninput={numUpd('perMetreMins')} /><em>min</em></span></label>
      <label class="inline">Minutes per appliance connect<span class="dollar"><input type="number" value={cfg.applianceMins} oninput={numUpd('applianceMins')} /><em>min</em></span></label>
      <label class="inline">Meter connection<span class="dollar"><input type="number" step="0.25" value={cfg.meterHours} oninput={numUpd('meterHours')} /><em>hr</em></span></label>
      <div class="fieldnote">Charge-out follows from the margin: ${cfg.labourRate}/hr ÷ (1 − {cfg.margin}%) = ${cfg.margin < 100 ? (cfg.labourRate / (1 - cfg.margin / 100)).toFixed(0) : '—'}/hr.</div>
    </div>

    <div class="card">
      <h3>🟧 Copper material — All-in ($/m)</h3>
      {#each DN as dn}
        <label class="inline">DN{dn}<span class="dollar"><i>$</i><input type="number" value={cfg.copperRates[dn]} oninput={numUpd(`copperRates.${dn}`)} /><em>/m</em></span></label>
      {/each}
      <label class="inline">Pipe waste<span class="dollar"><input type="number" value={cfg.pipeWastePct} oninput={numUpd('pipeWastePct')} /><em>%</em></span></label>
      <div class="fieldnote">All-in = pipe + clips + run fittings. Waste also applies to the trades order guide.</div>
    </div>

    <div class="card">
      <h3>🟢 PE material — All-in ($/m)</h3>
      <div class="petwo">
        {#each PE_DN as dn}
          <label class="inline">DN{dn}<span class="dollar"><i>$</i><input type="number" value={cfg.peRates?.[dn] ?? 0} oninput={numUpd(`peRates.${dn}`)} /><em>/m</em></span></label>
        {/each}
      </div>
      <div class="fieldnote">PE (AS/NZS 4130 SDR 11), sizes are OD. DN20-32 from Samios; DN40+ are estimates. Sized off Tables F20-F22.</div>
      <h3 class="sub2">PE-eligible locations</h3>
      <div class="loctoggles">
        {#each PE_LOC_CHOICES as l (l.id)}
          <button class="loctgl" class:on={(cfg.peLocations || []).includes(l.id)} style="--lc:{l.color}" onclick={() => togglePE(l.id)}>{l.label}</button>
        {/each}
      </div>
      <label class="inline">Copper stub at appliances / entries<span class="dollar"><input type="number" step="0.5" value={cfg.copperStubM} oninput={numUpd('copperStubM')} /><em>m</em></span></label>
      <div class="fieldnote">External &amp; in-wall runs are always copper. PE can't be exposed at a transition, so a copper stub is forced at each appliance and outside→inside entry.</div>
    </div>

    <div class="card">
      <h3>🔧 Appliance material ($, gas-side)</h3>
      {#each APPLIANCE_TYPES as a}
        <label class="inline">{a.label}<span class="dollar"><i>$</i><input type="number" value={cfg.applianceMaterial[a.id]} oninput={numUpd(`applianceMaterial.${a.id}`)} /></span></label>
      {/each}
      <div class="fieldnote">Valve + flex/bayonet + fittings. Labour ({cfg.applianceMins} min ea) is added separately.</div>
    </div>

    <div class="card">
      <h3>⚙️ Meter &amp; site works ($)</h3>
      <label class="inline">Meter material (adaptor + tail + valve)<span class="dollar"><i>$</i><input type="number" value={cfg.meterMaterial} oninput={numUpd('meterMaterial')} /></span></label>
      <label class="inline">Penetrations (each)<span class="dollar"><i>$</i><input type="number" value={cfg.penetrationCost} oninput={numUpd('penetrationCost')} /></span></label>
      <label class="inline">Digging<span class="dollar"><i>$</i><input type="number" value={cfg.diggingRate} oninput={numUpd('diggingRate')} /><em>/m</em></span></label>
      <label class="inline">Concrete cutting<span class="dollar"><i>$</i><input type="number" value={cfg.concreteCuttingRate} oninput={numUpd('concreteCuttingRate')} /><em>/m</em></span></label>
      <label class="inline">2-storey (flat)<span class="dollar"><i>$</i><input type="number" value={cfg.twoStoreyFlat} oninput={numUpd('twoStoreyFlat')} /></span></label>
    </div>

    <div class="card">
      <h3>📈 Margin</h3>
      <label class="inline">Default margin<span class="dollar"><input type="number" value={cfg.margin} oninput={numUpd('margin')} /><em>%</em></span></label>
      <div class="fieldnote">Applied once at the end to everything (labour + materials). {cfg.margin}% turns ${cfg.labourRate} loaded into ${cfg.margin < 100 ? (cfg.labourRate / (1 - cfg.margin / 100)).toFixed(0) : '—'} charge-out.</div>
    </div>
  </div>
</div>

<style>
  .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  h2 { font-size: 22px; font-weight: 800; }
  .sub { font-size: 12px; color: #aaa; }
  .saverow { display: flex; align-items: center; gap: 12px; }
  .msg { font-size: 12px; font-weight: 600; color: var(--ch-gray-600); }
  .primary { background: var(--ch-orange); color: white; border: none; padding: 10px 22px; border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
  .primary:disabled { opacity: 0.6; }
  .banner { background: #fff7ed; border: 1px solid #fed7aa; color: #b45309; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
  code { background: rgba(0, 0, 0, 0.06); padding: 1px 5px; border-radius: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { background: #fff; border: 1px solid var(--ch-gray-200); border-radius: 14px; padding: 20px; }
  h3 { font-size: 15px; font-weight: 800; margin-bottom: 14px; }
  label { display: block; font-size: 13px; color: var(--ch-gray-700); margin-bottom: 10px; }
  label.inline { display: flex; justify-content: space-between; align-items: center; }
  input { border: 1.5px solid var(--ch-gray-300); border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px; background: white; color: var(--ch-text); width: 100%; }
  label:not(.inline) input { margin-top: 5px; }
  input:focus { outline: none; border-color: var(--ch-orange); box-shadow: 0 0 0 3px rgba(255, 88, 21, 0.1); }
  .dollar { display: flex; align-items: center; gap: 5px; }
  .dollar i { color: #bbb; font-style: normal; }
  .dollar em { color: #bbb; font-style: normal; font-size: 12px; }
  .dollar input { width: 90px; text-align: right; }
  .fieldnote { font-size: 11px; color: var(--ch-gray-400); margin-top: -4px; line-height: 1.4; margin-bottom: 12px; }
  .petwo { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  .sub2 { font-size: 13px; margin: 6px 0 10px; }
  .loctoggles { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .loctgl { padding: 6px 12px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 8px; border: 1.5px solid var(--ch-gray-300); background: white; color: var(--ch-gray-500); }
  .loctgl.on { border-color: var(--lc); background: color-mix(in srgb, var(--lc) 12%, white); color: var(--lc); }
  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
