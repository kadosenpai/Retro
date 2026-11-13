<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { formatBytes, type StorageInfo } from '../../storage/Persist';

  let {
    open,
    onexport,
    onimport,
    onclose,
    info = null,
    lastBackup = null,
    onpersist,
  }: {
    open: boolean;
    info?: StorageInfo | null;
    lastBackup?: number | null;
    onpersist: () => void;
    onexport: () => void;
    onimport: (ev: Event) => void;
    onclose: () => void;
  } = $props();

  let fileInput = $state<HTMLInputElement>();

  let lastText = $derived(
    lastBackup ? new Date(lastBackup).toLocaleString('vi-VN') : 'chưa sao lưu lần nào',
  );
  let persistText = $derived(
    info?.persisted === true
      ? 'Đã bảo vệ: trình duyệt sẽ không tự xoá dữ liệu khi thiếu chỗ.'
      : info?.persisted === false
        ? 'Chưa bảo vệ: trình duyệt có thể xoá dữ liệu khi máy thiếu bộ nhớ.'
        : 'Trình duyệt này không báo trạng thái lưu trữ.',
  );
</script>

<Sheet {open} title="Sao lưu" {onclose}>
  <p class="footnote" style="margin-top: 4px">
    Xuất save game, save state và cài đặt của mọi game ra một file (không gồm ROM). Để dùng trên
    máy khác: thêm đúng ROM đó, rồi nhập file này. Muốn lấy file .sav của riêng một game, hãy dùng
    menu ⋯ của game trong Thư viện.
  </p>
  <div class="group" style="margin-top: 16px">
    <div class="row static">
      <span class="label">
        Lần sao lưu gần nhất: {lastText}<br />
        <span class="footnote">
          Đã dùng {formatBytes(info?.used ?? null)} / {formatBytes(info?.quota ?? null)}. {persistText}
        </span>
      </span>
    </div>
    {#if info && info.persisted === false}
      <button class="row" onclick={onpersist}>
        <span class="ico"><Icon name="check" /></span>
        <span class="label">Bảo vệ dữ liệu khỏi bị xoá tự động</span>
      </button>
    {/if}
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
