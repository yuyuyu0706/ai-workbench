import { describe, expect, it, vi } from 'vitest';

import {
  createDeveloperUiStateStore,
  DEVELOPER_UI_STATE_STORAGE_KEY,
  type DeveloperUiStateStorage,
} from './store';

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  const storage: DeveloperUiStateStorage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
  };
  return storage;
}

describe('createDeveloperUiStateStore', () => {
  it('keeps an immutable, referentially stable empty snapshot', () => {
    const store = createDeveloperUiStateStore(createStorage());

    expect(store.getSnapshot()).toEqual({ activeOverride: null });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
  });

  it('persists, notifies, ignores an identical value, and clears', () => {
    const storage = createStorage();
    const store = createDeveloperUiStateStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const override = { target: 'dashboard-page', state: 'loading' } as const;

    store.setActiveOverride(override);
    expect(storage.setItem).toHaveBeenCalledWith(
      DEVELOPER_UI_STATE_STORAGE_KEY,
      JSON.stringify({ version: 1, activeOverride: override }),
    );
    expect(store.getSnapshot()).toEqual({ activeOverride: override });
    expect(listener).toHaveBeenCalledTimes(1);

    store.setActiveOverride(override);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.clearActiveOverride();
    expect(storage.removeItem).toHaveBeenCalledWith(
      DEVELOPER_UI_STATE_STORAGE_KEY,
    );
    expect(store.getSnapshot()).toEqual({ activeOverride: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('restores a versioned override in a newly created store', () => {
    const storage = createStorage(
      JSON.stringify({
        version: 1,
        activeOverride: { target: 'run-detail-page', state: 'not-found' },
      }),
    );

    expect(createDeveloperUiStateStore(storage).getSnapshot()).toEqual({
      activeOverride: { target: 'run-detail-page', state: 'not-found' },
    });
  });

  it.each([
    ['invalid JSON', '{'],
    ['invalid root', JSON.stringify([])],
    [
      'unknown version',
      JSON.stringify({
        version: 2,
        activeOverride: { target: 'dashboard-page', state: 'loading' },
      }),
    ],
    [
      'unknown target',
      JSON.stringify({
        version: 1,
        activeOverride: { target: 'other', state: 'loading' },
      }),
    ],
    [
      'invalid target/state pair',
      JSON.stringify({
        version: 1,
        activeOverride: { target: 'new-trail-form', state: 'loading' },
      }),
    ],
  ])('removes %s and fails closed', (_name, serialized) => {
    const storage = createStorage(serialized);

    expect(createDeveloperUiStateStore(storage).getSnapshot()).toEqual({
      activeOverride: null,
    });
    expect(storage.removeItem).toHaveBeenCalledWith(
      DEVELOPER_UI_STATE_STORAGE_KEY,
    );
  });

  it('fails closed when reading or cleanup throws', () => {
    const readFailure = createStorage();
    vi.mocked(readFailure.getItem).mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(createDeveloperUiStateStore(readFailure).getSnapshot()).toEqual({
      activeOverride: null,
    });

    const cleanupFailure = createStorage('{');
    vi.mocked(cleanupFailure.removeItem).mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => createDeveloperUiStateStore(cleanupFailure)).not.toThrow();
  });

  it('does not update memory or notify when persistence fails', () => {
    const storage = createStorage();
    const store = createDeveloperUiStateStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() =>
      store.setActiveOverride({ target: 'dashboard-page', state: 'empty' }),
    ).toThrow('quota');
    expect(store.getSnapshot()).toEqual({ activeOverride: null });
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not clear memory or notify when removal fails', () => {
    const storage = createStorage();
    const store = createDeveloperUiStateStore(storage);
    store.setActiveOverride({ target: 'dashboard-page', state: 'empty' });
    const listener = vi.fn();
    store.subscribe(listener);
    vi.mocked(storage.removeItem).mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => store.clearActiveOverride()).toThrow('blocked');
    expect(store.getSnapshot().activeOverride).toEqual({
      target: 'dashboard-page',
      state: 'empty',
    });
    expect(listener).not.toHaveBeenCalled();
  });
});
