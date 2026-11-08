import { STORES, dbGet, dbGetAll, dbPut, run } from './db';

export interface RomInfo {
  /** SHA-256 của nội dung ROM (hex) — cùng ROM thêm 2 lần chỉ lưu một bản. */
  id: string;
  /** Id của SystemProfile, vd. 'gba'. */
  system: string;
  name: string;
  size: number;
  addedAt: number;
  lastPlayedAt: number | null;
  /** Tên file gốc (không đuôi) — dùng để tìm ảnh bìa theo tên chuẩn. */
  fileBase?: string;
  /** Ảnh bìa (JPEG/PNG). */
  cover?: Blob | null;
  /** Nguồn ảnh bìa: 'art' = ảnh bìa gốc tải về, 'snap' = khung hình chụp từ game, 'user' = người dùng chọn. */
  coverKind?: 'art' | 'snap' | 'user';
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Tên hiển thị: bỏ đuôi file. */
export function displayName(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '');
}

/** Thêm ROM vào thư viện (nếu đã có thì giữ bản cũ). Trả về thông tin ROM. */
export async function addRom(system: string, fileName: string, data: ArrayBuffer): Promise<RomInfo> {
  const id = await sha256Hex(data);
  const existing = await dbGet<RomInfo>(STORES.roms, id);
  if (existing) return existing;
  const info: RomInfo = {
    id,
    system,
    name: displayName(fileName),
    fileBase: displayName(fileName),
    size: data.byteLength,
    addedAt: Date.now(),
    lastPlayedAt: null,
  };
  await run([STORES.roms, STORES.romData], 'readwrite', async (tx) => {
    tx.objectStore(STORES.romData).put(data, id);
    tx.objectStore(STORES.roms).put(info);
  });
  return info;
}

/** Danh sách ROM, mới chơi gần đây nhất lên đầu. */
export async function listRoms(system?: string): Promise<RomInfo[]> {
  const all = await dbGetAll<RomInfo>(STORES.roms);
  return all
    .filter((r) => !system || r.system === system)
    .sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt));
}

export const getRomInfo = (id: string) => dbGet<RomInfo>(STORES.roms, id);

export const getRomData = (id: string) => dbGet<ArrayBuffer>(STORES.romData, id);

export async function markPlayed(id: string): Promise<void> {
  const info = await getRomInfo(id);
  if (info) await dbPut(STORES.roms, { ...info, lastPlayedAt: Date.now() });
}

export async function renameRom(id: string, name: string): Promise<void> {
  const info = await getRomInfo(id);
  const clean = name.trim();
  if (info && clean) await dbPut(STORES.roms, { ...info, name: clean });
}

/** Xoá ROM cùng toàn bộ SRAM và save state của nó. */
export async function removeRom(id: string): Promise<void> {
  await run(
    [STORES.roms, STORES.romData, STORES.sram, STORES.states],
    'readwrite',
    async (tx) => {
      tx.objectStore(STORES.roms).delete(id);
      tx.objectStore(STORES.romData).delete(id);
      tx.objectStore(STORES.sram).delete(id);
      const idx = tx.objectStore(STORES.states).index('romId');
      const keys = await new Promise<IDBValidKey[]>((res, rej) => {
        const r = idx.getAllKeys(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const k of keys) tx.objectStore(STORES.states).delete(k);
    },
  );
}

/** Đặt ảnh bìa cho một ROM. */
export async function setCover(id: string, blob: Blob, kind: 'art' | 'snap' | 'user'): Promise<void> {
  const info = await getRomInfo(id);
  if (info) await dbPut(STORES.roms, { ...info, cover: blob, coverKind: kind });
}
