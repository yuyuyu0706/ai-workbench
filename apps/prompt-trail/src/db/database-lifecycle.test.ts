import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { createDatabaseTestScope } from '../test/database-test-utils';

import {
  PROMPT_TRAIL_DB_NAME,
  PROMPT_TRAIL_SCHEMA_VERSION,
  PROMPT_TRAIL_STORE_NAMES,
} from './index';

const databaseScope = createDatabaseTestScope('lifecycle');

async function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function toArray(list: DOMStringList): string[] {
  return Array.from({ length: list.length }, (_, index) =>
    list.item(index),
  ).filter((item): item is string => item !== null);
}

afterEach(async () => {
  await databaseScope.cleanup();
});

describe('PromptTrailDatabase lifecycle', () => {
  it('initializes schema v1 in native IndexedDB when opened', async () => {
    const database = databaseScope.createDatabase();

    expect(database.name).not.toBe(PROMPT_TRAIL_DB_NAME);
    expect(database.name).toMatch(/^prompt-trail-lifecycle-/);

    await database.open();

    expect(database.isOpen()).toBe(true);
    expect(database.verno).toBe(PROMPT_TRAIL_SCHEMA_VERSION);

    const nativeDatabase = database.backendDB() as IDBDatabase;
    expect(toArray(nativeDatabase.objectStoreNames).sort()).toEqual(
      [...PROMPT_TRAIL_STORE_NAMES].sort(),
    );

    const transaction = nativeDatabase.transaction(
      PROMPT_TRAIL_STORE_NAMES,
      'readonly',
    );

    for (const storeName of PROMPT_TRAIL_STORE_NAMES) {
      const objectStore = transaction.objectStore(storeName);
      const expectedIndexNames = database
        .table(storeName)
        .schema.indexes.map((index) => index.name);

      expect(objectStore.keyPath).toBe('id');
      expect(toArray(objectStore.indexNames).sort()).toEqual(
        [...expectedIndexNames].sort(),
      );
    }

    await waitForTransaction(transaction);
  });

  it('closes and deletes an opened test database without leaving state behind', async () => {
    const database = databaseScope.createDatabase();
    const { name } = database;

    expect(name).not.toBe(PROMPT_TRAIL_DB_NAME);
    expect(name).toMatch(/^prompt-trail-lifecycle-/);

    await database.open();
    expect(await Dexie.exists(name)).toBe(true);

    database.close();
    expect(database.isOpen()).toBe(false);

    await database.delete();
    databaseScope.releaseDatabase(database);

    expect(await Dexie.exists(name)).toBe(false);
  });

  it('creates a unique database name for each tracked lifecycle database', () => {
    const firstDatabase = databaseScope.createDatabase();
    const secondDatabase = databaseScope.createDatabase();

    expect(firstDatabase.name).not.toBe(secondDatabase.name);
    expect(firstDatabase.name).not.toBe(PROMPT_TRAIL_DB_NAME);
    expect(secondDatabase.name).not.toBe(PROMPT_TRAIL_DB_NAME);
  });
});
