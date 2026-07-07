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
});
