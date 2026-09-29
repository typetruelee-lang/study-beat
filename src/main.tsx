import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { configureServices } from './app/services';
import { createAudioEngine } from './audio';
import { LocalStorageKV } from './storage/KeyValueStore';
import './design/global.css';

configureServices(new LocalStorageKV(), createAudioEngine());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
