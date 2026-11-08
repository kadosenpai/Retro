import { deleteSetting, getSetting, setSetting } from './SettingsStore';

export interface CheatItem {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
}

const key = (romId: string) => `cheats.${romId}`;

export async function loadCheats(romId: string): Promise<CheatItem[]> {
  const v = await getSetting<unknown>(key(romId));
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is CheatItem => !!c && typeof c.code === 'string' && typeof c.id === 'string')
    .map((c) => ({ id: c.id, name: String(c.name ?? ''), code: c.code, enabled: !!c.enabled }));
}

export const saveCheats = (romId: string, list: CheatItem[]): Promise<void> =>
  setSetting(key(romId), list);

export const deleteCheats = (romId: string): Promise<void> => deleteSetting(key(romId));

/**
 * Kiểm tra sơ bộ một mã GBA: mỗi dòng là 12 ký tự hex (có thể cách bằng khoảng trắng,
 * dạng "XXXXXXXX YYYY" / "XXXXXXXX YYYYYYYY"). Trả về lỗi hoặc null.
 */
export function validateCode(code: string): string | null {
  const lines = code
    .toUpperCase()
    .split(/[\n+]+/)
    .map((l) => l.replace(/[\s-]+/g, ''))
    .filter(Boolean);
  if (!lines.length) return 'Chưa nhập mã';
  for (const l of lines) {
    if (!/^[0-9A-F]+$/.test(l)) return 'Mã chỉ gồm chữ số 0-9 và chữ A-F';
    if (l.length !== 12 && l.length !== 16) return 'Mỗi dòng mã phải đủ 12 hoặc 16 ký tự (tính cả hai nhóm)';
  }
  return null;
}
