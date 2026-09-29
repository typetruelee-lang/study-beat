import { defineConfig } from '@apps-in-toss/web-framework/config';

// Apps in Toss (v3) app config — read by `ait build`.
// appName must match the app registered in the Apps in Toss console.
export default defineConfig({
  appName: 'focus-clay',
  brand: {
    primaryColor: '#E9794F',
  },
  // No device permissions: sounds are generated on-device, records stay local.
  permissions: [],
  webBundleDir: 'dist',
  webView: {
    // Audio plays inline in the mini-app (never forced into a fullscreen player).
    allowsInlineMediaPlayback: true,
  },
});
