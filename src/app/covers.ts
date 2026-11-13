import { fetchBoxArt, toCoverBlob } from '../storage/Covers';
import { setCover, type RomInfo } from '../storage/RomLibrary';
import { gba } from '../systems/gba';

/** Tải ảnh bìa gốc theo tên file. Trả về true nếu đã đặt được ảnh bìa. */
export async function applyAutoCover(r: RomInfo): Promise<boolean> {
  const art = await fetchBoxArt(gba.id, r.fileBase ?? r.name);
  if (!art) return false;
  await setCover(r.id, art, 'art');
  return true;
}

/** Đặt ảnh bìa từ file người dùng chọn. Trả về false nếu không đọc được ảnh. */
export async function applyPickedCover(r: RomInfo, file: File): Promise<boolean> {
  const blob = await toCoverBlob(file);
  if (!blob) return false;
  await setCover(r.id, blob, 'user');
  return true;
}
