<script>
  import { GRID, METER_POS, PIPE_COLORS, APPLIANCE_ICONS, labelOf } from '$lib/calc/constants.js';
  import ApplianceGlyph from './ApplianceGlyph.svelte';

  // sized: optional [{id,size,length}] — when given, pipes are coloured by DN and
  // labelled with their size (Trades view). Otherwise a single brand-orange run.
  let { segs, apps, sized = null } = $props();

  const sizeOf = $derived(sized ? Object.fromEntries(sized.map((s) => [s.id, s.size])) : {});

  const bounds = $derived.by(() => {
    const allX = [METER_POS.x, ...segs.flatMap((s) => [s.x1, s.x2]), ...apps.map((a) => a.x)];
    const allY = [METER_POS.y, ...segs.flatMap((s) => [s.y1, s.y2]), ...apps.map((a) => a.y)];
    const pad = 52;
    const minX = Math.min(...allX) - pad, maxX = Math.max(...allX) + pad;
    const minY = Math.min(...allY) - pad, maxY = Math.max(...allY) + pad;
    const sc = Math.min(520 / ((maxX - minX) || 1), 340 / ((maxY - minY) || 1), 1.5);
    return { minX, maxX, minY, maxY, sc };
  });

  const tx = (x) => (x - bounds.minX) * bounds.sc;
  const ty = (y) => (y - bounds.minY) * bounds.sc;
  const W = $derived((bounds.maxX - bounds.minX) * bounds.sc);
  const H = $derived((bounds.maxY - bounds.minY) * bounds.sc);
  const legendSizes = $derived(sized ? [...new Set(sized.map((s) => s.size))].sort((a, b) => a - b) : []);
</script>

<svg width={W} height={H} viewBox="0 0 {W} {H}" class="diagram">
  <defs>
    <pattern id="tdg" x="0" y="0" width={GRID * bounds.sc} height={GRID * bounds.sc} patternUnits="userSpaceOnUse">
      <circle cx={(GRID * bounds.sc) / 2} cy={(GRID * bounds.sc) / 2} r="1.2" fill="#e5dfd6" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#tdg)" />

  {#each segs as s, i (s.id)}
    {@const sz = sizeOf[s.id]}
    {@const col = sz ? PIPE_COLORS[sz] || 'var(--ch-orange)' : 'var(--ch-orange)'}
    {@const mx = (tx(s.x1) + tx(s.x2)) / 2}
    {@const my = (ty(s.y1) + ty(s.y2)) / 2}
    {@const label = sized ? `S${i + 1} · DN${sz}${s.length ? ` · ${s.length}m` : ''}` : null}
    <line x1={tx(s.x1)} y1={ty(s.y1)} x2={tx(s.x2)} y2={ty(s.y2)} stroke={col} stroke-width="4" stroke-linecap="round" />
    {#if label}
      {@const bw = label.length * 5.5 + 10}
      <rect x={mx - bw / 2} y={my - 12} width={bw} height="20" rx="3" fill="white" stroke={col} stroke-width="1" />
      <text x={mx} y={my + 4} text-anchor="middle" font-size="9" font-weight="800" fill={col}>{label}</text>
    {/if}
  {/each}

  {#each apps as a (a.id)}
    {@const ic = APPLIANCE_ICONS[a.typeId] || { color: '#888' }}
    <g>
      <circle cx={tx(a.x)} cy={ty(a.y)} r="18" fill={ic.color} />
      <g transform="translate({tx(a.x) - 10},{ty(a.y) - 10})"><ApplianceGlyph typeId={a.typeId} /></g>
      <text x={tx(a.x)} y={ty(a.y) + 30} text-anchor="middle" font-size="8" font-weight="700" fill="#666">{labelOf(a).split(' ')[0]}</text>
    </g>
  {/each}

  <polygon
    points="{tx(METER_POS.x)},{ty(METER_POS.y) - 17} {tx(METER_POS.x) + 14},{ty(METER_POS.y) - 8} {tx(METER_POS.x) + 14},{ty(METER_POS.y) + 8} {tx(METER_POS.x)},{ty(METER_POS.y) + 17} {tx(METER_POS.x) - 14},{ty(METER_POS.y) + 8} {tx(METER_POS.x) - 14},{ty(METER_POS.y) - 8}"
    fill="var(--ch-orange)"
  />
  <text x={tx(METER_POS.x)} y={ty(METER_POS.y) + 2} text-anchor="middle" font-size="7" font-weight="800" fill="white">METER</text>
  <text x={tx(METER_POS.x)} y={ty(METER_POS.y) + 12} text-anchor="middle" font-size="7" fill="rgba(255,255,255,.75)">GAS</text>
</svg>

{#if legendSizes.length}
  <div class="legend">
    {#each legendSizes as sz}
      <div class="lg"><span class="sw" style="background:{PIPE_COLORS[sz]}"></span>DN{sz}</div>
    {/each}
  </div>
{/if}

<style>
  .diagram { display: block; margin: 0 auto; max-width: 100%; }
  .legend { display: flex; gap: 14px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
  .lg { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; color: #555; }
  .sw { width: 20px; height: 4px; border-radius: 2px; }
</style>
