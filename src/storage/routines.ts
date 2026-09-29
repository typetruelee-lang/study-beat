import { readJson, type KeyValueStore } from './KeyValueStore';

export interface RoutinePhase {
  kind: 'focus' | 'break';
  seconds: number;
}

export interface Routine {
  id: string;
  name: string;
  phases: RoutinePhase[];
}

const KEY = 'focusclay.routines.v1';

export class RoutineRepository {
  constructor(private kv: KeyValueStore) {}

  async list(): Promise<Routine[]> {
    return (await readJson<Routine[]>(this.kv, KEY)) ?? [];
  }

  async saveAll(routines: Routine[]): Promise<void> {
    await this.kv.set(KEY, JSON.stringify(routines));
  }
}
