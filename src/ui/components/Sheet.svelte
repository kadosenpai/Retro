<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    open,
    title,
    onclose,
    children,
  }: { open: boolean; title: string; onclose: () => void; children?: Snippet } = $props();

  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div class="sheet glass" role="dialog" aria-modal="true" aria-label={title}>
      <div class="sheet-head">
        <h2>{title}</h2>
        <button class="iconbtn solid" onclick={onclose} aria-label="Đóng"><Icon name="x" /></button>
      </div>
      <div class="sheet-body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
