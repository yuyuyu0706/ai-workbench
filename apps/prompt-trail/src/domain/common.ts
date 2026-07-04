/**
 * Shared Prompt Trail domain contracts.
 *
 * These types intentionally avoid importing UI, persistence, repository, or
 * external API modules so later model definitions can reuse the same contract
 * across the app and IndexedDB mappings.
 */

export const PROMPT_TRAIL_ENTITY_KINDS = [
  'project',
  'prompt',
  'context',
  'recipe',
  'run',
  'link',
] as const;

export type PromptTrailEntityKind = (typeof PROMPT_TRAIL_ENTITY_KINDS)[number];

/**
 * Nominal string ID for one Prompt Trail model kind.
 *
 * The runtime representation remains a normal string for JSON and database
 * persistence, while the brand makes accidental assignment across model kinds
 * harder during TypeScript checks.
 */
export type EntityId<Kind extends PromptTrailEntityKind> = string & {
  readonly __promptTrailEntityKind: Kind;
};

export type ProjectId = EntityId<'project'>;
export type PromptId = EntityId<'prompt'>;
export type ContextId = EntityId<'context'>;
export type RecipeId = EntityId<'recipe'>;
export type RunId = EntityId<'run'>;
export type LinkId = EntityId<'link'>;

/** ISO 8601 UTC timestamp string, for example 2026-07-04T00:00:00.000Z. */
export type UtcDateTimeString = string & {
  readonly __promptTrailUtcDateTime: unique symbol;
};

/**
 * Common persisted entity fields.
 *
 * Persisted entities use null for an absent single value. In particular,
 * deletedAt is null unless the entity has been soft-deleted.
 */
export interface BaseEntity<Kind extends PromptTrailEntityKind> {
  readonly id: EntityId<Kind>;
  readonly createdAt: UtcDateTimeString;
  readonly updatedAt: UtcDateTimeString;
  readonly deletedAt: UtcDateTimeString | null;
}

/** Lifecycle contract that should only be composed into archive-capable models. */
export interface ArchivableEntity {
  readonly archivedAt: UtcDateTimeString | null;
}

export interface GlobalScope {
  readonly scope: 'global';
}

export interface ProjectScope {
  readonly scope: 'project';
  readonly projectId: ProjectId;
}

/**
 * Discriminated scope for assets that may either be reusable globally or owned
 * by one Project.
 */
export type AssetScope = GlobalScope | ProjectScope;
