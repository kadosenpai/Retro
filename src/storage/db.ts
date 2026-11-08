/** Lớp bọc IndexedDB mỏng. Mọi kho dữ liệu của app được tạo ngay từ phiên bản 1. */

export const DB_NAME = 'retro-web';
const DB_VERSION = 1;

export const STORES = {
  /** Thông tin ROM (nhẹ, để liệt kê nhanh). Khoá: id (SHA-256). */
  roms: 'roms',
  /** Nội dung ROM. Khoá: id. */
  romData: 'romData',
  /** Battery save (SRAM). Khoá: romId. */
  sram: 'sram',
  /** Save state. Khoá: id; chỉ mục theo romId. */
  states: 'states',
  /** Cài đặt chung. Khoá: key. */
  settings: 'settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(STORES.roms, { keyPath: 'id' });
      db.createObjectStore(STORES.romData);
      db.createObjectStore(STORES.sram);
      const states = db.createObjectStore(STORES.states, { keyPath: 'id' });
      states.createIndex('romId', 'romId');
      db.createObjectStore(STORES.settings);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Tab khác nâng cấp phiên bản: đóng kết nối để không chặn họ.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Không mở được IndexedDB'));
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB bị tab khác chặn'));
    };
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Chạy một giao dịch; resolve khi giao dịch hoàn tất (đã ghi xuống đĩa). */
export async function run<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Giao dịch bị huỷ'));
    Promise.resolve(fn(tx)).then(
      (r) => {
        result = r;
      },
      (e) => {
        reject(e);
        try {
          tx.abort();
        } catch {
          /* đã kết thúc */
        }
      },
    );
  });
}

export const dbGet = <T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> =>
  run(store, 'readonly', (tx) => wrap<T | undefined>(tx.objectStore(store).get(key)));

export const dbGetAll = <T>(store: StoreName): Promise<T[]> =>
  run(store, 'readonly', (tx) => wrap<T[]>(tx.objectStore(store).getAll()));

export const dbPut = (store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> =>
  run(store, 'readwrite', async (tx) => {
    await wrap(tx.objectStore(store).put(value, key));
  });

export const dbDelete = (store: StoreName, key: IDBValidKey): Promise<void> =>
  run(store, 'readwrite', async (tx) => {
    await wrap(tx.objectStore(store).delete(key));
  });

export const dbGetAllByIndex = <T>(
  store: StoreName,
  index: string,
  key: IDBValidKey,
): Promise<T[]> =>
  run(store, 'readonly', (tx) => wrap<T[]>(tx.objectStore(store).index(index).getAll(key)));

/** Toàn bộ cặp [khoá, giá trị] của một kho (dùng cho kho khoá ngoài như sram, settings). */
export const dbEntries = <T>(store: StoreName): Promise<[IDBValidKey, T][]> =>
  run(store, 'readonly', async (tx) => {
    const os = tx.objectStore(store);
    const [keys, values] = await Promise.all([
      wrap<IDBValidKey[]>(os.getAllKeys()),
      wrap<T[]>(os.getAll()),
    ]);
    return keys.map((k, i) => [k, values[i]] as [IDBValidKey, T]);
  });
