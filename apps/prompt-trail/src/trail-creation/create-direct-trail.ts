import {
  createDefaultProject,
  type Prompt,
  type Run,
  type Trail,
  type TrailKind,
  type UtcDateTimeString,
} from '../domain';
import type { PromptTrailRepository } from '../repository';
import { normalizeTrailTitle, validateTrailMetadata } from '../trail-metadata';
export type CreateDirectTrailInput = {
  readonly promptBody: string;
  readonly trailTitle: string;
  readonly trailKind: TrailKind;
};
export type CreateDirectTrailDependencies = {
  readonly createId?: (kind: 'prompt' | 'run' | 'trail') => string;
  readonly now?: () => UtcDateTimeString;
};
const TITLE_MAX_LENGTH = 80;
export function createPromptTitle(body: string): string {
  const firstLine =
    body.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const title = firstLine.trim().replace(/\s+/g, ' ');
  return title.length > TITLE_MAX_LENGTH
    ? `${title.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : title;
}
export async function createDirectTrail(
  repository: PromptTrailRepository,
  input: CreateDirectTrailInput,
  dependencies: CreateDirectTrailDependencies = {},
): Promise<Run> {
  const body = input.promptBody.trim();
  if (body.length === 0) throw new Error('Prompt body is required.');
  if (validateTrailMetadata(input).length > 0)
    throw new Error('Trail metadata is invalid.');
  const trailTitle = normalizeTrailTitle(input.trailTitle);
  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);
  const createId =
    dependencies.createId ?? ((kind) => `${kind}-${crypto.randomUUID()}`);
  const createdAt = now();
  const project = createDefaultProject(createdAt);
  const promptId = createId('prompt') as Prompt['id'];
  const runId = createId('run') as Run['id'];
  const trailId = createId('trail') as Trail['id'];
  const prompt: Prompt = {
    id: promptId,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    scope: 'project',
    projectId: project.id,
    title: createPromptTitle(body),
    body,
    status: 'active',
    tags: [],
    variableValues: {},
  };
  const trail: Trail = {
    id: trailId,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null,
    projectId: project.id,
    title: trailTitle,
    kind: input.trailKind,
  };
  const run: Run & { readonly recipeId: null } = {
    id: runId,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null,
    projectId: project.id,
    trailId,
    recipeId: null,
    promptSnapshot: { promptId, title: prompt.title, body: prompt.body },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: body,
    status: 'prepared',
    evaluation: null,
    improvementNote: null,
  };
  return (
    await repository.createDirectRunBundle({ project, prompt, trail, run })
  ).run;
}
