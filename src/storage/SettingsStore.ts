import { STORES, dbDelete, dbGet, dbPut } from './db';

/** Cài đặt dạng khoá → giá trị (giá trị phải chép được bằng structured clone). */
export const getSetting = <T>(key: string): Promise<T | undefined> =>
  dbGet<T>(STORES.settings, key);

export const setSetting = (key: string, value: unknown): Promise<void> =>
  dbPut(STORES.settings, value, key);

export const deleteSetting = (key: string): Promise<void> => dbDelete(STORES.settings, key);
