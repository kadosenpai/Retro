import { downloadBytes, savFileName } from '../storage/SavFile';
import { loadSram, saveSram } from '../storage/SaveStore';
import { validateSav } from '../storage/SavFile';
import type { RomInfo } from '../storage/RomLibrary';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Xuất .sav của một game. `flush`: yêu cầu game đang chạy ghi SRAM mới nhất. Trả về thông báo. */
export async function exportSavFile(r: RomInfo, flush?: () => void): Promise<string> {
  try {
    if (flush) {
      flush();
      await sleep(300);
    }
    const data = await loadSram(r.id);
    if (!data) return `"${r.name}" chưa có dữ liệu lưu. Hãy lưu trong game (menu Save) rồi thử lại.`;
    downloadBytes(data, savFileName(r.name));
    return `Đã xuất ${savFileName(r.name)} (${data.byteLength} byte)`;
  } catch {
    return 'Xuất .sav thất bại';
  }
}

export interface SavImportPlan {
  buf: ArrayBuffer;
  /** Ghi chú khi khác kích thước; null nếu game chưa có save. */
  overwrite: { note: string } | null;
}

/** Đọc + kiểm tra file .sav trước khi nhập. */
export async function planSavImport(r: RomInfo, file: File): Promise<SavImportPlan | { error: string }> {
  const buf = await file.arrayBuffer();
  const error = validateSav(buf);
  if (error) return { error };
  const old = await loadSram(r.id);
  if (!old) return { buf, overwrite: null };
  const note = old.byteLength !== buf.byteLength ? ` (khác kích thước save hiện tại: ${old.byteLength} byte)` : '';
  return { buf, overwrite: { note } };
}

export const commitSavImport = (r: RomInfo, buf: ArrayBuffer) => saveSram(r.id, buf);
export { sleep };
