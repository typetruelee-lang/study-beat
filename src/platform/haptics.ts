/**
 * Light haptic feedback. Web fallback uses navigator.vibrate (Android only).
 * Apps in Toss (Phase 7): `generateHapticFeedback({ type: 'tickWeak' | 'success' })`.
 */
export function haptic(kind: 'tick' | 'success' = 'tick') {
  try {
    navigator.vibrate?.(kind === 'success' ? [30, 60, 30] : 10);
  } catch {
    /* unsupported */
  }
}
