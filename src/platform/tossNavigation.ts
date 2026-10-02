import { isInToss, loadSdk } from './toss';

/**
 * Inside Toss the native navigation bar owns "back" (the app hides its own ‹ button so the two
 * never show together). Back walks the in-app history; on the home screen it closes the
 * mini-app (non-game apps close without a confirm dialog).
 */
export function setupTossNavigation(isHome: () => boolean, goBack: () => void): void {
  if (!isInToss()) return;
  void loadSdk()
    .then(({ graniteEvent, closeView }) =>
      graniteEvent.addEventListener('backEvent', {
        onEvent: () => (isHome() ? void closeView() : goBack()),
        onError: () => {},
      }),
    )
    .catch(() => {});
  // iOS WebViews may ignore user-scalable=no; stop pinch gestures directly.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
