import { getSetting, setSetting } from './SettingsStore';
import { exportBackup, type BackupSummary } from './BackupService';

/**
 * Lưu trữ bền vững: xin trình duyệt KHÔNG tự xoá dữ liệu khi thiếu chỗ,
 * và nhắc người dùng sao lưu định kỳ ra file.
 */

export interface StorageInfo {
  /** true = đã được bảo vệ; false = trình duyệt có thể xoá khi thiếu chỗ; null = không hỗ trợ. */
  persisted: boolean | null;
  used: number | null;
  quota: number | null;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  let persisted: boolean | null = null;
  let used: number | null = null;
  let quota: number | null = null;
  try {
    if (s?.persisted) persisted = await s.persisted();
  } catch {
    /* bỏ qua */
  }
  try {
    if (s?.estimate) {
      const e = await s.estimate();
      used = e.usage ?? null;
      quota = e.quota ?? null;
    }
  } catch {
    /* bỏ qua */
  }
  return { persisted, used, quota };
}

/** Xin chế độ bền vững. Trả về true nếu đã được cấp (hoặc đã có từ trước). */
export async function requestPersist(): Promise<boolean> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  try {
    if (!s?.persist) return false;
    if (s.persisted && (await s.persisted())) return true;
    return await s.persist();
  } catch {
    return false;
  }
}

// ---------- Nhắc sao lưu ----------
const K_LAST = 'backup.last';
const K_SNOOZE = 'backup.snooze';
const DAY = 24 * 3600 * 1000;
export const BACKUP_EVERY_DAYS = 14;
const SNOOZE_DAYS = 3;

export async function getLastBackup(): Promise<number | null> {
  return (await getSetting<number>(K_LAST).catch(() => undefined)) ?? null;
}

/** Có nên nhắc sao lưu không (có game, chưa sao lưu hoặc đã quá hạn, và chưa bấm "để sau"). */
export async function isBackupDue(romCount: number, now = Date.now()): Promise<boolean> {
  if (romCount === 0) return false;
  const [last, snooze] = await Promise.all([
    getLastBackup(),
    getSetting<number>(K_SNOOZE).catch(() => undefined),
  ]);
  if (snooze && now < snooze) return false;
  return last === null || now - last > BACKUP_EVERY_DAYS * DAY;
}

export async function snoozeBackup(now = Date.now()): Promise<void> {
  await setSetting(K_SNOOZE, now + SNOOZE_DAYS * DAY).catch(() => {});
}

/** Xuất toàn bộ dữ liệu, tải về máy và ghi nhận thời điểm sao lưu. */
export async function runBackupDownload(): Promise<BackupSummary> {
  const { blob, summary } = await exportBackup();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `retro-web-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  await setSetting(K_LAST, Date.now()).catch(() => {});
  return summary;
}

export function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
