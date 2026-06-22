<script>
  import { GRID, METER_POS, PIPE_COLORS, APPLIANCE_ICONS, snapV } from '$lib/calc/constants.js';
  import { quoteStore as Q } from '$lib/stores/quote.svelte.js';
  import ApplianceGlyph from './ApplianceGlyph.svelte';

  let svgEl;

  function svgPos(e) {
    const r = svgEl.getBoundingClientRect();
    return { x: snapV(e.clientX - r.left), y: snapV(e.clientY - r.top) };
  }

  function onPointerDown(e) {
    if (e.target.closest('.nd')) return; // appliances / meter don't start a draw
    // Clicking an existing segment edits/erases it (its own handler) — don't also
    // start a zero-length draw underneath it.
    if (e.target.closest('.seg')) return;
    if (Q.selSeg != null) { Q.commitEdit(); return; }
    const p = svgPos(e);
    if (Q.tool === 'draw') Q.startDraw(p);
    else if (Q.tool === 'appliance') Q.addAppliance(p);
  }

  function onPointerMove(e) {
    Q.updateDraw(svgPos(e));
  }

  function onPointerLeave() {
    Q.setMouse(null);
  }

  // Commit the draw even if the pointer is released outside the SVG.
  function onWindowUp() {
    if (Q.drawPreview) Q.commitDraw();
  }

  function segMid(s) {
    return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
  }
</script>

<svelte:window onpointerup={onWindowUp} />

