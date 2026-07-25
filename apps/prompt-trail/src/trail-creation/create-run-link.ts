import type { Link, LinkType, RunId, UtcDateTimeString } from '../domain';

export type SelectableLinkType = Exclude<LinkType, 'external'>;

export type CreateRunLinkDependencies = {
  readonly createId?: () => Link['id'];
  readonly now?: () => UtcDateTimeString;
};

export function createRunLink(
  input: {
    readonly runId: RunId;
    readonly title: string;
    readonly url: string;
    readonly type: SelectableLinkType;
  },
  dependencies: CreateRunLinkDependencies = {},
): Link {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new Error('Link title is required.');
  }
  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);
  const createId =
    dependencies.createId ??
    (() => `link-${crypto.randomUUID()}` as Link['id']);
  const createdAt = now();
  return {
    id: createId(),
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    runId: input.runId,
    url: input.url,
    title,
    type: input.type,
    role: null,
    summary: null,
    externalId: null,
  };
}
