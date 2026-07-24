import type {
  Link,
  LinkRole,
  LinkType,
  RunId,
  UtcDateTimeString,
} from '../domain';

export type CreateRunLinkDependencies = {
  readonly createId?: () => Link['id'];
  readonly now?: () => UtcDateTimeString;
};

export function createRunLink(
  input: {
    readonly runId: RunId;
    readonly url: string;
    readonly type: LinkType;
    readonly role: LinkRole;
  },
  dependencies: CreateRunLinkDependencies = {},
): Link {
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
    title: null,
    type: input.type,
    role: input.role,
    summary: null,
    externalId: null,
  };
}
