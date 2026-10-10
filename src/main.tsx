import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { DesignProvider } from './app/DesignProvider';
import { configureServices } from './app/services';
import { createAudioEngine } from './audio';
import { LocalStorageKV } from './storage/KeyValueStore';
import { AitStorageKV } from './storage/AitStorageKV';
import { isInToss } from './platform/toss';
import { setupTossNavigation } from './platform/tossNavigation';
import { applyDeepLink } from './platform/deeplink';
import { initBannerAds } from './platform/tossAds';
import './design/global.css';
import { SKIN } from './app/skin';

/** Optional start-up steps must never keep the app from rendering. */
const safely = (step: () => void) => {
  try {
    step();
  } catch (e) {
    console.warn('start-up step skipped', e);
  }
};

document.documentElement.classList.add(`skin-${SKIN}`);
safely(applyDeepLink);

// Inside the Toss app use the SDK's native Storage; in a browser, localStorage.
configureServices(isInToss() ? new AitStorageKV() : new LocalStorageKV(), createAudioEngine());

safely(() =>
  setupTossNavigation(
    () => ['', '#', '#/'].includes(location.hash),
    () => history.back(),
  ),
);

// Toss banner ads: initialise the SDK once, early, so the first slot fills quickly.
safely(() => void initBannerAds());

if (import.meta.env.DEV) {
  // Read-only hook for scripts/e2e.mjs
  void Promise.all([import('./app/store'), import('./app/services'), import('./app/actions')]).then(
    ([{ getState }, svc, actions]) =>
      ((window as unknown as { __fc: unknown }).__fc = { getState, audio: () => svc.services.audio, updateSettings: actions.updateSettings, play: actions.play, stopPlayback: actions.stopPlayback, startSession: actions.startSession, endSessionEarly: actions.endSessionEarly }),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignProvider>
      <App />
    </DesignProvider>
  </StrictMode>,
);
