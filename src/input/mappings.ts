import type { JoypadId } from '../systems/libretro';
import type { SystemProfile } from '../systems/types';

export type KeyMap = Partial<Record<JoypadId, string[]>>;
export type PadMap = Partial<Record<JoypadId, number[]>>;

export interface Mappings {
  keyboard: KeyMap;
  gamepad: PadMap;
}

const storageKey = (system: SystemProfile) => `retro.mappings.${system.id}`;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Bảng ánh xạ mặc định lấy từ hồ sơ hệ máy. */
export function defaultMappings(system: SystemProfile): Mappings {
  return { keyboard: clone(system.input.keyboard), gamepad: clone(system.input.gamepad) };
}

/** Mặc định, chồng lên dữ liệu người dùng đã tuỳ chỉnh (đã lọc kiểu dữ liệu, bỏ phần không hợp lệ). */
export function sanitizeMappings(system: SystemProfile, raw: unknown): Mappings {
  const m = defaultMappings(system);
  if (!raw || typeof raw !== 'object') return m;
  const saved = raw as Partial<Mappings>;
  for (const b of system.buttons) {
    const k = saved.keyboard?.[b.id];
    const p = saved.gamepad?.[b.id];
    if (Array.isArray(k)) m.keyboard[b.id] = k.filter((c) => typeof c === 'string');
    if (Array.isArray(p)) m.gamepad[b.id] = p.filter((i) => Number.isInteger(i));
  }
  return m;
}

/** Đọc nhanh (đồng bộ) từ localStorage; bản gốc nằm trong IndexedDB (xem InputManager.hydrate). */
export function loadMappings(system: SystemProfile): Mappings {
  try {
    const raw = localStorage.getItem(storageKey(system));
    if (raw) return sanitizeMappings(system, JSON.parse(raw));
  } catch {
    /* localStorage không dùng được: bỏ qua, dùng mặc định */
  }
  return defaultMappings(system);
}

/** Khoá lưu trong SettingsStore. */
export const mappingsSettingKey = (system: SystemProfile) => `mappings.${system.id}`;

export function saveMappings(system: SystemProfile, m: Mappings): void {
  try {
    localStorage.setItem(storageKey(system), JSON.stringify(m));
  } catch {
    /* bỏ qua */
  }
}

export function clearMappings(system: SystemProfile): void {
  try {
    localStorage.removeItem(storageKey(system));
  } catch {
    /* bỏ qua */
  }
}

/** Gán một phím cho một nút (xoá phím đó khỏi các nút khác để không bị trùng). */
export function assignKey(m: Mappings, button: JoypadId, code: string): Mappings {
  const next = clone(m);
  for (const id of Object.keys(next.keyboard) as JoypadId[]) {
    next.keyboard[id] = (next.keyboard[id] ?? []).filter((c) => c !== code);
  }
  next.keyboard[button] = [code];
  return next;
}

/** Gán một nút tay cầm cho một nút (xoá khỏi các nút khác). */
export function assignPad(m: Mappings, button: JoypadId, index: number): Mappings {
  const next = clone(m);
  for (const id of Object.keys(next.gamepad) as JoypadId[]) {
    next.gamepad[id] = (next.gamepad[id] ?? []).filter((i) => i !== index);
  }
  next.gamepad[button] = [index];
  return next;
}