<div class="canvas-wrap">
  <svg
    bind:this={svgEl}
    width="100%"
    height="100%"
    class="canvas {Q.tool}"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerleave={onPointerLeave}
    role="application"
    aria-label="Pipe layout canvas"
  >
    <defs>
      <pattern id="dg" x="0" y="0" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
        <circle cx={GRID / 2} cy={GRID / 2} r="1.5" fill="#e5dfd6" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dg)" />

    <!-- Segments -->
    {#each Q.segs as s, i (s.id)}
      {@const mid = segMid(s)}
      {@const sel = Q.selSeg === s.id}
      <!-- svelte-ignore a11y_click_events_have_key_events -- canvas SVG editing is pointer-only by design -->
      <g class="seg" role="button" tabindex="-1" onclick={(e) => { e.stopPropagation(); Q.openEdit(s); }}>
        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" stroke-width="20" />
        <line
          x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={sel ? '#c0392b' : s.external ? '#2563eb' : 'var(--ch-orange)'}
          stroke-width={sel ? 5 : 4}
          stroke-linecap="round"
          stroke-dasharray={s.external ? '7,4' : 'none'}
        />
        {#if !sel}
          {@const lbl = `S${i + 1}${s.length != null ? ` · ${s.length}m` : ''}${s.external ? ' · EXT' : ''}`}
          {@const bw = lbl.length * 6 + 12}
          <rect x={mid.x - bw / 2} y={mid.y - 12} width={bw} height="22" rx="4" fill={s.length != null ? 'white' : '#fff5f2'} stroke={s.external ? '#2563eb' : s.length != null ? '#ede6dc' : 'var(--ch-orange)'} />
          <text x={mid.x} y={mid.y + 5} text-anchor="middle" font-size="11" font-weight="700" fill={s.external ? '#2563eb' : s.length != null ? '#333' : 'var(--ch-orange)'}>{lbl}</text>
        {/if}
      </g>
    {/each}

    <!-- Draw preview -->
    {#if Q.drawPreview}
      <line
        x1={Q.drawPreview.x1} y1={Q.drawPreview.y1} x2={Q.drawPreview.x2} y2={Q.drawPreview.y2}
        stroke="var(--ch-orange)" stroke-width="3" stroke-dasharray="8,5" stroke-linecap="round" opacity="0.5"
      />
    {/if}

    <!-- Appliance ghost cursor -->
    {#if Q.tool === 'appliance' && Q.mouse}
      {@const ic = APPLIANCE_ICONS[Q.appT] || { color: '#888' }}
      <g opacity="0.4" style="pointer-events:none">
        <circle cx={Q.mouse.x} cy={Q.mouse.y} r="20" fill={ic.color} fill-opacity="0.15" stroke={ic.color} stroke-width="1.5" stroke-dasharray="5,3" />
        <circle cx={Q.mouse.x} cy={Q.mouse.y} r="14" fill={ic.color} />
        <g transform="translate({Q.mouse.x - 10},{Q.mouse.y - 10})"><ApplianceGlyph typeId={Q.appT} /></g>
      </g>
    {/if}

    <!-- Appliances -->
    {#each Q.apps as a (a.id)}
      {@const ic = APPLIANCE_ICONS[a.typeId] || { color: '#888' }}
      <!-- svelte-ignore a11y_click_events_have_key_events -- canvas SVG editing is pointer-only by design -->
      <g class="nd appliance" role="button" tabindex="-1"
        onclick={(e) => { e.stopPropagation(); if (Q.tool === 'erase') Q.delApp(a.id); }}
        style="cursor:{Q.tool === 'erase' ? 'pointer' : 'default'}">
        <circle cx={a.x} cy={a.y} r="22" fill="white" stroke={Q.tool === 'erase' ? '#fca5a5' : '#e5dfd6'} stroke-width={Q.tool === 'erase' ? 2.5 : 1.5} />
        <circle cx={a.x} cy={a.y} r="16" fill={ic.color} />
        <g transform="translate({a.x - 10},{a.y - 10})"><ApplianceGlyph typeId={a.typeId} /></g>
        <text x={a.x} y={a.y + 38} text-anchor="middle" font-size="9" font-weight="700" fill="#555">{(a.label || '').split(' ')[0]}</text>
        <text x={a.x} y={a.y + 50} text-anchor="middle" font-size="9" fill="#bbb">{a.mj} MJ/hr</text>
      </g>
    {/each}

    <!-- Gas meter -->
    <g class="nd">
      <polygon
        points="{METER_POS.x},{METER_POS.y - 20} {METER_POS.x + 17},{METER_POS.y - 10} {METER_POS.x + 17},{METER_POS.y + 10} {METER_POS.x},{METER_POS.y + 20} {METER_POS.x - 17},{METER_POS.y + 10} {METER_POS.x - 17},{METER_POS.y - 10}"
        fill="var(--ch-orange)"
      />
      <text x={METER_POS.x} y={METER_POS.y + 1} text-anchor="middle" font-size="8" font-weight="800" fill="white">METER</text>
      <text x={METER_POS.x} y={METER_POS.y + 12} text-anchor="middle" font-size="7" fill="rgba(255,255,255,.75)">GAS</text>
    </g>
  </svg>

  <!-- Inline length editor -->
  {#if Q.selSeg != null}
    {@const s = Q.segs.find((x) => x.id === Q.selSeg)}
    {#if s}
      {@const mid = segMid(s)}
      <div class="editor" style="left:{mid.x}px; top:{mid.y}px; border-color:{Q.editErr ? '#DC2626' : 'var(--ch-orange)'}">
        <div class="row">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="number" placeholder="Length" value={Q.editVal} autofocus
            oninput={(e) => Q.setEditVal(e.currentTarget.value)}
            onkeydown={(e) => { if (e.key === 'Enter') Q.commitEdit(); if (e.key === 'Escape') Q.cancelEdit(); }}
          />
          <span class="unit">m</span>
          <button class="ok" onclick={() => Q.commitEdit()}>✓</button>
          <button class="del" title="Delete segment" onclick={() => { Q.delSeg(Q.selSeg); Q.cancelEdit(); }}>✕</button>
        </div>
        <button class="ext" class:on={s.external} onclick={() => Q.toggleExternal(s.id)}>
          {s.external ? '☒ External run — copper only (no PEX)' : '☐ Mark as external (copper only)'}
        </button>
        {#if Q.editErr}<div class="err">{Q.editErr}</div>{/if}
      </div>
    {/if}
  {/if}

  <!-- Empty state -->
  {#if Q.segs.length === 0 && Q.apps.length === 0}
    <div class="empty">
      <div class="emoji">✏️</div>
      <div class="big">Drag to draw pipe runs</div>
      <div class="small">Start from the meter (left side) and draw to each appliance location</div>
    </div>
  {/if}
</div>

<style>
  .canvas-wrap { flex: 1; position: relative; overflow: hidden; }
  .canvas { display: block; user-select: none; touch-action: none; }
  .canvas.draw { cursor: crosshair; }
  .canvas.appliance { cursor: cell; }
  .canvas.erase { cursor: not-allowed; }
  .seg { cursor: pointer; }

  .editor {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 100;
    background: white;
    border: 2px solid var(--ch-orange);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 4px 20px rgba(255, 88, 21, 0.25);
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 160px;
  }
  .row { display: flex; align-items: center; gap: 8px; }
  .editor input {
    width: 90px; padding: 6px 10px; font: inherit; font-size: 14px; font-weight: 700;
    border: 1.5px solid var(--ch-orange-pale); border-radius: 7px; text-align: center;
  }
  .unit { font-size: 13px; font-weight: 700; color: var(--ch-orange); }
  .ok { background: var(--ch-orange); color: white; border: none; border-radius: 7px; padding: 6px 12px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .del { background: none; border: 1.5px solid var(--ch-orange-pale); border-radius: 7px; padding: 5px 9px; color: var(--ch-orange); font-weight: 700; font-size: 13px; cursor: pointer; line-height: 1; }
  .err { font-size: 10px; color: #dc2626; font-weight: 600; align-self: flex-start; }
  .ext { width: 100%; margin-top: 2px; padding: 6px 8px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 7px; border: 1.5px solid var(--ch-gray-300); background: white; color: var(--ch-gray-600); }
  .ext.on { border-color: #2563eb; background: #eff6ff; color: #2563eb; }

  .empty { position: absolute; top: 50%; left: 55%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
  .empty .emoji { font-size: 40px; margin-bottom: 10px; }
  .empty .big { font-weight: 700; color: #bbb; font-size: 15px; }
  .empty .small { font-size: 12px; color: #ccc; margin-top: 4px; max-width: 280px; }
</style>
