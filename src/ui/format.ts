import type { RomInfo } from '../storage/RomLibrary';

export function sizeText(n: number): string {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
}

export function lastPlayedText(r: RomInfo, now = Date.now()): string {
  if (r.lastPlayedAt === null) return 'Chưa chơi';
  const days = Math.floor((now - r.lastPlayedAt) / 86400000);
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  return `${days} ngày trước`;
}

/** 1–2 chữ cái đầu của tên game, làm "bìa" cho băng. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const out = words
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (out || '?').toUpperCase();
}

/** Bìa đơn sắc (xám) với góc chuyển màu khác nhau theo id. */
export function coverStyle(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const deg = 120 + (h % 120);
  return `background: linear-gradient(${deg}deg, #3b3c44, #17181c);`;
}

/** Tên phím dễ đọc từ KeyboardEvent.code. */
export function keyName(code: string): string {
  return code.replace(/^(Key|Digit)/, '');
}
