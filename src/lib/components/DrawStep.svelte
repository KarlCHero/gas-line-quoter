<script>
  import { APPLIANCE_TYPES } from '$lib/calc/constants.js';
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import Canvas from './Canvas.svelte';
  import ApplianceIcon from './ApplianceIcon.svelte';

  const tools = [
    { id: 'draw', icon: '✏️', label: 'Draw Pipe', key: 'D' },
    { id: 'appliance', icon: '🔧', label: 'Add Appliance', key: 'A' },
    { id: 'erase', icon: '✕', label: 'Erase', key: 'E' }
  ];

  function onKey(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'd' || e.key === 'D') Q.setTool('draw');
    if (e.key === 'a' || e.key === 'A') Q.setTool('appliance');
    if (e.key === 'e' || e.key === 'E') Q.setTool('erase');
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); Q.undo(); }
    if (e.key === 'Escape') Q.cancelEdit();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="draw">
  <aside class="panel">
    <div>
      <span class="lbl">Tools</span>
      {#each tools as t}
        <button class="tool" class:active={Q.tool === t.id} onclick={() => Q.setTool(t.id)}>
          <span class="ti">{t.icon}</span><span class="tl">{t.label}</span><span class="tk">{t.key}</span>
        </button>
      {/each}
      <button class="tool undo" onclick={() => Q.undo()} disabled={!Q.canUndo}>
        <span class="ti">↩️</span><span class="tl">Undo</span><span class="tk">⌘Z</span>
      </button>
    </div>

    {#if Q.tool === 'appliance'}
      <div>
        <span class="lbl">Appliance Type</span>
        {#each APPLIANCE_TYPES as a}
          <button class="appbtn" class:active={Q.appT === a.id} onclick={() => Q.setAppT(a.id)}>
            <ApplianceIcon typeId={a.id} size={24} />
            <div><div class="an">{a.label}</div><div class="amj">{a.mj} MJ/hr</div></div>
          </button>
        {/each}
      </div>
    {/if}

    {#if Q.apps.length > 0}
      <div class="demand">
        <span class="lbl" style="color:var(--ch-orange)">Total Demand</span>
        <div class="dval">{Q.totalDemand} MJ/hr</div>
        <div class="dsub">{Q.apps.length} appliance{Q.apps.length !== 1 ? 's' : ''}</div>
      </div>
    {/if}

    <div class="hint">
      {#if Q.tool === 'draw'}<strong>Drag</strong> on the canvas to draw pipe runs. <strong>Click any section</strong> to set its length.
      {:else if Q.tool === 'appliance'}Click on or near a pipe endpoint to place an appliance — it snaps to the nearest endpoint.
      {:else}<strong>Click</strong> any segment or appliance to remove it.{/if}
    </div>

    <button class="next" onclick={() => Q.setStep('questionnaire')}>Next: Job Details →</button>
  </aside>

  <Canvas />
</div>

<style>
  .draw { display: flex; height: calc(100vh - 116px); }
  .panel { width: 220px; background: #fff; border-right: 1px solid var(--ch-gray-200); padding: 14px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex-shrink: 0; }
  .lbl { font-size: 11px; font-weight: 700; color: var(--ch-gray-500); text-transform: uppercase; letter-spacing: 0.6px; display: block; margin-bottom: 6px; }
  .tool { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px; border-radius: 8px; margin-bottom: 3px; border: 1.5px solid transparent; background: transparent; font: inherit; font-weight: 600; font-size: 13px; cursor: pointer; text-align: left; color: var(--ch-gray-700); }
  .tool:hover { border-color: var(--ch-gray-200); }
  .tool.active { border-color: var(--ch-orange); background: #fff5f2; color: var(--ch-orange); }
  .tool.undo { color: var(--ch-gray-500); margin-top: 4px; }
  .tool:disabled { opacity: 0.5; cursor: default; }
  .ti { font-size: 14px; }
  .tl { flex: 1; }
  .tk { font-size: 10px; color: #ccc; font-family: monospace; background: #f0ece8; padding: 1px 5px; border-radius: 4px; }
  .appbtn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: 8px; margin-bottom: 3px; cursor: pointer; text-align: left; border: 1.5px solid var(--ch-gray-200); background: white; font: inherit; font-size: 12px; color: #333; }
  .appbtn.active { border-color: var(--ch-orange); background: #fff5f2; font-weight: 700; }
  .an { line-height: 1.3; }
  .amj { color: #bbb; font-size: 10px; }
  .demand { background: #fff5f2; border-radius: 10px; padding: 12px 14px; border: 1px solid var(--ch-orange-pale); }
  .dval { font-size: 24px; font-weight: 800; color: var(--ch-orange); }
  .dsub { font-size: 11px; color: var(--ch-orange); opacity: 0.7; margin-top: 2px; }
  .hint { padding: 10px 12px; background: #f7f3ee; border-radius: 8px; font-size: 11px; color: #999; line-height: 1.8; }
  .next { margin-top: auto; width: 100%; background: var(--ch-orange); color: white; border: none; padding: 12px; border-radius: 8px; font: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
  .next:hover { background: var(--ch-orange-d); }
</style>
