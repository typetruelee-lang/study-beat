/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SKIN?: 'clay' | 'aura';
  readonly VITE_ROUTER?: 'memory' | 'hash';
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  readonly VITE_ADSENSE_SLOT_STATS?: string;
  readonly VITE_ADSENSE_SLOT_LIBRARY?: string;
  readonly VITE_ADSENSE_SLOT_RESULT?: string;
  readonly VITE_AD_PLACEHOLDER?: string;
}
