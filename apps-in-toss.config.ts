import { defineConfig } from '@apps-in-toss/web-framework/config';

// Apps in Toss (v3) app config — read by `ait build`.
// appName must match the app ID registered in the Apps in Toss console. It cannot be changed
// after registration and becomes the deep link host: intoss://molip-gak
export default defineConfig({
  appName: 'molip-gak',
  brand: {
    // Same as --primary in src/design/tokens.css (and BRAND_PRIMARY in src/app/DesignProvider.tsx).
    primaryColor: '#E2683F',
  },
  // No device permissions: sounds are generated on-device, records stay local.
  permissions: [],
  webBundleDir: 'dist',
  // Toss's standard non-game navigation bar (logo · name · ⋯ · ✕) with its back button.
  // The app hides its own ‹ button inside Toss so the two never show at once.
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    withTitle: true,
    theme: 'light',
  },
  webView: {
    // Audio plays inline in the mini-app (never forced into a fullscreen player).
    allowsInlineMediaPlayback: true,
    // The screen-off loop element is (re)started after the first tap when the mix changes.
    mediaPlaybackRequiresUserAction: false,
    bounces: false,
    pullToRefreshEnabled: false,
  },
});
