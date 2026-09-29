/**
 * Light haptic feedback.
 * Toss: `generateHapticFeedback` (SDK). Browser: navigator.vibrate (Android only).
 */
import { isInToss, loadSdk } from './toss';

export function haptic(kind: 'tick' | 'success' = 'tick') {
  if (isInToss()) {
    void loadSdk()
      .then((sdk) => sdk.generateHapticFeedback({ type: kind === 'success' ? 'success' : 'tickWeak' }))
      .catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(kind === 'success' ? [30, 60, 30] : 10);
  } catch {
    /* unsupported */
  }
}
