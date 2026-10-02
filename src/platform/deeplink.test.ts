import { describe, expect, it } from 'vitest';
import { routeFromPath } from './deeplink';

describe('deep link paths', () => {
  it('maps known screens', () => {
    expect(routeFromPath('/focus')).toBe('/focus');
    expect(routeFromPath('/app/sleep/')).toBe('/sleep');
    expect(routeFromPath('intoss://molip-gak/relax?from=home')).toBe('/relax');
  });
  it('ignores the root and unknown paths', () => {
    expect(routeFromPath('/')).toBeNull();
    expect(routeFromPath('/index.html')).toBeNull();
    expect(routeFromPath('intoss://molip-gak')).toBeNull();
  });
});
