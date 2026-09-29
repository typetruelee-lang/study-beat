/**
 * Keep the screen on during a focus session.
 * Toss: `Screen.setAwakeMode` (SDK; may be released when the user leaves the app).
 * Browser: Screen Wake Lock API where available.
 */
import { isInToss, loadSdk } from './toss';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

let sentinel: WakeLockSentinelLike | null = null;
let tossAwake = false;

export async function setKeepScreenOn(enabled: boolean): Promise<void> {
  if (isInToss()) {
    if (enabled === tossAwake) return;
    try {
      await (await loadSdk()).Screen.setAwakeMode({ enabled });
      tossAwake = enabled;
    } catch {
      tossAwake = false;
    }
    return;
  }
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
  try {
    if (enabled && !sentinel && nav.wakeLock) {
      sentinel = await nav.wakeLock.request('screen');
    } else if (!enabled && sentinel) {
      await sentinel.release();
      sentinel = null;
    }
  } catch {
    sentinel = null; // not allowed (e.g. page hidden); harmless
  }
}

/** Leaving the app drops the lock / awake mode; call again on return. */
export function resetWakeLock() {
  sentinel = null;
  tossAwake = false;
}
