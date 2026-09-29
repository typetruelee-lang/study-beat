/**
 * Keep the screen on during a focus session.
 * Web: Screen Wake Lock API where available.
 * Apps in Toss (Phase 7): replace with `Screen.setAwakeMode({ enabled })` from @apps-in-toss/web-framework.
 */
interface WakeLockSentinelLike {
  release(): Promise<void>;
}

let sentinel: WakeLockSentinelLike | null = null;

export async function setKeepScreenOn(enabled: boolean): Promise<void> {
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

/** The browser drops wake locks when the page is hidden; call again on return. */
export function resetWakeLock() {
  sentinel = null;
}
