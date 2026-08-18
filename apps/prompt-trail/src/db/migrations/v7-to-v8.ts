/**
 * Schema v7 to v8 is a schema-only upgrade: it adds a `promptSnapshot.promptId`
 * index to the `runs` Store so callers can look up Runs by their source
 * Prompt directly instead of scanning and filtering in memory.
 *
 * No data migration is needed. Every Run already carries a `promptSnapshot`
 * with a `promptId`, so Dexie only needs to learn about the new index;
 * existing records are indexed automatically the next time the Store is
 * opened.
 */
export {};
