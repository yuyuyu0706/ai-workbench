import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROMPT_TRAIL_DB_NAME } from '../db';
import { createDatabaseTestScope } from '../test/database-test-utils';

import {
  PROMPT_TRAIL_REPOSITORY_ERROR_CODES,
  PromptTrailRepository,
  PromptTrailRepositoryError,
  type PromptTrailRepositoryErrorCode,
} from './index';

const databaseScope = createDatabaseTestScope('repository-contract');

const expectedErrorCodes = [
  'storage-failure',
  'reference-not-found',
  'reference-unavailable',
  'scope-mismatch',
  'duplicate-context-id',
  'project-mismatch',
  'snapshot-mismatch',
] as const satisfies readonly PromptTrailRepositoryErrorCode[];

afterEach(async () => {
  vi.restoreAllMocks();
  await databaseScope.cleanup();
});

describe('PromptTrailRepository public contract', () => {
  it('creates a repository from a unique injected database', () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    expect(repository.database).toBe(database);
    expect(database.name).not.toBe(PROMPT_TRAIL_DB_NAME);
    expect(database.name).toMatch(/^prompt-trail-repository-contract-/);
    expect(database.isOpen()).toBe(false);
  });

  it('does not open, close, or delete the database during construction', () => {
    const database = databaseScope.createDatabase();
    const openSpy = vi.spyOn(database, 'open');
    const closeSpy = vi.spyOn(database, 'close');
    const deleteSpy = vi.spyOn(database, 'delete');

    new PromptTrailRepository(database);

    expect(openSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(database.isOpen()).toBe(false);
  });

  it('exposes stable repository error codes from the repository entrypoint', () => {
    expect(PROMPT_TRAIL_REPOSITORY_ERROR_CODES).toEqual(expectedErrorCodes);
  });

  it('exposes repository errors with stable name and code', () => {
    const error = new PromptTrailRepositoryError('reference-not-found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PromptTrailRepositoryError);
    expect(error.name).toBe('PromptTrailRepositoryError');
    expect(error.code).toBe('reference-not-found');
  });
});
