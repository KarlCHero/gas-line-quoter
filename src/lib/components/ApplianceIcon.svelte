<script>
  import { APPLIANCE_ICONS } from '$lib/calc/constants.js';
  import ApplianceGlyph from './ApplianceGlyph.svelte';

  let { typeId, size = 32 } = $props();
  const ic = $derived(APPLIANCE_ICONS[typeId] || { color: '#888' });
</script>

<div
  class="disc"
  style="width:{size}px; height:{size}px; background:{ic.color};"
>
  <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 20 20">
    <ApplianceGlyph {typeId} />
  </svg>
</div>

<style>
  .disc {
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
</style>
