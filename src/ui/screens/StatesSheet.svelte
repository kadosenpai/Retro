<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import type { StateRecord } from '../../storage/SaveStore';

  let {
    open,
    slots,
    thumbUrls,
    onsave,
    onload,
    onclose,
  }: {
    open: boolean;
    slots: (StateRecord | null)[];
    thumbUrls: (string | null)[];
    onsave: (i: number) => void;
    onload: (i: number) => void;
    onclose: () => void;
  } = $props();
</script>

<Sheet {open} title="Save state" {onclose}>
  <div class="slots">
    {#each slots as rec, i (i)}
      <div class="slot">
        {#if thumbUrls[i]}
          <img src={thumbUrls[i]} alt="Ô {i + 1}" />
        {:else}
          <div class="blank">{rec ? 'Không có ảnh' : 'Trống'}</div>
        {/if}
        <div class="when">
          Ô {i + 1}{rec ? ' · ' + new Date(rec.createdAt).toLocaleString() : ''}
        </div>
        <div class="btns">
          <button class="btn small primary" onclick={() => onsave(i)}>Lưu</button>
          <button class="btn small" onclick={() => onload(i)} disabled={!rec}>Nạp</button>
        </div>
      </div>
    {/each}
  </div>
</Sheet>
