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
    });

    expect(disabledRuntime.developerTools).toBeNull();
    expect(enabledRuntime.developerTools).not.toBeNull();

    await enabledRuntime.initialize();
    await expect(
      enabledRuntime.developerTools?.dataService.getRecordCounts(),
    ).resolves.toEqual({
      projects: 0,
      prompts: 0,
      contexts: 0,
      recipes: 0,
      runs: 0,
      links: 0,
    });
    await expect(
      enabledRuntime.repository.listActiveProjects(),
    ).resolves.toEqual([]);

    disabledRuntime.dispose();
    enabledRuntime.dispose();
    databaseTestScope.releaseDatabase(disabledDatabase);
    databaseTestScope.releaseDatabase(enabledDatabase);
    await disabledDatabase.delete();
    await enabledDatabase.delete();
  });
});
