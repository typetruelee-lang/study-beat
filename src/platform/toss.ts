/**
 * Apps in Toss bridge access. The SDK only works inside the Toss app WebView. The SDK is loaded
 * lazily, so browser previews and tests never download or call it.
 *
 * `window.ReactNativeWebView` alone is not enough: every React Native app's WebView has it — the
 * Claude app too, where sending Toss bridge messages (haptics, keep-awake, storage) made the
 * viewer close on a tap. Toss also injects `window.__appsInTossConstants` before the page loads
 * (the SDK reads it) and puts `TossApp/<version>` in the user agent.
 */
type Sdk = typeof import('@apps-in-toss/web-framework');

export function isInToss(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { ReactNativeWebView?: unknown; __appsInTossConstants?: unknown };
  if (w.ReactNativeWebView == null) return false;
  return w.__appsInTossConstants != null || /TossApp\//.test(navigator.userAgent);
}

let sdk: Promise<Sdk> | null = null;

export function loadSdk(): Promise<Sdk> {
  sdk ??= import('@apps-in-toss/web-framework');
  return sdk;
}
