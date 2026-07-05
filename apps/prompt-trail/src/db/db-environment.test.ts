import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

import {
  PROMPT_TRAIL_DB_NAME,
  PROMPT_TRAIL_SCHEMA_VERSION,
  PROMPT_TRAIL_STORE_NAMES,
  type PromptTrailStoreName,
} from './index';

describe('PromptTrail DB environment', () => {
  it('resolves Dexie without creating a database instance', () => {
    expect(Dexie).toBeTypeOf('function');
  });

  it('exposes IndexedDB globals in Vitest', () => {
    expect(indexedDB).toBeDefined();
    expect(IDBKeyRange).toBeDefined();
  });

  it('publishes DB metadata through the DB public entrypoint', () => {
    expect(PROMPT_TRAIL_DB_NAME).toBe('prompt-trail');
    expect(PROMPT_TRAIL_SCHEMA_VERSION).toBe(1);
  });

  it('publishes the six schema v1 store names without duplicates', () => {
    const expectedStoreNames: PromptTrailStoreName[] = [
      'projects',
      'prompts',
      'contexts',
      'recipes',
      'runs',
      'links',
    ];

    expect(PROMPT_TRAIL_STORE_NAMES).toEqual(expectedStoreNames);
    expect(new Set(PROMPT_TRAIL_STORE_NAMES).size).toBe(
      PROMPT_TRAIL_STORE_NAMES.length,
    );
  });
});
