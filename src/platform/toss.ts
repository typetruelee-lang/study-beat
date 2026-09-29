/**
 * Apps in Toss bridge access. The SDK only works inside the Toss app WebView, where the host
 * injects `window.ReactNativeWebView` (outside it, SDK calls throw). The SDK is loaded lazily,
 * so browser previews and tests never download or call it.
 */
type Sdk = typeof import('@apps-in-toss/web-framework');

export function isInToss(): boolean {
  return typeof window !== 'undefined' && (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView != null;
}

let sdk: Promise<Sdk> | null = null;

export function loadSdk(): Promise<Sdk> {
  sdk ??= import('@apps-in-toss/web-framework');
  return sdk;
}
