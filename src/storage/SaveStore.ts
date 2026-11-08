import { STORES, dbDelete, dbGet, dbGetAllByIndex, dbPut } from './db';

interface SramRecord {
  data: ArrayBuffer;
  updatedAt: number;
}

/** Ghi battery save (SRAM) của một ROM. */
export const saveSram = (romId: string, data: ArrayBuffer): Promise<void> =>
  dbPut(STORES.sram, { data, updatedAt: Date.now() } satisfies SramRecord, romId);

/** Đọc battery save của một ROM, hoặc undefined nếu chưa có. */
export async function loadSram(romId: string): Promise<ArrayBuffer | undefined> {
  return (await dbGet<SramRecord>(STORES.sram, romId))?.data;
}

export const deleteSram = (romId: string): Promise<void> => dbDelete(STORES.sram, romId);

/** Số ô save state cho mỗi game. */
export const STATE_SLOTS = 4;

export interface StateRecord {
  /** `${romId}:${slot}` */
  id: string;
  romId: string;
  slot: number;
  data: ArrayBuffer;
  thumb: Blob | null;
  createdAt: number;
}

export const saveStateRecord = (
  romId: string,
  slot: number,
  data: ArrayBuffer,
  thumb: Blob | null,
): Promise<void> =>
  dbPut(STORES.states, {
    id: `${romId}:${slot}`,
    romId,
    slot,
    data,
    thumb,
    createdAt: Date.now(),
  } satisfies StateRecord);

export const getStateRecord = (romId: string, slot: number): Promise<StateRecord | undefined> =>
  dbGet<StateRecord>(STORES.states, `${romId}:${slot}`);

/** Các ô đã có state của một game, theo thứ tự ô. */
export async function listStateRecords(romId: string): Promise<StateRecord[]> {
  const all = await dbGetAllByIndex<StateRecord>(STORES.states, 'romId', romId);
  return all.sort((a, b) => a.slot - b.slot);
}

export const deleteStateRecord = (romId: string, slot: number): Promise<void> =>
  dbDelete(STORES.states, `${romId}:${slot}`);
