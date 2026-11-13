import { STORES, dbEntries, dbGetAll, dbPut } from './db';
import type { RomInfo } from './RomLibrary';
import { STATE_SLOTS, type StateRecord } from './SaveStore';

/**
 * Sao lưu / khôi phục dữ liệu người chơi: save game (SRAM), save state và cài đặt.
 * KHÔNG gồm file ROM (to và là của người dùng): save gắn với ROM theo mã SHA-256,
 * nên sau khi nhập, chỉ cần thêm lại đúng ROM đó là dùng được.
 */

const FORMAT = 'retro-backup';
/** Tên định dạng của các file sao lưu cũ (khi web còn tên retro-web) — vẫn nhập được. */
const LEGACY_FORMAT = 'retro-web-backup';
const VERSION = 1;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  createdAt: number;
  roms: { id: string; system: string; name: string }[];
  sram: { romId: string; updatedAt: number; data: string }[];
  states: { romId: string; slot: number; createdAt: number; data: string; thumb: string | null }[];
  settings: { key: string; value: unknown }[];
}

export interface BackupSummary {
  sram: number;
  states: number;
  settings: number;
  /** ROM có dữ liệu trong bản sao lưu nhưng chưa có trong thư viện này. */
  missingRoms: string[];
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

function dataUrlToBlob(url: string): Blob | null {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  return new Blob([fromBase64(m[2])], { type: m[1] });
}

export async function exportBackup(): Promise<{ blob: Blob; summary: BackupSummary }> {
  const roms = await dbGetAll<RomInfo>(STORES.roms);
  const sram = await dbEntries<{ data: ArrayBuffer; updatedAt: number }>(STORES.sram);
  const states = await dbGetAll<StateRecord>(STORES.states);
  const settings = await dbEntries<unknown>(STORES.settings);

  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    createdAt: Date.now(),
    roms: roms.map((r) => ({ id: r.id, system: r.system, name: r.name })),
    sram: sram.map(([k, v]) => ({
      romId: String(k),
      updatedAt: v.updatedAt,
      data: toBase64(v.data),
    })),
    states: await Promise.all(
      states.map(async (s) => ({
        romId: s.romId,
        slot: s.slot,
        createdAt: s.createdAt,
        data: toBase64(s.data),
        thumb: s.thumb ? await blobToDataUrl(s.thumb) : null,
      })),
    ),
    settings: settings.map(([k, v]) => ({ key: String(k), value: v })),
  };
  return {
    blob: new Blob([JSON.stringify(file)], { type: 'application/json' }),
    summary: {
      sram: file.sram.length,
      states: file.states.length,
      settings: file.settings.length,
      missingRoms: [],
    },
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Nhập bản sao lưu. Dữ liệu mới hơn thắng: không ghi đè bản trên máy nếu bản đó mới hơn. */
export async function importBackup(text: string): Promise<BackupSummary> {
  let raw: Partial<BackupFile>;
  try {
    raw = JSON.parse(text) as Partial<BackupFile>;
  } catch {
    throw new Error('File không phải bản sao lưu hợp lệ');
  }
  if ((raw.format !== FORMAT && raw.format !== (LEGACY_FORMAT as string)) || !isNum(raw.version)) {
    throw new Error('File không phải bản sao lưu của Retro');
  }
  if (raw.version > VERSION) {
    throw new Error('Bản sao lưu từ phiên bản mới hơn, hãy cập nhật trang web');
  }

  const haveRoms = new Set((await dbGetAll<RomInfo>(STORES.roms)).map((r) => r.id));
  const nameOf = new Map((raw.roms ?? []).map((r) => [r.id, r.name]));
  const localSram = new Map(
    (await dbEntries<{ updatedAt: number }>(STORES.sram)).map(([k, v]) => [String(k), v.updatedAt]),
  );
  const localStates = new Map(
    (await dbGetAll<StateRecord>(STORES.states)).map((s) => [s.id, s.createdAt]),
  );
  const missing = new Set<string>();
  const summary: BackupSummary = { sram: 0, states: 0, settings: 0, missingRoms: [] };

  for (const e of raw.sram ?? []) {
    if (!isStr(e?.romId) || !isStr(e.data) || !isNum(e.updatedAt)) continue;
    if ((localSram.get(e.romId) ?? -1) >= e.updatedAt) continue;
    await dbPut(STORES.sram, { data: fromBase64(e.data), updatedAt: e.updatedAt }, e.romId);
    summary.sram++;
    if (!haveRoms.has(e.romId)) missing.add(nameOf.get(e.romId) ?? e.romId.slice(0, 8));
  }

  for (const e of raw.states ?? []) {
    if (!isStr(e?.romId) || !isStr(e.data) || !isNum(e.createdAt)) continue;
    if (!Number.isInteger(e.slot) || e.slot < 0 || e.slot >= STATE_SLOTS) continue;
    const id = `${e.romId}:${e.slot}`;
    if ((localStates.get(id) ?? -1) >= e.createdAt) continue;
    const rec: StateRecord = {
      id,
      romId: e.romId,
      slot: e.slot,
      data: fromBase64(e.data),
      thumb: isStr(e.thumb) ? dataUrlToBlob(e.thumb) : null,
      createdAt: e.createdAt,
    };
    await dbPut(STORES.states, rec);
    summary.states++;
    if (!haveRoms.has(e.romId)) missing.add(nameOf.get(e.romId) ?? e.romId.slice(0, 8));
  }

  for (const e of raw.settings ?? []) {
    if (!isStr(e?.key)) continue;
    await dbPut(STORES.settings, e.value, e.key);
    summary.settings++;
  }

  summary.missingRoms = [...missing];
  return summary;
}
