import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScreenHeader } from './ScreenHeader';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ScreenHeader title="타이머" />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
});

describe('ScreenHeader back button', () => {
  it('shows its own ‹ button in a browser', () => {
    renderAt('/timer');
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeNull();
  });
  it('hides it inside Toss (the native navigation bar has back)', () => {
    (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {};
    renderAt('/timer');
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
    expect(screen.getByRole('button', { name: '홈으로' })).not.toBeNull();
  });
});
