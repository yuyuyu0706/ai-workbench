import type { DeveloperUiStateStorage } from './store';

const unavailableStorage: DeveloperUiStateStorage = {
  getItem: () => null,
  setItem: () => {
    throw new Error('Browser storage is unavailable');
  },
  removeItem: () => {
    throw new Error('Browser storage is unavailable');
  },
};

/**
 * Reads the browser storage capability without allowing a SecurityError from
 * the localStorage getter to prevent the application from starting.
 */
export function getBrowserDeveloperUiStateStorage(
  browserWindow: Pick<Window, 'localStorage'>,
): DeveloperUiStateStorage {
  try {
    return browserWindow.localStorage;
  } catch {
    return unavailableStorage;
  }
}
