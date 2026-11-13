<script lang="ts">
  import Icon from '../components/Icon.svelte';

  let {
    canvas = $bindable(),
    padBox = $bindable(),
    active,
    landscape,
    hidePad,
    showStats,
    fps,
    rendererName,
    audioMode,
    audioFillMs,
    underruns,
    editing,
    orient,
    hasSelection,
    selScale,
    onmenu,
    onscaleinput,
    onscalecommit,
    onresetlayout,
    onfinishedit,
  }: {
    canvas?: HTMLCanvasElement;
    padBox?: HTMLDivElement;
    active: boolean;
    landscape: boolean;
    hidePad: boolean;
    showStats: boolean;
    fps: number;
    rendererName: string;
    audioMode: string;
    audioFillMs: number | null;
    underruns: number;
    editing: boolean;
    orient: 'portrait' | 'landscape';
    hasSelection: boolean;
    selScale: number;
    onmenu: () => void;
    onscaleinput: (e: Event) => void;
    onscalecommit: () => void;
    onresetlayout: () => void;
    onfinishedit: () => void;
  } = $props();
</script>

<!-- Luôn nằm trong DOM (chỉ ẩn khi không active) để canvas giữ nguyên cho Worker. -->
<section class="play" class:land={landscape} class:gone={!active}>
  <div class="screen-region">
    <canvas bind:this={canvas} width="240" height="160"></canvas>
  </div>

  {#if showStats}
    <p class="hud">
      {fps.toFixed(1)} fps · {rendererName} · {audioMode}{#if audioFillMs !== null}
        · đệm {audioFillMs.toFixed(0)} ms · vỡ tiếng {underruns}{/if}
    </p>
  {/if}

  <div class="pad" class:off={hidePad && !editing} bind:this={padBox}></div>

  {#if hidePad && !editing}
    <button class="iconbtn solid menu-fab" onclick={onmenu} aria-label="Menu">
      <Icon name="menu" />
    </button>
  {/if}

  {#if editing}
    <div class="editbar glass">
      <div class="et">Chỉnh nút ảo · màn hình {orient === 'landscape' ? 'ngang' : 'dọc'}</div>
      <div class="ehint">
        {hasSelection
          ? 'Kéo nút để di chuyển. Dùng thanh trượt để đổi kích thước.'
          : 'Chạm vào một nút để chọn, rồi kéo để di chuyển.'}
      </div>
      <input
        class="slider"
        type="range"
        min="50"
        max="200"
        value={Math.round(selScale * 100)}
        disabled={!hasSelection}
        aria-label="Kích thước"
        oninput={onscaleinput}
        onchange={onscalecommit}
      />
      <div class="erow">
        <button class="btn small" onclick={onresetlayout}>Mặc định</button>
        <button class="btn small primary" onclick={onfinishedit}>Xong</button>
      </div>
    </div>
  {/if}
</section>
