<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { gba } from './systems/gba';
  import { resolveCoreUrl } from './config';
  import type { JoypadId } from './systems/libretro';
  import { EmulatorHost } from './engine/EmulatorHost';
  import { InputManager } from './input/InputManager';
  import { TouchOverlay, type LayoutOverride } from './input/TouchOverlay';
  import type { Mappings } from './input/mappings';
  import {
    addRom,
    getRomData,
    listRoms,
    markPlayed,
    removeRom,
    renameRom,
    setCover,
    type RomInfo,
  } from './storage/RomLibrary';
  import {
    STATE_SLOTS,
    getStateRecord,
    listStateRecords,
    loadSram,
    saveSram,
    saveStateRecord,
    type StateRecord,
  } from './storage/SaveStore';
  import { getSetting, setSetting } from './storage/SettingsStore';
  import { makeThumbnail } from './storage/thumbnail';
  import { exportBackup, importBackup } from './storage/BackupService';
  import { downloadBytes, savFileName, validateSav } from './storage/SavFile';
  import { deleteCheats, loadCheats, saveCheats, validateCode, type CheatItem } from './storage/CheatStore';
  import { fetchBoxArt, toCoverBlob } from './storage/Covers';
  import { emptyLayouts, loadLayouts, saveLayouts, type SavedLayouts } from './storage/LayoutStore';
  import type { SortKey, UiSettings } from './ui/types';
  import Icon from './ui/components/Icon.svelte';
  import LibraryScreen from './ui/screens/LibraryScreen.svelte';
  import SettingsSheet from './ui/screens/SettingsSheet.svelte';
  import PlayMenu from './ui/screens/PlayMenu.svelte';
  import KeysSheet from './ui/screens/KeysSheet.svelte';
  import CheatsSheet from './ui/screens/CheatsSheet.svelte';
  import StatesSheet from './ui/screens/StatesSheet.svelte';
  import DataSheet from './ui/screens/DataSheet.svelte';
  import GameSheet from './ui/screens/GameSheet.svelte';

  type SheetName = 'settings' | 'menu' | 'keys' | 'data' | 'states' | 'cheats' | null;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const mqLandscape = window.matchMedia('(orientation: landscape) and (pointer: coarse)');

  // ---------- Trạng thái ----------
  let screen = $state<'library' | 'play'>('library');
  let sheet = $state<SheetName>(null);
  let sheetReturn = $state<SheetName>(null); // bảng quay về khi đóng bảng con
  let gameSheet = $state<RomInfo | null>(null);
  let landscapeTouch = $state(mqLandscape.matches);

  let canvas = $state<HTMLCanvasElement>();
  let padBox = $state<HTMLDivElement>();
  let addInput = $state<HTMLInputElement>();
  let savInput = $state<HTMLInputElement>();
  let coverInput = $state<HTMLInputElement>();
  let savTarget: RomInfo | null = null;
  let coverTarget: RomInfo | null = null;

  let ready = $state(false);
  let playing = $state(false);
  let menuWasPlaying = false;
  let speed = $state(1);
  let rendererName = $state('');
  let audioMode = $state('chưa bật');
  let fps = $state(0);
  let underruns = $state(0);
  let audioFillMs = $state<number | null>(null);

  let roms = $state<RomInfo[]>([]);
  let coverUrls = $state<Record<string, string>>({});
  let currentRomId = $state<string | null>(null);
  let slots = $state<(StateRecord | null)[]>(Array(STATE_SLOTS).fill(null));
  let thumbUrls = $state<(string | null)[]>(Array(STATE_SLOTS).fill(null));

  let cheats = $state<CheatItem[]>([]);
  let cheatsSupported = $state(true);

  let padNames = $state<string[]>([]);
  let mappings = $state<Mappings | null>(null);
  let capturingFor = $state<JoypadId | null>(null);

  // Chỉnh nút ảo
  let editing = $state(false);
  let editReturn: 'menu' | 'settings' = 'menu';
  let selectedCtrl = $state<string | null>(null);
  let layouts = $state<SavedLayouts>(emptyLayouts());
  let overlay: TouchOverlay | null = null;

  let settings = $state<UiSettings>({
    sound: true,
    volume: 80,
    // Máy cảm ứng: hiện nút ảo mặc định; máy tính: ẩn (dùng bàn phím).
    hidePad: !window.matchMedia('(pointer: coarse)').matches,
    vibrate: true,
    sticky: false,
    showStats: false,
    sort: 'recent',
  });

  let toastMsg = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  let host: EmulatorHost | null = null;
  let input: InputManager | null = null;

  let orient = $derived<'portrait' | 'landscape'>(landscapeTouch ? 'landscape' : 'portrait');
  let selScale = $derived(
    selectedCtrl ? (layouts[orient][selectedCtrl]?.scale ?? 1) : 1,
  );

  function toast(msg: string) {
    toastMsg = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastMsg = ''), 3800);
  }

  // ---------- Khởi động ----------
  onMount(() => {
    host = new EmulatorHost({
      onStats: (s) => {
        fps = s.fps;
        underruns = s.underruns;
        audioFillMs = s.audioFillMs;
      },
      onSram: (key, data) => {
        // Bỏ qua nếu ROM đã bị xoá khỏi thư viện (tránh tạo lại dữ liệu mồ côi).
        if (!roms.some((r) => r.id === key)) return;
        saveSram(key, data).catch(() => {
          toast('Không lưu được dữ liệu game (bộ nhớ trình duyệt đầy hoặc bị chặn)');
        });
      },
      onNotice: (m) => toast(m),
      onState: async (s) => {
        try {
          const thumb = s.frame
            ? await makeThumbnail({
                width: s.frame.width,
                height: s.frame.height,
                format: s.frame.format,
                pixels: new Uint8Array(s.frame.pixels),
              })
            : null;
          await saveStateRecord(s.key, s.slot, s.data, thumb);
          toast(`Đã lưu vào ô ${s.slot + 1}`);
          if (s.key === currentRomId) await refreshSlots();
        } catch {
          toast('Không lưu được state (bộ nhớ trình duyệt đầy hoặc bị chặn)');
        }
      },
      onSnapshot: async (key, frame) => {
        if (!frame) return;
        const blob = await makeThumbnail({
          width: frame.width,
          height: frame.height,
          format: frame.format,
          pixels: new Uint8Array(frame.pixels),
        });
        if (blob && roms.some((r) => r.id === key)) {
          await setCover(key, blob, 'snap');
          await refreshRoms();
        }
      },
      onRenderer: (k) => (rendererName = k === 'webgl' ? 'WebGL' : 'Canvas 2D'),
      onError: (m) => {
        toast('Lỗi: ' + m);
        playing = false;
        screen = 'library';
      },
    });
    input = new InputManager(
      gba,
      (m) => host?.setInput(m),
      (names) => (padNames = names),
    );
    mappings = input.mappings;
    input.start();
    input.hydrate().then((m) => (mappings = m));

    getSetting<Partial<UiSettings>>('ui.settings')
      .then((v) => {
        if (v) settings = { ...settings, ...v };
      })
      .catch(() => {});
    loadLayouts(gba.id).then((l) => (layouts = l));
    refreshRoms();

    // Tự lưu SRAM mỗi 3 giây, và khi rời tab/đóng trang.
    const timer = setInterval(() => host?.flushSram(), 3000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') host?.flushSram();
    };
    const onOrient = () => (landscapeTouch = mqLandscape.matches);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    mqLandscape.addEventListener('change', onOrient);

    if (canvas) host.attachCanvas(canvas);
    resolveCoreUrl()
      .then((url) => host!.init(url))
      .then(() => (ready = true))
      .catch(() => {});

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      mqLandscape.removeEventListener('change', onOrient);
      input?.stop();
      host?.destroy();
    };
  });

  // Âm lượng theo cài đặt (chỉ bật/tắt).
  $effect(() => {
    host?.setVolume(settings.sound ? settings.volume / 100 : 0);
  });

  // Phím ảo: tạo khi đang ở màn chơi (hoặc đang chỉnh) và không bị ẩn.
  $effect(() => {
    const isEdit = editing;
    const o = orient;
    const vibrate = settings.vibrate;
    const sticky = settings.sticky;
    const show = screen === 'play' && (isEdit || !settings.hidePad);
    if (!show || !padBox || !input) return;
    const ov = untrack(
      () =>
        new TouchOverlay(padBox!, gba.input.touch, input!.setTouchMask, {
          orientation: o,
          vibrate,
          sticky,
          overrides: layouts[o],
          onMenu: openMenu,
          editor: isEdit
            ? { onChange: (id, v) => commitOverride(o, id, v), onSelect: (id) => (selectedCtrl = id) }
            : undefined,
          selected: selectedCtrl,
        }),
    );
    overlay = ov;
    return () => {
      ov.destroy();
      if (overlay === ov) overlay = null;
    };
  });

  function patchSettings(patch: Partial<UiSettings>) {
    settings = { ...settings, ...patch };
    setSetting('ui.settings', { ...settings }).catch(() => {});
  }

  // ---------- Âm thanh ----------
  // Phải chạy ngay trong thao tác bấm của người dùng thì trình duyệt mới cho phát tiếng.
  async function enableAudio() {
    if (!host) return;
    const mode = await host.enableAudio();
    host.setVolume(settings.sound ? settings.volume / 100 : 0);
    audioMode =
      mode === 'sab' ? 'SharedArrayBuffer' : mode === 'port' ? 'postMessage' : 'không khả dụng';
  }

  // ---------- Thư viện ----------
  async function refreshRoms() {
    try {
      const list = await listRoms(gba.id);
      const urls: Record<string, string> = {};
      for (const r of list) if (r.cover) urls[r.id] = URL.createObjectURL(r.cover);
      for (const u of Object.values(coverUrls)) URL.revokeObjectURL(u);
      coverUrls = urls;
      roms = list;
    } catch {
      /* IndexedDB không dùng được (vd. chế độ riêng tư): bỏ qua thư viện */
    }
  }

  async function refreshSlots() {
    const id = currentRomId;
    const next: (StateRecord | null)[] = Array(STATE_SLOTS).fill(null);
    const urls: (string | null)[] = Array(STATE_SLOTS).fill(null);
    if (id) {
      try {
        for (const r of await listStateRecords(id)) {
          if (r.slot < 0 || r.slot >= STATE_SLOTS) continue;
          next[r.slot] = r;
          urls[r.slot] = r.thumb ? URL.createObjectURL(r.thumb) : null;
        }
      } catch {
        /* bỏ qua */
      }
    }
    for (const u of thumbUrls) if (u) URL.revokeObjectURL(u);
    slots = next;
    thumbUrls = urls;
  }

  async function startGame(data: ArrayBuffer, romId: string | null) {
    if (!host) return;
    try {
      let sram: ArrayBuffer | undefined;
      if (romId) {
        try {
          sram = await loadSram(romId);
        } catch {
          /* đọc lỗi thì chơi như game mới */
        }
      }
      cheats = romId ? await loadCheats(romId).catch(() => []) : [];
      const info = await host.loadRom(data, {
        key: romId ?? undefined,
        sram,
        cheats: cheats.map((c) => ({ code: c.code, enabled: c.enabled })),
      });
      cheatsSupported = info.cheats !== false;
      host.setSpeed(speed);
      host.run();
      playing = true;
      currentRomId = romId;
      await refreshSlots();
      if (romId) {
        await markPlayed(romId);
        await refreshRoms();
      }
    } catch {
      /* thông báo lỗi đã được hiển thị qua onError */
    }
  }

  async function openRom(r: RomInfo) {
    await enableAudio();
    if (r.id === currentRomId) {
      // Game này đang được nạp (đã tạm dừng): chơi tiếp, không nạp lại.
      screen = 'play';
      host?.run();
      playing = true;
      return;
    }
    const data = await getRomData(r.id);
    if (!data) {
      toast('Không đọc được ROM đã lưu: ' + r.name);
      return;
    }
    screen = 'play';
    await startGame(data, r.id);
  }

  function pickRom() {
    enableAudio(); // trong thao tác bấm của người dùng
    addInput?.click();
  }

  async function onRomsPicked(ev: Event) {
    const el = ev.currentTarget as HTMLInputElement;
    const files = Array.from(el.files ?? []);
    el.value = '';
    if (!files.length || !host) return;
    const added: RomInfo[] = [];
    for (const f of files) {
      try {
        const info = await addRom(gba.id, f.name, await f.arrayBuffer());
        added.push(info);
        if (!info.cover) void autoCover(info, false); // tải ảnh bìa nền, không chặn
      } catch {
        toast('Không lưu được ' + f.name + ' vào thư viện');
      }
    }
    await refreshRoms();
    if (added.length === 1) await openRom(added[0]);
    else if (added.length > 1) toast(`Đã thêm ${added.length} băng`);
  }

  async function deleteRom(r: RomInfo) {
    if (!confirm(`Xoá "${r.name}" cùng save game và save state của nó?`)) return;
    gameSheet = null;
    await removeRom(r.id);
    deleteCheats(r.id).catch(() => {});
    if (currentRomId === r.id) {
      host?.pause();
      playing = false;
      currentRomId = null;
      await refreshSlots();
    }
    await refreshRoms();
  }

  async function deleteAll() {
    if (!confirm('Xoá TOÀN BỘ game cùng save game và save state? Không thể hoàn tác.')) return;
    host?.pause();
    playing = false;
    for (const r of roms) {
      await removeRom(r.id);
      deleteCheats(r.id).catch(() => {});
    }
    currentRomId = null;
    await refreshSlots();
    await refreshRoms();
    sheet = null;
    toast('Đã xoá hết game');
  }

  async function doRename(r: RomInfo) {
    const name = prompt('Tên mới cho băng này:', r.name);
    gameSheet = null;
    if (name && name.trim()) {
      await renameRom(r.id, name);
      await refreshRoms();
    }
  }

  // ---------- Ảnh bìa ----------
  /** Tải ảnh bìa gốc theo tên file. `report`: báo kết quả cho người dùng. */
  async function autoCover(r: RomInfo, report: boolean) {
    const art = await fetchBoxArt(gba.id, r.fileBase ?? r.name);
    if (art) {
      await setCover(r.id, art, 'art');
      await refreshRoms();
      if (report) toast(`Đã tải ảnh bìa cho "${r.name}"`);
    } else if (report) {
      toast('Không tìm thấy ảnh bìa gốc (tên file khác chuẩn, hoặc không có mạng). Bạn có thể chọn ảnh từ máy.');
    }
  }

  function pickCover(r: RomInfo) {
    coverTarget = r;
    gameSheet = null;
    coverInput?.click();
  }

  async function onCoverPicked(ev: Event) {
    const el = ev.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    const r = coverTarget;
    if (!file || !r) return;
    const blob = await toCoverBlob(file);
    if (!blob) {
      toast('Không đọc được file ảnh này');
      return;
    }
    await setCover(r.id, blob, 'user');
    await refreshRoms();
    toast('Đã đổi ảnh bìa');
  }

  /** Chụp khung hình làm ảnh bìa nếu game chưa có ảnh bìa tốt hơn. */
  function snapshotCoverIfNeeded() {
    const cur = roms.find((r) => r.id === currentRomId);
    if (cur && (!cur.cover || cur.coverKind === 'snap')) host?.requestSnapshot(cur.id);
  }

  // ---------- Điều khiển màn chơi ----------
  function openMenu() {
    if (sheet === 'menu' || editing || screen !== 'play') return;
    menuWasPlaying = playing;
    if (playing) {
      host?.pause(); // pause cũng lưu SRAM
      playing = false;
    }
    sheet = 'menu';
  }

  function closeMenu() {
    sheet = null;
    sheetReturn = null;
    if (menuWasPlaying && screen === 'play' && currentRomId) {
      host?.run();
      playing = true;
    }
    menuWasPlaying = false;
  }

  function backToLibrary() {
    snapshotCoverIfNeeded();
    host?.pause();
    playing = false;
    menuWasPlaying = false;
    sheet = null;
    screen = 'library';
  }

  function resetGame() {
    host?.reset();
    closeMenu();
  }

  function setGameSpeed(v: number) {
    speed = v;
    host?.setSpeed(v);
  }

  // Esc mở menu khi đang chơi (nhất là khi nút ảo bị ẩn).
  function onWindowKey(e: KeyboardEvent) {
    host?.resumeAudio();
    if (e.key === 'Escape' && screen === 'play' && !sheet && !editing) openMenu();
  }

  // ---------- Chỉnh nút ảo ----------
  function startEdit(from: 'menu' | 'settings') {
    editReturn = from;
    sheet = null;
    selectedCtrl = null;
    if (from === 'settings') {
      screen = 'play'; // chưa có game vẫn chỉnh được trên màn chơi trống
    }
    editing = true;
  }

  function commitOverride(o: 'portrait' | 'landscape', id: string, v: LayoutOverride) {
    layouts = { ...layouts, [o]: { ...layouts[o], [id]: v } };
    saveLayouts(gba.id, layouts).catch(() => {});
  }

  function onScaleInput(e: Event) {
    if (!selectedCtrl) return;
    overlay?.setScale(selectedCtrl, Number((e.currentTarget as HTMLInputElement).value) / 100);
  }

  function onScaleCommit() {
    if (!selectedCtrl || !overlay) return;
    const v = overlay.getOverride(selectedCtrl);
    if (v) commitOverride(orient, selectedCtrl, v);
  }

  function resetLayout() {
    layouts = { ...layouts, [orient]: {} };
    saveLayouts(gba.id, layouts).catch(() => {});
    overlay?.setOverrides({});
    selectedCtrl = null;
    overlay?.setSelected(null);
  }

  function finishEdit() {
    editing = false;
    selectedCtrl = null;
    if (editReturn === 'settings') {
      screen = 'library';
      sheet = 'settings';
    } else {
      sheet = 'menu';
    }
  }

  // ---------- Cheat ----------
  function pushCheats() {
    host?.setCheats(cheats.map((c) => ({ code: c.code, enabled: c.enabled })));
    if (currentRomId) saveCheats(currentRomId, cheats).catch(() => {});
  }

  function addCheat(name: string, code: string): string | null {
    const err = validateCode(code);
    if (err) return err;
    const id = crypto.randomUUID();
    cheats = [...cheats, { id, name: name || `Cheat ${cheats.length + 1}`, code: code.trim(), enabled: true }];
    pushCheats();
    return null;
  }

  function toggleCheat(id: string, enabled: boolean) {
    cheats = cheats.map((c) => (c.id === id ? { ...c, enabled } : c));
    pushCheats();
  }

  function removeCheat(id: string) {
    cheats = cheats.filter((c) => c.id !== id);
    pushCheats();
  }

  // ---------- Save state ----------
  function saveToSlot(slot: number) {
    if (!host || !currentRomId) return;
    host.saveState(currentRomId, slot);
  }

  async function loadFromSlot(slot: number) {
    if (!host || !currentRomId) return;
    const rec = await getStateRecord(currentRomId, slot);
    if (!rec) return;
    const ok = await host.loadState(rec.data.slice(0));
    if (ok) {
      host.run();
      playing = true;
      menuWasPlaying = false;
      sheet = null;
      sheetReturn = null;
      toast(`Đã nạp ô ${slot + 1}`);
    } else {
      toast('Không nạp được state này');
    }
  }

  // ---------- .sav của từng game ----------
  async function exportSav(r: RomInfo) {
    gameSheet = null;
    try {
      if (r.id === currentRomId) {
        host?.flushSram(); // lấy dữ liệu mới nhất từ game đang nạp
        await sleep(300);
      }
      const data = await loadSram(r.id);
      if (!data) {
        toast(`"${r.name}" chưa có dữ liệu lưu. Hãy lưu trong game (menu Save) rồi thử lại.`);
        return;
      }
      downloadBytes(data, savFileName(r.name));
      toast(`Đã xuất ${savFileName(r.name)} (${data.byteLength} byte)`);
    } catch {
      toast('Xuất .sav thất bại');
    }
  }

  function pickSav(r: RomInfo) {
    savTarget = r;
    gameSheet = null;
    savInput?.click();
  }

  async function onSavPicked(ev: Event) {
    const el = ev.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    const r = savTarget;
    if (!file || !r || !host) return;
    try {
      const buf = await file.arrayBuffer();
      const err = validateSav(buf);
      if (err) {
        toast('Nhập .sav thất bại: ' + err);
        return;
      }
      const loaded = r.id === currentRomId;
      if (loaded) {
        host.pause(); // pause tự lưu SRAM hiện tại; chờ ghi xong để không ghi đè dữ liệu vừa nhập
        playing = false;
        await sleep(300);
      }
      const old = await loadSram(r.id);
      const note =
        old && old.byteLength !== buf.byteLength
          ? ` (khác kích thước save hiện tại: ${old.byteLength} byte)`
          : '';
      if (old && !confirm(`Ghi đè dữ liệu lưu của "${r.name}" bằng file ${file.name}?${note}`)) {
        if (loaded && screen === 'play') {
          host.run();
          playing = true;
        }
        return;
      }
      await saveSram(r.id, buf);
      toast(`Đã nhập ${file.name} cho "${r.name}"`);
      if (loaded) {
        const rom = await getRomData(r.id);
        if (rom) await startGame(rom, r.id); // nạp lại để game đọc save mới
        if (screen !== 'play') {
          host.pause();
          playing = false;
        }
      }
    } catch {
      toast('Nhập .sav thất bại');
    }
  }

  // ---------- Sao lưu toàn bộ ----------
  async function doExport() {
    try {
      const { blob, summary } = await exportBackup();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `retro-web-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast(`Đã xuất: ${summary.sram} save game, ${summary.states} save state`);
    } catch (e) {
      toast('Xuất thất bại: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function doImport(ev: Event) {
    const el = ev.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    try {
      const r = await importBackup(await file.text());
      let msg = `Đã nhập: ${r.sram} save game, ${r.states} save state.`;
      if (r.missingRoms.length) msg += ` Cần thêm lại ROM: ${r.missingRoms.join(', ')}.`;
      toast(msg);
      if (input) mappings = await input.hydrate();
      layouts = await loadLayouts(gba.id);
      await refreshSlots();
    } catch (e) {
      toast('Nhập thất bại: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // ---------- Gán phím ----------
  async function remap(button: JoypadId) {
    if (!input || capturingFor) return;
    capturingFor = button;
    const c = await input.capture();
    if (c) {
      input.assign(button, c);
      mappings = input.mappings;
    }
    capturingFor = null;
  }

  function resetMap() {
    if (!input) return;
    input.resetMappings();
    mappings = input.mappings;
  }

  // Mở bảng con từ Cài đặt hoặc từ Menu; đóng thì quay về nơi đã mở.
  function openChild(name: SheetName, from: SheetName) {
    sheetReturn = from;
    sheet = name;
  }
  function closeChild() {
    sheet = sheetReturn;
    sheetReturn = null;
  }
</script>

<svelte:window onpointerdown={() => host?.resumeAudio()} onkeydown={onWindowKey} />

<div class="shell" class:wide={landscapeTouch}>
  <!-- Thư viện -->
  <div class="gone-wrap" class:gone={screen !== 'library'}>
    <LibraryScreen
      {roms}
      {coverUrls}
      {currentRomId}
      sort={settings.sort}
      onsort={(s: SortKey) => patchSettings({ sort: s })}
      onopen={openRom}
      onadd={pickRom}
      onsettings={() => (sheet = 'settings')}
      onmore={(r) => (gameSheet = r)}
    />
  </div>

  <!-- Màn chơi (luôn nằm trong DOM để giữ canvas cho Worker) -->
  <section class="play" class:land={landscapeTouch} class:gone={screen !== 'play'}>
    <div class="screen-region">
      <canvas bind:this={canvas} width="240" height="160"></canvas>
    </div>

    {#if settings.showStats}
      <p class="hud">
        {fps.toFixed(1)} fps · {rendererName} · {audioMode}{#if audioFillMs !== null}
          · đệm {audioFillMs.toFixed(0)} ms · vỡ tiếng {underruns}{/if}
      </p>
    {/if}

    <div class="pad" class:off={settings.hidePad && !editing} bind:this={padBox}></div>

    {#if settings.hidePad && !editing}
      <button class="iconbtn solid menu-fab" onclick={openMenu} aria-label="Menu">
        <Icon name="menu" />
      </button>
    {/if}

    {#if editing}
      <div class="editbar glass">
        <div class="et">Chỉnh nút ảo · màn hình {orient === 'landscape' ? 'ngang' : 'dọc'}</div>
        <div class="ehint">
          {selectedCtrl
            ? 'Kéo nút để di chuyển. Dùng thanh trượt để đổi kích thước.'
            : 'Chạm vào một nút để chọn, rồi kéo để di chuyển.'}
        </div>
        <input
          class="slider"
          type="range"
          min="50"
          max="200"
          value={Math.round(selScale * 100)}
          disabled={!selectedCtrl}
          aria-label="Kích thước"
          oninput={onScaleInput}
          onchange={onScaleCommit}
        />
        <div class="erow">
          <button class="btn small" onclick={resetLayout}>Mặc định</button>
          <button class="btn small primary" onclick={finishEdit}>Xong</button>
        </div>
      </div>
    {/if}
  </section>
</div>

<!-- Bảng -->
<SettingsSheet
  open={sheet === 'settings'}
  {settings}
  onchange={patchSettings}
  onclose={() => (sheet = null)}
  onkeys={() => openChild('keys', 'settings')}
  ondata={() => openChild('data', 'settings')}
  onedit={() => startEdit('settings')}
  ondeleteall={deleteAll}
/>
<PlayMenu
  open={sheet === 'menu'}
  {speed}
  {settings}
  onspeed={setGameSpeed}
  onchange={patchSettings}
  onreset={resetGame}
  onstates={() => openChild('states', 'menu')}
  oncheats={() => openChild('cheats', 'menu')}
  onkeys={() => openChild('keys', 'menu')}
  oneditlayout={() => startEdit('menu')}
  onexit={backToLibrary}
  onclose={closeMenu}
/>
<KeysSheet
  open={sheet === 'keys'}
  buttons={gba.buttons}
  {mappings}
  {capturingFor}
  {padNames}
  onremap={remap}
  onreset={resetMap}
  onclose={closeChild}
/>
<DataSheet open={sheet === 'data'} onexport={doExport} onimport={doImport} onclose={closeChild} />
<CheatsSheet
  open={sheet === 'cheats'}
  {cheats}
  supported={cheatsSupported}
  onadd={addCheat}
  ontoggle={toggleCheat}
  onremove={removeCheat}
  onclose={closeChild}
/>
<StatesSheet
  open={sheet === 'states'}
  {slots}
  {thumbUrls}
  onsave={saveToSlot}
  onload={loadFromSlot}
  onclose={closeChild}
/>
<GameSheet
  rom={gameSheet}
  onexport={exportSav}
  onimport={pickSav}
  onrename={doRename}
  onautocover={(r) => {
    gameSheet = null;
    autoCover(r, true);
  }}
  onpickcover={pickCover}
  ondelete={deleteRom}
  onclose={() => (gameSheet = null)}
/>

<input
  bind:this={addInput}
  type="file"
  accept=".gba,.agb"
  multiple
  hidden
  disabled={!ready}
  onchange={onRomsPicked}
/>
<input bind:this={savInput} type="file" accept=".sav,.srm" hidden onchange={onSavPicked} />
<input bind:this={coverInput} type="file" accept="image/*" hidden onchange={onCoverPicked} />

{#if toastMsg}
  <div class="toast" role="status">{toastMsg}</div>
{/if}

<style>
  .gone-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
