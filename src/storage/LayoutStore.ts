import type { LayoutOverrides } from '../input/TouchOverlay';
import { getSetting, setSetting } from './SettingsStore';

/** Bố cục nút ảo do người dùng chỉnh, lưu riêng cho màn hình dọc và ngang. */
export interface SavedLayouts {
  portrait: LayoutOverrides;
  landscape: LayoutOverrides;
}

const key = (systemId: string) => `touchLayout.${systemId}`;

export const emptyLayouts = (): SavedLayouts => ({ portrait: {}, landscape: {} });

function clean(raw: unknown): LayoutOverrides {
  const out: LayoutOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const o = v as { cx?: unknown; cy?: unknown; scale?: unknown } | null;
    if (!o || typeof o.cx !== 'number' || typeof o.cy !== 'number' || typeof o.scale !== 'number') continue;
    if (![o.cx, o.cy, o.scale].every(Number.isFinite)) continue;
    out[id] = {
      cx: Math.min(100, Math.max(0, o.cx)),
      cy: Math.min(100, Math.max(0, o.cy)),
      scale: Math.min(2, Math.max(0.5, o.scale)),
    };
  }
  return out;
}

export async function loadLayouts(systemId: string): Promise<SavedLayouts> {
  try {
    const v = await getSetting<Partial<SavedLayouts>>(key(systemId));
    return { portrait: clean(v?.portrait), landscape: clean(v?.landscape) };
  } catch {
    return emptyLayouts();
  }
}

export const saveLayouts = (systemId: string, l: SavedLayouts): Promise<void> =>
  setSetting(key(systemId), { portrait: { ...l.portrait }, landscape: { ...l.landscape } });
