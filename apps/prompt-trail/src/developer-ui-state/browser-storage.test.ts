import { describe, expect, it } from 'vitest';

import { getBrowserDeveloperUiStateStorage } from './browser-storage';
import { createDeveloperUiStateStore } from './store';

describe('getBrowserDeveloperUiStateStorage', () => {
  it('fails closed without changing memory when the localStorage getter throws', () => {
    const browserWindow = {
      get localStorage(): Storage {
        throw new DOMException('Storage access denied', 'SecurityError');
      },
    };

    const store = createDeveloperUiStateStore(
      getBrowserDeveloperUiStateStorage(browserWindow),
    );

    expect(store.getSnapshot()).toEqual({ activeOverride: null });
    expect(() =>
      store.setActiveOverride({ target: 'dashboard-page', state: 'loading' }),
    ).toThrow('Browser storage is unavailable');
    expect(store.getSnapshot()).toEqual({ activeOverride: null });
  });
});
