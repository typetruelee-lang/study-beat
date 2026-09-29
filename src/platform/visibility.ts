/**
 * App leave/return detection. In the Toss WebView the page's `visibilitychange` fires when the
 * user leaves the mini-app (home, other app, screen off). This is *detection only* — the
 * Apps in Toss SDK has no API to block other apps, and FOCUS CLAY does not pretend to.
 */
export function onVisibilityChange(cb: (visible: boolean) => void): () => void {
  const handler = () => cb(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
