<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import type { RomInfo } from '../../storage/RomLibrary';
  import type { SortKey } from '../types';
  import { coverStyle, initials, lastPlayedText, sizeText } from '../format';

  let {
    roms,
    currentRomId,
    coverUrls,
    sort,
    onsort,
    onopen,
    onadd,
    onsettings,
    onmore,
  }: {
    roms: RomInfo[];
    currentRomId: string | null;
    coverUrls: Record<string, string>;
    sort: SortKey;
    onsort: (s: SortKey) => void;
    onopen: (r: RomInfo) => void;
    onadd: () => void;
    onsettings: () => void;
    onmore: (r: RomInfo) => void;
  } = $props();

  let query = $state('');
  let menuOpen = $state(false);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'recent', label: 'Chơi gần đây' },
    { key: 'name', label: 'Tên A–Z' },
    { key: 'size', label: 'Dung lượng' },
  ];

  let shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? roms.filter((r) => r.name.toLowerCase().includes(q) || r.id.startsWith(q))
      : [...roms];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    else if (sort === 'size') list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt));
    return list;
  });
</script>

<header class="topbar">
  <div class="left">
    <button class="iconbtn" onclick={onsettings} aria-label="Cài đặt"><Icon name="settings" /></button>
    <button
      class="iconbtn"
      class:active={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}
      aria-label="Sắp xếp"
    >
      <Icon name="menu" />
    </button>
    {#if menuOpen}
      <button class="scrim" onclick={() => (menuOpen = false)} aria-label="Đóng menu"></button>
      <div class="popover">
        {#each SORTS as s (s.key)}
          <button
            onclick={() => {
              onsort(s.key);
              menuOpen = false;
            }}
          >
            <span class="tick"><Icon name={sort === s.key ? 'check' : 'minus'} size={20} /></span>
            {s.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <h1 class="title">Thư viện</h1>
  <div class="right">
    <button class="iconbtn" onclick={onadd} aria-label="Thêm ROM"><Icon name="plus" size={26} /></button>
  </div>
</header>

<label class="search glass">
  <Icon name="search" size={20} />
  <input type="search" placeholder="Tìm tên ROM hoặc mã ID..." bind:value={query} />
</label>

<div class="section-head">
  <Icon name="layers" size={20} />
  <span class="label">Kệ băng của bạn</span>
  <span class="count">({shown.length} băng)</span>
  <span class="spacer"></span>
  <span class="sorticon"><Icon name="sort" size={20} /></span>
  <select
    class="select"
    value={sort}
    onchange={(e) => onsort(e.currentTarget.value as SortKey)}
    aria-label="Sắp xếp"
  >
    {#each SORTS as s (s.key)}
      <option value={s.key}>{s.label}</option>
    {/each}
  </select>
</div>

<div class="list">
  {#if roms.length === 0}
    <div class="empty glass">
      <Icon name="layers" size={34} />
      <h3>Chưa có băng nào</h3>
      <p>Bấm dấu + để thêm file ROM .gba của bạn. ROM chỉ được lưu trong trình duyệt này.</p>
      <button class="btn primary" onclick={onadd}><Icon name="plus" size={18} /> Thêm ROM</button>
    </div>
  {:else if shown.length === 0}
    <div class="empty glass">
      <h3>Không tìm thấy</h3>
      <p>Không có băng nào khớp "{query}".</p>
    </div>
  {/if}

  {#each shown as r (r.id)}
    <div class="card glass" class:cur={r.id === currentRomId}>
      <button class="card-main" onclick={() => onopen(r)}>
        {#if coverUrls[r.id]}
          <img class="cover" src={coverUrls[r.id]} alt="" />
        {:else}
          <span class="cover" style={coverStyle(r.id)}>{initials(r.name)}</span>
        {/if}
        <span class="meta">
          <span class="name">{r.name}</span>
          <span class="sub">
            {sizeText(r.size)} · {lastPlayedText(r)}{r.id === currentRomId ? ' · Đang chơi' : ''}
          </span>
        </span>
      </button>
      <button class="iconbtn" onclick={() => onmore(r)} aria-label="Tuỳ chọn"><Icon name="dots" /></button>
    </div>
  {/each}
</div>
