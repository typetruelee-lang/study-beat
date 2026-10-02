import { isInToss, loadSdk } from './toss';

/**
 * Deep links ("인앱 기능" in the Apps in Toss console), e.g. intoss://molip-gak/focus.
 * The app uses hash routing, so a path-style entry (/focus) is turned into #/focus.
 */
const ROUTES = ['focus', 'sleep', 'relax', 'library', 'stats'] as const;

/** '/x/focus' or 'intoss://molip-gak/focus?…' → '/focus' (only known screens). */
export function routeFromPath(path: string): string | null {
  const last = path.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop() ?? '';
  return (ROUTES as readonly string[]).includes(last) ? `/${last}` : null;
}

/** /…/focus → /…/#/focus (drop the route segment so relative asset paths stay valid). */
function go(route: string) {
  history.replaceState(null, '', `${location.pathname.replace(/[^/]*\/?$/, '') || '/'}#${route}`);
}

/** Call before the router mounts. */
export function applyDeepLink(): void {
  if (location.hash.length > 2) return; // already on a route
  const fromPath = routeFromPath(location.pathname);
  if (fromPath) return go(fromPath);
  if (!isInToss()) return;
  // Inside Toss the entry scheme URL is also available from the SDK.
  void loadSdk()
    .then(({ Environment }) => {
      const route = routeFromPath(Environment.initialURL ?? '');
      if (route && location.hash.length <= 2) location.hash = route;
    })
    .catch(() => {});
}
