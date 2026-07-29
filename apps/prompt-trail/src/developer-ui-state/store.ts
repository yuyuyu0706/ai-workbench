import {
  isDeveloperUiStateOverride,
  type DeveloperUiStateOverride,
} from './catalog';

export const DEVELOPER_UI_STATE_STORAGE_KEY =
  'prompt-trail:developer-tools:ui-state';

const STORAGE_VERSION = 1;

export interface DeveloperUiStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DeveloperUiStateSnapshot {
  readonly activeOverride: DeveloperUiStateOverride | null;
}

export interface DeveloperUiStateStore {
  getSnapshot(): DeveloperUiStateSnapshot;
  subscribe(listener: () => void): () => void;
  setActiveOverride(override: DeveloperUiStateOverride): void;
  clearActiveOverride(): void;
}

const EMPTY_SNAPSHOT: DeveloperUiStateSnapshot = Object.freeze({
  activeOverride: null,
});

function restoreSnapshot(
  storage: DeveloperUiStateStorage,
): DeveloperUiStateSnapshot {
  let serialized: string | null;

  try {
    serialized = storage.getItem(DEVELOPER_UI_STATE_STORAGE_KEY);
  } catch {
    return EMPTY_SNAPSHOT;
  }

  if (serialized === null) {
    return EMPTY_SNAPSHOT;
  }

  try {
    const envelope: unknown = JSON.parse(serialized);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      (envelope as Record<string, unknown>).version !== STORAGE_VERSION ||
      !isDeveloperUiStateOverride(
        (envelope as Record<string, unknown>).activeOverride,
      )
    ) {
      throw new Error('Invalid UI state envelope');
    }

    return Object.freeze({
      activeOverride: Object.freeze({
        ...(envelope as { activeOverride: DeveloperUiStateOverride })
          .activeOverride,
      }),
    });
  } catch {
    try {
      storage.removeItem(DEVELOPER_UI_STATE_STORAGE_KEY);
    } catch {
      // A broken development-only preference must not prevent app startup.
    }
    return EMPTY_SNAPSHOT;
  }
}

export function createDeveloperUiStateStore(
  storage: DeveloperUiStateStorage,
): DeveloperUiStateStore {
  let snapshot = restoreSnapshot(storage);
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setActiveOverride(override) {
      if (
        snapshot.activeOverride?.target === override.target &&
        snapshot.activeOverride.state === override.state
      ) {
        return;
      }

      storage.setItem(
        DEVELOPER_UI_STATE_STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, activeOverride: override }),
      );
      snapshot = Object.freeze({
        activeOverride: Object.freeze({ ...override }),
      });
      notify();
    },
    clearActiveOverride() {
      if (snapshot.activeOverride === null) {
        return;
      }

      storage.removeItem(DEVELOPER_UI_STATE_STORAGE_KEY);
      snapshot = EMPTY_SNAPSHOT;
      notify();
    },
  };
}
