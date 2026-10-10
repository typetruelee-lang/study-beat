import { useEffect, useRef, useState } from 'react';
import { IS_WEB_SKIN } from '../../app/skin';
import { attachBanner, bannerAdsAvailable } from '../../platform/tossAds';
import './ads.css';

export type AdPlace = 'home' | 'stats' | 'library' | 'result';

/**
 * One ad slot. Never on the focus / sleep / relax playback screens.
 *   Toss build — Toss banner ad (src/platform/tossAds.ts) on home and stats only: the library and
 *     result slots sit right under buttons, which the Toss ad policy rules out.
 *   Web build  — Google AdSense on all four places.
 */
export function AdSlot({ place }: { place: AdPlace }) {
  if (IS_WEB_SKIN) return <WebAd place={place} />;
  return TOSS_PLACES.has(place) && bannerAdsAvailable() ? <TossBanner /> : null;
}

const TOSS_PLACES: ReadonlySet<AdPlace> = new Set(['home', 'stats']);

/** Empty full-width element the SDK draws into (it adds its own "Ad" mark); collapses when there is no ad. */
function TossBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'shown' | 'empty'>('loading');
  useEffect(() => {
    if (!ref.current) return;
    return attachBanner(ref.current, { shown: () => setState('shown'), empty: () => setState('empty') });
  }, []);
  return <div ref={ref} className={`toss-ad toss-ad--${state}`} hidden={state === 'empty'} />;
}

/**
 * Google AdSense slot for the web build. Configure in .env.web:
 *   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 *   VITE_ADSENSE_SLOT_HOME=1234567890 (… _STATS, _LIBRARY, _RESULT)
 * Without a client id nothing is rendered (a dashed placeholder shows only with VITE_AD_PLACEHOLDER=1).
 */
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const PLACEHOLDER = import.meta.env.VITE_AD_PLACEHOLDER === '1';
const SLOTS: Record<AdPlace, string | undefined> = {
  home: import.meta.env.VITE_ADSENSE_SLOT_HOME,
  stats: import.meta.env.VITE_ADSENSE_SLOT_STATS,
  library: import.meta.env.VITE_ADSENSE_SLOT_LIBRARY,
  result: import.meta.env.VITE_ADSENSE_SLOT_RESULT,
};

let scriptAdded = false;
function loadAdSense(client: string) {
  if (scriptAdded) return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

function WebAd({ place }: { place: AdPlace }) {
  const ref = useRef<HTMLModElement>(null);
  const slot = SLOTS[place];
  const enabled = !!CLIENT && !!slot;

  useEffect(() => {
    if (!enabled || !ref.current || ref.current.dataset.loaded) return;
    loadAdSense(CLIENT!);
    ref.current.dataset.loaded = '1';
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* blocked by an ad blocker: leave the space empty */
    }
  }, [enabled]);

  if (!enabled) {
    return PLACEHOLDER ? <div className="ad-slot ad-slot--placeholder" aria-hidden="true">광고 영역 · {place}</div> : null;
  }
  return (
    <aside className="ad-slot" aria-label="광고">
      <span className="ad-slot__label">광고</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
