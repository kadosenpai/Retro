<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import type { RomInfo } from '../../storage/RomLibrary';

  let {
    rom,
    onexport,
    onimport,
    onrename,
    onautocover,
    onpickcover,
    ondelete,
    onclose,
  }: {
    rom: RomInfo | null;
    onexport: (r: RomInfo) => void;
    onimport: (r: RomInfo) => void;
    onrename: (r: RomInfo) => void;
    onautocover: (r: RomInfo) => void;
    onpickcover: (r: RomInfo) => void;
    ondelete: (r: RomInfo) => void;
    onclose: () => void;
  } = $props();
</script>

<Sheet open={rom !== null} title={rom?.name ?? ''} {onclose}>
  {#if rom}
    <div class="group" style="margin-top: 12px">
      <button class="row" onclick={() => rom && onexport(rom)}>
        <span class="ico"><Icon name="download" /></span>
        <span class="label">Xuất file .sav</span>
      </button>
      <button class="row" onclick={() => rom && onimport(rom)}>
        <span class="ico"><Icon name="upload" /></span>
        <span class="label">Nhập file .sav</span>
      </button>
      <button class="row" onclick={() => rom && onautocover(rom)}>
        <span class="ico"><Icon name="image" /></span>
        <span class="label">Tải ảnh bìa gốc</span>
      </button>
      <button class="row" onclick={() => rom && onpickcover(rom)}>
        <span class="ico"><Icon name="image" /></span>
        <span class="label">Chọn ảnh bìa từ máy</span>
      </button>
      <button class="row" onclick={() => rom && onrename(rom)}>
        <span class="ico"><Icon name="pencil" /></span>
        <span class="label">Đổi tên</span>
      </button>
      <button class="row danger" onclick={() => rom && ondelete(rom)}>
        <span class="ico"><Icon name="trash" /></span>
        <span class="label">Xoá băng (kèm save)</span>
      </button>
    </div>
  {/if}
</Sheet>
