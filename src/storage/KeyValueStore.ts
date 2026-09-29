/**
 * Async key/value storage. Async on purpose: the Apps in Toss SDK `Storage.getItem/setItem`
 * is Promise-based, so an `AitStorageKV` adapter can replace `LocalStorageKV` without touching callers.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class LocalStorageKV implements KeyValueStore {
  async get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked; the app keeps working in memory.
    }
  }
  async remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryKV implements KeyValueStore {
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.map.set(key, value);
  }
  async remove(key: string) {
    this.map.delete(key);
  }
}

export async function readJson<T>(kv: KeyValueStore, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
