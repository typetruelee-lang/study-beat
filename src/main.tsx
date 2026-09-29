import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { configureServices } from './app/services';
import { createAudioEngine } from './audio';
import { LocalStorageKV } from './storage/KeyValueStore';
import { AitStorageKV } from './storage/AitStorageKV';
import { isInToss } from './platform/toss';
import './design/global.css';

// Inside the Toss app use the SDK's native Storage; in a browser, localStorage.
configureServices(isInToss() ? new AitStorageKV() : new LocalStorageKV(), createAudioEngine());

if (import.meta.env.DEV) {
  // Read-only hook for scripts/e2e.mjs
  void Promise.all([import('./app/store'), import('./app/services')]).then(
    ([{ getState }, svc]) => ((window as unknown as { __fc: unknown }).__fc = { getState, audio: () => svc.services.audio }),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
