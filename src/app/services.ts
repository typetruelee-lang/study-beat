import { SilentAudioPort, type AudioPort } from '../audio/types';
import { LocalStorageKV, type KeyValueStore } from '../storage/KeyValueStore';
import { RoutineRepository } from '../storage/routines';
import { LocalSessionRepository, type SessionRepository } from '../storage/sessions';
import { SettingsRepository } from '../storage/settings';

export interface Services {
  kv: KeyValueStore;
  settings: SettingsRepository;
  sessions: SessionRepository;
  routines: RoutineRepository;
  audio: AudioPort;
}

function create(kv: KeyValueStore, audio: AudioPort): Services {
  return {
    kv,
    settings: new SettingsRepository(kv),
    sessions: new LocalSessionRepository(kv),
    routines: new RoutineRepository(kv),
    audio,
  };
}

export let services: Services = create(new LocalStorageKV(), new SilentAudioPort());

export function configureServices(kv: KeyValueStore, audio: AudioPort) {
  services = create(kv, audio);
}
