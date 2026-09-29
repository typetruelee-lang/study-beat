import { loadSdk } from '../platform/toss';
import type { KeyValueStore } from './KeyValueStore';

/** KeyValueStore on the Apps in Toss native `Storage` (persists across app restarts). */
export class AitStorageKV implements KeyValueStore {
  async get(key: string) {
    try {
      return await (await loadSdk()).Storage.getItem(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string) {
    try {
      await (await loadSdk()).Storage.setItem(key, value);
    } catch {
      /* keep running in memory */
    }
  }
  async remove(key: string) {
    try {
      await (await loadSdk()).Storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
