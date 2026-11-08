<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Toggle from '../components/Toggle.svelte';
  import type { UiSettings } from '../types';

  let {
    open,
    settings,
    onchange,
    onclose,
    onkeys,
    ondata,
    onedit,
    ondeleteall,
  }: {
    open: boolean;
    settings: UiSettings;
    onchange: (patch: Partial<UiSettings>) => void;
    onclose: () => void;
    onkeys: () => void;
    ondata: () => void;
    onedit: () => void;
    ondeleteall: () => void;
  } = $props();
</script>

<Sheet {open} title="Cài đặt" {onclose}>
  <h3 class="group-title">Âm thanh</h3>
  <div class="group">
    <div class="row">
      <span class="ico"><Icon name="volume" /></span>
      <span class="label">Bật âm thanh</span>
      <Toggle checked={settings.sound} label="Bật âm thanh" onchange={(v) => onchange({ sound: v })} />
    </div>
  </div>

  <h3 class="group-title">Điều khiển</h3>
  <div class="group">
    <div class="row">
      <span class="ico"><Icon name="pointer" /></span>
      <span class="label">Ẩn nút ảo</span>
      <Toggle checked={settings.hidePad} label="Ẩn nút ảo" onchange={(v) => onchange({ hidePad: v })} />
    </div>
    <div class="row">
      <span class="ico"><Icon name="phone" /></span>
      <span class="label">Rung khi nhấn nút</span>
      <Toggle checked={settings.vibrate} label="Rung khi nhấn nút" onchange={(v) => onchange({ vibrate: v })} />
    </div>
    <button class="row" onclick={onedit}>
      <span class="ico"><Icon name="move" /></span>
      <span class="label">Tùy chỉnh vị trí &amp; kích thước nút ảo</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
    <button class="row" onclick={onkeys}>
      <span class="ico"><Icon name="keyboard" /></span>
      <span class="label">Bàn phím &amp; tay cầm</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
  </div>

  <h3 class="group-title">Dữ liệu</h3>
  <div class="group">
    <button class="row" onclick={ondata}>
      <span class="ico"><Icon name="database" /></span>
      <span class="label">Sao lưu &amp; khôi phục</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
    <button class="row danger" onclick={ondeleteall}>
      <span class="ico"><Icon name="trash" /></span>
      <span class="label">Xóa hết game (kèm Save State &amp; .sav)</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
  </div>

  <p class="footnote">
    Tay cầm ngoài sẽ tự nhận khi cắm USB hoặc kết nối Bluetooth. Tất cả dữ liệu nằm trong trình
    duyệt này; hãy dùng Sao lưu để chuyển sang máy khác.
  </p>
</Sheet>
