<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Toggle from '../components/Toggle.svelte';
  import type { UiSettings } from '../types';
  import type { FilterMode, ScaleMode } from '../../render/types';

  let {
    open,
    speed,
    settings,
    onspeed,
    onchange,
    onreset,
    onstates,
    oncheats,
    onkeys,
    oneditlayout,
    onexit,
    onclose,
  }: {
    open: boolean;
    speed: number;
    settings: UiSettings;
    onspeed: (v: number) => void;
    onchange: (patch: Partial<UiSettings>) => void;
    onreset: () => void;
    onstates: () => void;
    oncheats: () => void;
    onkeys: () => void;
    oneditlayout: () => void;
    onexit: () => void;
    onclose: () => void;
  } = $props();

  const SPEEDS = [0.5, 1, 1.5, 2, 3, 4];
  const SCALES: { key: ScaleMode; label: string }[] = [
    { key: 'fit', label: 'Vừa khung' },
    { key: 'integer', label: 'Số nguyên' },
    { key: 'fill', label: 'Lấp đầy' },
    { key: 'wide', label: '4:3' },
  ];
  const FILTERS: { key: FilterMode; label: string }[] = [
    { key: 'sharp', label: 'Pixel thô' },
    { key: 'crisp', label: 'Sắc mượt' },
    { key: 'smooth', label: 'Làm mượt' },
    { key: 'lcd', label: 'LCD' },
    { key: 'crt', label: 'CRT' },
  ];
</script>

<Sheet {open} title="Menu" {onclose}>
  <div style="margin-top: 8px">
    <button class="btn primary" style="width: 100%" onclick={onclose}>
      <Icon name="play" size={18} /> Tiếp tục chơi
    </button>
  </div>

  <h3 class="group-title">Trò chơi</h3>
  <div class="group">
    <button class="row" onclick={onstates}>
      <span class="ico"><Icon name="save" /></span>
      <span class="label">Save state</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
    <button class="row" onclick={oncheats}>
      <span class="ico"><Icon name="star" /></span>
      <span class="label">Cheat code</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
    <button class="row" onclick={onreset}>
      <span class="ico"><Icon name="reset" /></span>
      <span class="label">Reset game</span>
    </button>
    <button class="row" onclick={onexit}>
      <span class="ico"><Icon name="logout" /></span>
      <span class="label">Thoát về Thư viện</span>
    </button>
  </div>

  <h3 class="group-title">Tốc độ game</h3>
  <div class="group">
    <div class="chips">
      {#each SPEEDS as v (v)}
        <button class="chip" class:on={speed === v} onclick={() => onspeed(v)}>{v}×</button>
      {/each}
    </div>
  </div>

  <h3 class="group-title">Hình ảnh</h3>
  <div class="group">
    <p class="chip-label">Co giãn màn hình</p>
    <div class="chips tight">
      {#each SCALES as s (s.key)}
        <button class="chip" class:on={settings.scale === s.key} onclick={() => onchange({ scale: s.key })}>
          {s.label}
        </button>
      {/each}
    </div>
    <p class="chip-label">Bộ lọc</p>
    <div class="chips tight">
      {#each FILTERS as f (f.key)}
        <button class="chip" class:on={settings.filter === f.key} onclick={() => onchange({ filter: f.key })}>
          {f.label}
        </button>
      {/each}
    </div>
  </div>

  <h3 class="group-title">Âm thanh &amp; điều khiển</h3>
  <div class="group">
    <div class="row">
      <span class="ico"><Icon name="volume" /></span>
      <span class="label">Bật âm thanh</span>
      <Toggle checked={settings.sound} label="Bật âm thanh" onchange={(v) => onchange({ sound: v })} />
    </div>
    <div class="row">
      <span class="ico"><Icon name="pointer" /></span>
      <span class="label">Hiện nút ảo</span>
      <Toggle checked={!settings.hidePad} label="Hiện nút ảo" onchange={(v) => onchange({ hidePad: !v })} />
    </div>
    <div class="row">
      <span class="ico"><Icon name="lock" /></span>
      <span class="label">Giữ nút<br /><span class="hint">Chạm một lần để giữ, chạm lần nữa để nhả</span></span>
      <Toggle checked={settings.sticky} label="Giữ nút" onchange={(v) => onchange({ sticky: v })} />
    </div>
    <button class="row" onclick={oneditlayout}>
      <span class="ico"><Icon name="move" /></span>
      <span class="label">Chỉnh vị trí &amp; kích thước nút ảo</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
    <button class="row" onclick={onkeys}>
      <span class="ico"><Icon name="keyboard" /></span>
      <span class="label">Bàn phím &amp; tay cầm</span>
      <span class="chev"><Icon name="chevron-right" /></span>
    </button>
    <div class="row">
      <span class="ico"><Icon name="eye" /></span>
      <span class="label">Hiện thông số (FPS, âm thanh)</span>
      <Toggle checked={settings.showStats} label="Hiện thông số" onchange={(v) => onchange({ showStats: v })} />
    </div>
  </div>
</Sheet>
