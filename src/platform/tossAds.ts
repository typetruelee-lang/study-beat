/**
 * Toss in-app banner ads (Apps in Toss "배너 광고(WebView)"): `TossAds.initialize` once for the
 * whole app, then `TossAds.attachBanner(adGroupId, emptyElement, options)` per slot. The Toss app
 * injects the ad SDK (`window.__appsInToss.ads`); browsers, the web build and other WebViews have
 * none, so there the SDK is never loaded and no slot is drawn.
 *
 * The ad group ID is issued in the console (인앱 광고 → 광고 그룹) and set in .env as
 * VITE_TOSS_AD_BANNER_ID. Until then the build carries Toss's test ID: testing with a real ID is
 * against the ad policy, and a review build must carry the real one (npm run check:toss warns).
 */
import { IS_WEB_SKIN } from '../app/skin';
import { loadSdk } from './toss';

export const TEST_BANNER_ID = 'ait-ad-test-banner-id';
export const BANNER_ID = (import.meta.env.VITE_TOSS_AD_BANNER_ID ?? '').trim();

export type BannerState = 'off' | 'loading' | 'shown' | 'empty' | 'error';
let lastState: BannerState = 'off';
/** Last slot outcome, for the diagnostics screen. */
export const bannerState = (): BannerState => lastState;

const hasAdHost = () =>
  typeof window !== 'undefined' && (window as unknown as { __appsInToss?: { ads?: unknown } }).__appsInToss?.ads != null;

export const bannerAdsAvailable = (): boolean => !IS_WEB_SKIN && BANNER_ID !== '' && hasAdHost();

let ready: Promise<boolean> | null = null;

/** Initialise the ad SDK once; resolves false where banners can't be shown (a later call retries). */
export function initBannerAds(): Promise<boolean> {
  if (!bannerAdsAvailable()) return Promise.resolve(false);
  ready ??= loadSdk()
    .then(({ TossAds }) => {
      if (!TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) return false;
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 10_000);
        const done = (ok: boolean) => {
          clearTimeout(timer);
          resolve(ok);
        };
        TossAds.initialize({ callbacks: { onInitialized: () => done(true), onInitializationFailed: () => done(false) } });
      });
    })
    .catch(() => false)
    .then((ok) => {
      if (!ok) ready = null;
      return ok;
    });
  return ready;
}

/**
 * Attach a banner to an empty element. `onEmpty` runs when there is no ad to show (no fill, render
 * error, unsupported) so the caller can collapse the space. Returns a cleanup that removes the slot.
 * The SDK refreshes and tracks the ad itself — no timers or events of our own.
 */
export function attachBanner(el: HTMLElement, on: { shown: () => void; empty: () => void }): () => void {
  let disposed = false;
  let slot: { destroy: () => void } | null = null;
  const set = (s: BannerState) => {
    lastState = s;
    if (disposed) return;
    if (s === 'shown') on.shown();
    else if (s === 'empty' || s === 'error') on.empty();
  };
  lastState = 'loading';
  void initBannerAds().then(async (ok) => {
    if (disposed) return;
    if (!ok) return set('error');
    const { TossAds } = await loadSdk();
    if (disposed) return;
    slot = TossAds.attachBanner(BANNER_ID, el, {
      theme: 'light',
      tone: 'blackAndWhite',
      variant: 'card',
      callbacks: {
        onAdRendered: () => set('shown'),
        onNoFill: () => set('empty'),
        onAdFailedToRender: () => set('error'),
      },
    });
  });
  return () => {
    disposed = true;
    slot?.destroy();
  };
}
