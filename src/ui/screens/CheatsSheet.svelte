<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Toggle from '../components/Toggle.svelte';
  import type { CheatItem } from '../../storage/CheatStore';

  let {
    open,
    cheats,
    supported,
    onadd,
    ontoggle,
    onremove,
    onclose,
  }: {
    open: boolean;
    cheats: CheatItem[];
    supported: boolean;
    onadd: (name: string, code: string) => string | null; // trả về lỗi hoặc null
    ontoggle: (id: string, enabled: boolean) => void;
    onremove: (id: string) => void;
    onclose: () => void;
  } = $props();

  let name = $state('');
  let code = $state('');
  let error = $state('');

  function add() {
    const err = onadd(name.trim(), code);
    error = err ?? '';
    if (!err) {
      name = '';
      code = '';
    }
  }
</script>

<Sheet {open} title="Cheat code" {onclose}>
  {#if !supported}
    <p class="footnote">
      Nhân giả lập hiện tại chưa hỗ trợ cheat. Hãy build lại Wasm (GitHub Actions) rồi chép
      mgba_libretro.js / .wasm mới vào public/cores/mgba/.
    </p>
  {/if}

  {#if cheats.length}
    <div class="group">
      {#each cheats as c (c.id)}
        <div class="row">
          <span class="label">
            {c.name || 'Cheat'}
            <small class="cheat-code">{c.code.trim().replace(/\s+/g, ' ')}</small>
          </span>
          <button class="iconbtn" onclick={() => onremove(c.id)} aria-label="Xoá cheat">
            <Icon name="trash" size={18} />
          </button>
          <Toggle checked={c.enabled} label={c.name || 'Cheat'} onchange={(v) => ontoggle(c.id, v)} />
        </div>
      {/each}
    </div>
  {:else}
    <p class="footnote">Chưa có cheat nào cho game này.</p>
  {/if}

  <h3 class="group-title">Thêm cheat</h3>
  <div class="cheat-form">
    <input class="field" placeholder="Tên (vd. Vô hạn tiền)" bind:value={name} maxlength="60" />
    <textarea
      class="field"
      rows="4"
      placeholder={'Mã GameShark / Action Replay, mỗi dòng một mã\nvd: 82025840 0063'}
      bind:value={code}
      spellcheck="false"
      autocapitalize="characters"
    ></textarea>
    {#if error}<p class="cheat-err">{error}</p>{/if}
    <button class="btn primary" onclick={add}>Thêm cheat</button>
  </div>
  <p class="footnote">
    Bật cheat có tác dụng ngay. Mã sai cho game có thể làm hỏng save, hãy lưu state trước khi thử.
  </p>
</Sheet>
