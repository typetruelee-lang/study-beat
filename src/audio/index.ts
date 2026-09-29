import { SilentAudioPort, type AudioPort } from './types';
import { WebAudioEngine } from './AudioEngine';
import { createTrack } from './ambient/createTrack';

export function createAudioEngine(): AudioPort {
  return WebAudioEngine.isSupported() ? new WebAudioEngine(createTrack) : new SilentAudioPort();
}
