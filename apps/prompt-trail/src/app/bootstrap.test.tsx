import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { mountPromptTrailApplication } from './bootstrap';
import {
  createDeveloperUiStateStore,
  getBrowserDeveloperUiStateStorage,
} from '../developer-ui-state';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'localStorage',
);

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      window,
      'localStorage',
      originalLocalStorageDescriptor,
    );
  }
  window.history.replaceState(null, '', '/');
});

describe('mountPromptTrailApplication', () => {
  it('continues startup without an override when the localStorage getter throws', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage access denied', 'SecurityError');
      },
    });

    const storage = getBrowserDeveloperUiStateStorage(window);
    expect(createDeveloperUiStateStore(storage).getSnapshot()).toEqual({
      activeOverride: null,
    });

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const application = mountPromptTrailApplication(rootElement);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();

    application.dispose();
    rootElement.remove();
  });
});
