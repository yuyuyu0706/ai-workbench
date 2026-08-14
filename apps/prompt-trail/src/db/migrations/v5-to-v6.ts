/**
 * Schema v5 to v6 is a schema-only upgrade: it adds a `trailId` index to the
 * `runs` Store so `PromptTrailRepository.listRunsByTrail` can query it
 * directly instead of scanning with `.orderBy('updatedAt')` and filtering in
 * memory.
 *
 * No data migration is needed. Every Run persisted since schema v5 already
 * carries a correct `trailId` value (backfilled by `migrateToV5`), so Dexie
 * only needs to learn about the new index; existing records are indexed
 * automatically the next time the Store is opened.
 */
export {};
