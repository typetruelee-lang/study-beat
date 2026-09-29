import { SilentAudioPort, type AudioPort } from './types';
import { WebAudioEngine } from './AudioEngine';

export function createAudioEngine(): AudioPort {
  return WebAudioEngine.isSupported() ? new WebAudioEngine() : new SilentAudioPort();
}
