<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import type { SystemButton } from '../../systems/types';
  import type { JoypadId } from '../../systems/libretro';
  import type { Mappings } from '../../input/mappings';
  import { keyName } from '../format';

  let {
    open,
    buttons,
    mappings,
    capturingFor,
    padNames,
    onremap,
    onreset,
    onclose,
  }: {
    open: boolean;
    buttons: SystemButton[];
    mappings: Mappings | null;
    capturingFor: JoypadId | null;
    padNames: string[];
    onremap: (b: JoypadId) => void;
    onreset: () => void;
    onclose: () => void;
  } = $props();

  function describe(id: JoypadId): string {
    const keys = (mappings?.keyboard[id] ?? []).map(keyName);
    const pads = (mappings?.gamepad[id] ?? []).map((i) => 'Nút ' + i);
    return [...keys, ...pads].join(', ') || '—';
  }
</script>

<Sheet {open} title="Bàn phím & tay cầm" {onclose}>
  <p class="footnote" style="margin-top: 4px">
    Tay cầm: {padNames.length ? padNames.join(' · ') : 'chưa phát hiện (cắm và bấm một nút để nhận)'}.
    Bấm "Gán" rồi nhấn phím hoặc nút tay cầm mới. Esc để huỷ.
  </p>
  <div class="group" style="margin-top: 14px">
    {#each buttons as b (b.id)}
      <div class="keyrow">
        <div class="k">
          <b>{b.label}</b>
          <span>{capturingFor === b.id ? 'Đang chờ phím…' : describe(b.id)}</span>
        </div>
        <button class="btn small" onclick={() => onremap(b.id)} disabled={capturingFor !== null}>
          Gán
        </button>
      </div>
    {/each}
  </div>
  <div style="margin-top: 16px">
    <button class="btn" onclick={onreset}>Khôi phục mặc định</button>
  </div>
</Sheet>
