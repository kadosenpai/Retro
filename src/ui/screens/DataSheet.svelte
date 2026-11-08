<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';

  let {
    open,
    onexport,
    onimport,
    onclose,
  }: {
    open: boolean;
    onexport: () => void;
    onimport: (ev: Event) => void;
    onclose: () => void;
  } = $props();

  let fileInput = $state<HTMLInputElement>();
</script>

<Sheet {open} title="Sao lưu" {onclose}>
  <p class="footnote" style="margin-top: 4px">
    Xuất save game, save state và cài đặt của mọi game ra một file (không gồm ROM). Để dùng trên
    máy khác: thêm đúng ROM đó, rồi nhập file này. Muốn lấy file .sav của riêng một game, hãy dùng
    menu ⋯ của game trong Thư viện.
  </p>
  <div class="group" style="margin-top: 16px">
    <button class="row" onclick={onexport}>
      <span class="ico"><Icon name="download" /></span>
      <span class="label">Xuất dữ liệu</span>
    </button>
    <button class="row" onclick={() => fileInput?.click()}>
      <span class="ico"><Icon name="upload" /></span>
      <span class="label">Nhập dữ liệu</span>
    </button>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept=".json,application/json"
    hidden
    onchange={onimport}
  />
</Sheet>
