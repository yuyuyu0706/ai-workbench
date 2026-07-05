import type { BaseEntity, RunId } from './common';

export const LINK_TYPES = [
  'chat',
  'issue',
  'pull-request',
  'commit',
  'release',
  'document',
  'external',
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_ROLES = [
  'source',
  'reference',
  'execution',
  'output',
  'result',
] as const;

export type LinkRole = (typeof LINK_ROLES)[number];

/** Trail relationship data owned by one Run. */
export interface Link extends BaseEntity<'link'> {
  readonly runId: RunId;
  readonly url: string;
  readonly title: string | null;
  readonly type: LinkType;
  readonly role: LinkRole;
  readonly summary: string | null;
  readonly externalId: string | null;
}
