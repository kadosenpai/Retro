<script lang="ts">
  let {
    checked,
    label,
    onchange,
  }: { checked: boolean; label: string; onchange: (v: boolean) => void } = $props();
</script>

<button
  class="toggle"
  class:on={checked}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => onchange(!checked)}
>
  <span></span>
</button>
