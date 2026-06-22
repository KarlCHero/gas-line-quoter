<script>
  // Raw white-stroke glyph for a 20×20 viewBox — drop inside an <svg> or <g>.
  let { typeId } = $props();
  const sw = 'stroke: white; stroke-width: 1.6; fill: none; stroke-linecap: round;';
</script>

{#if typeId === 'cooktop'}
  <circle cx="10" cy="10" r="6.5" style={sw} />
  <circle cx="10" cy="10" r="3" style={sw} />
  <line x1="10" y1="3.5" x2="10" y2="7" style={sw} />
  <line x1="10" y1="13" x2="10" y2="16.5" style={sw} />
  <line x1="3.5" y1="10" x2="7" y2="10" style={sw} />
  <line x1="13" y1="10" x2="16.5" y2="10" style={sw} />
{:else if typeId === 'freestanding_cooker'}
  <rect x="3" y="8" width="14" height="9" rx="1.5" style={sw} />
  <rect x="6" y="10.5" width="8" height="4" rx="0.8" style="stroke: white; stroke-width: 1.3; fill: none;" />
  <circle cx="7.5" cy="5" r="1.8" style={sw} />
  <circle cx="12.5" cy="5" r="1.8" style={sw} />
{:else if typeId === 'wall_heater'}
  <path d="M5,15.5 Q4,13 5,10.5 Q6,8 5,5.5" style={sw} />
  <path d="M10,15.5 Q9,13 10,10.5 Q11,8 10,5.5" style={sw} />
  <path d="M15,15.5 Q14,13 15,10.5 Q16,8 15,5.5" style={sw} />
{:else if typeId === 'ducted_heater'}
  <rect x="3" y="5" width="14" height="10" rx="2" style={sw} />
  <line x1="3" y1="8" x2="17" y2="8" style="stroke: white; stroke-width: 1.3; stroke-linecap: round;" />
  <line x1="3" y1="10.5" x2="17" y2="10.5" style="stroke: white; stroke-width: 1.3; stroke-linecap: round;" />
  <line x1="3" y1="13" x2="17" y2="13" style="stroke: white; stroke-width: 1.3; stroke-linecap: round;" />
{:else if typeId === 'storage_hws'}
  <rect x="6" y="2" width="8" height="13" rx="3" style={sw} />
  <line x1="8" y1="15" x2="7" y2="18" style={sw} />
  <line x1="12" y1="15" x2="13" y2="18" style={sw} />
  <line x1="7" y1="18" x2="13" y2="18" style={sw} />
{:else if typeId === 'instant_hws'}
  <rect x="7.5" y="2" width="5" height="7" rx="1.2" style={sw} />
  <line x1="4.5" y1="5.5" x2="7.5" y2="5.5" style={sw} />
  <path d="M10,9 L10,12 C9,13 9,15.5 10,16 C11,15.5 11,13 10,12" style={sw} />
{:else}
  <circle cx="10" cy="10" r="5" style={sw} />
{/if}
