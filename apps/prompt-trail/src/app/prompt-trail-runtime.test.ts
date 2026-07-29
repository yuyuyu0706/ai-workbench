import { describe, expect, it, vi } from 'vitest';

import { createPromptTrailRuntime } from './prompt-trail-runtime';
import { createDatabaseTestScope } from '../test/database-test-utils';

const databaseTestScope = createDatabaseTestScope('runtime');

describe('createPromptTrailRuntime', () => {
  it('injects the same database into the repository and initializes it once', async () => {
    const database = databaseTestScope.createDatabase();
    const openSpy = vi.spyOn(database, 'open');
    const runtime = createPromptTrailRuntime(database);

    const firstInitialize = runtime.initialize();
    const secondInitialize = runtime.initialize();

    expect(secondInitialize).toBe(firstInitialize);
    expect(openSpy).toHaveBeenCalledTimes(1);

    await firstInitialize;

    await expect(runtime.repository.listActiveProjects()).resolves.toEqual([]);
    expect(openSpy).toHaveBeenCalledTimes(1);

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
    await database.delete();
  });

  it('closes but does not delete the database on dispose', () => {
    const database = databaseTestScope.createDatabase();
    const closeSpy = vi.spyOn(database, 'close');
    const deleteSpy = vi.spyOn(database, 'delete');
    const runtime = createPromptTrailRuntime(database);

    runtime.dispose();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).not.toHaveBeenCalled();

    databaseTestScope.releaseDatabase(database);
  });

  it('only exposes developer data operations when explicitly enabled', async () => {
    const disabledDatabase = databaseTestScope.createDatabase();
    const enabledDatabase = databaseTestScope.createDatabase();
    const disabledRuntime = createPromptTrailRuntime(disabledDatabase);
    const enabledRuntime = createPromptTrailRuntime(enabledDatabase, {
      enableDeveloperTools: true,
      developerUiStateStorage: localStorage,
    });

    expect(disabledRuntime.developerTools).toBeNull();
    expect(enabledRuntime.developerTools).not.toBeNull();
    expect(enabledRuntime.developerTools?.uiStateStore.getSnapshot()).toEqual({
      activeOverride: null,
    });

    await enabledRuntime.initialize();
    await expect(
      enabledRuntime.developerTools?.dataService.loadScenario('standard'),
    ).resolves.toMatchObject({ status: 'loaded', scenarioId: 'standard' });
    await expect(
      enabledRuntime.repository.listActiveProjects(),
    ).resolves.toHaveLength(1);

    disabledRuntime.dispose();
    enabledRuntime.dispose();
    databaseTestScope.releaseDatabase(disabledDatabase);
    databaseTestScope.releaseDatabase(enabledDatabase);
    await disabledDatabase.delete();
    await enabledDatabase.delete();
  });

  it('does not access storage when disabled and requires it when enabled', () => {
    const database = databaseTestScope.createDatabase();
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const runtime = createPromptTrailRuntime(database, {
      developerUiStateStorage: storage,
    });
    expect(runtime.developerTools).toBeNull();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(() =>
      createPromptTrailRuntime(database, { enableDeveloperTools: true }),
    ).toThrow('developerUiStateStorage is required');

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
  });
});
