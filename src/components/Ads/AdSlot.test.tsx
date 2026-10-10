import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

type Callbacks = { onAdRendered?: (p: unknown) => void; onNoFill?: (p: unknown) => void };

/** Stand-in for the ad SDK the Toss app injects (window.__appsInToss.ads). */
function fakeAdHost({ fill = true } = {}) {
  const calls: unknown[][] = [];
  const ads = {
    initialize: Object.assign(
      (o: { callbacks?: { onInitialized?: () => void } }) => {
        calls.push(['initialize']);
        o.callbacks?.onInitialized?.();
      },
      { isSupported: () => true },
    ),
    attachBanner: (id: string, _el: HTMLElement, o: { theme: string; variant: string; callbacks: Callbacks }) => {
      calls.push(['attachBanner', id, o.theme, o.variant]);
      queueMicrotask(() =>
        fill
          ? o.callbacks.onAdRendered?.({ slotId: 's1', adGroupId: id, adMetadata: { creativeId: 'c', requestId: 'r' } })
          : o.callbacks.onNoFill?.({ slotId: 's1', adGroupId: id, adMetadata: {} }),
      );
      return { destroy: () => calls.push(['destroy']) };
    },
    destroy: () => {},
    destroyAll: () => {},
  };
  Object.assign(window, { __appsInToss: { ads } });
  return calls;
}

// tossAds.ts keeps the one-time initialisation in module state: start each test fresh.
const load = async () => (await import('./AdSlot')).AdSlot;
beforeEach(() => vi.resetModules());
afterEach(() => {
  cleanup();
  delete (window as unknown as { __appsInToss?: unknown }).__appsInToss;
});

describe('AdSlot (Toss banner)', () => {
  it('draws nothing outside the Toss app', async () => {
    const AdSlot = await load();
    const { container } = render(<AdSlot place="home" />);
    expect(container.innerHTML).toBe('');
  });

  it('attaches the test banner once the SDK is initialised, and removes it on leave', async () => {
    const calls = fakeAdHost();
    const AdSlot = await load();
    const { container, unmount } = render(<AdSlot place="home" />);
    await waitFor(() => expect(container.querySelector('.toss-ad--shown')).not.toBeNull());
    expect(calls).toEqual([['initialize'], ['attachBanner', 'ait-ad-test-banner-id', 'light', 'card']]);
    unmount();
    expect(calls.at(-1)).toEqual(['destroy']);
  });

  it('initialises the SDK only once for several slots', async () => {
    const calls = fakeAdHost();
    const AdSlot = await load();
    const { container } = render(<><AdSlot place="home" /><AdSlot place="stats" /></>);
    await waitFor(() => expect(container.querySelectorAll('.toss-ad--shown')).toHaveLength(2));
    expect(calls.filter(([c]) => c === 'initialize')).toHaveLength(1);
  });

  it('folds the space away when there is no ad to show', async () => {
    fakeAdHost({ fill: false });
    const AdSlot = await load();
    const { container } = render(<AdSlot place="stats" />);
    await waitFor(() => expect((container.querySelector('.toss-ad') as HTMLElement).hidden).toBe(true));
  });

  it('keeps ads away from the buttons on the library and result screens', async () => {
    const calls = fakeAdHost();
    const AdSlot = await load();
    const { container } = render(<><AdSlot place="library" /><AdSlot place="result" /></>);
    expect(container.innerHTML).toBe('');
    expect(calls).toEqual([]);
  });
});
