import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInToss } from './toss';

const w = window as unknown as { ReactNativeWebView?: unknown; __appsInTossConstants?: unknown };

afterEach(() => {
  delete w.ReactNativeWebView;
  delete w.__appsInTossConstants;
  vi.restoreAllMocks();
});

describe('isInToss', () => {
  it('is false in a plain browser', () => {
    expect(isInToss()).toBe(false);
  });
  it('is false in another React Native WebView (e.g. the Claude app)', () => {
    w.ReactNativeWebView = {};
    expect(isInToss()).toBe(false);
  });
  it('is true when Toss injected its constants', () => {
    w.ReactNativeWebView = {};
    w.__appsInTossConstants = {};
    expect(isInToss()).toBe(true);
  });
  it('is true with the Toss user agent', () => {
    w.ReactNativeWebView = {};
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) TossApp/5.210.0');
    expect(isInToss()).toBe(true);
  });
});
