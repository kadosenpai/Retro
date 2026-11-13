import { validateCode, type CheatItem } from '../storage/CheatStore';

/** Thêm một cheat; trả về danh sách mới hoặc thông báo lỗi. */
export function withCheat(
  list: CheatItem[],
  name: string,
  code: string,
): { list: CheatItem[] } | { error: string } {
  const error = validateCode(code);
  if (error) return { error };
  return {
    list: [
      ...list,
      { id: crypto.randomUUID(), name: name || `Cheat ${list.length + 1}`, code: code.trim(), enabled: true },
    ],
  };
}

export const toggled = (list: CheatItem[], id: string, enabled: boolean): CheatItem[] =>
  list.map((c) => (c.id === id ? { ...c, enabled } : c));

export const without = (list: CheatItem[], id: string): CheatItem[] => list.filter((c) => c.id !== id);
