import {
  createDefaultProject,
  type Prompt,
  type Run,
  type UtcDateTimeString,
} from '../domain';
import type { PromptTrailRepository } from '../repository';
export type CreateDirectTrailInput = { readonly promptBody: string };
export type CreateDirectTrailDependencies = {
  readonly createId?: (kind: 'prompt' | 'run') => string;
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
  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);
  const createId =
    dependencies.createId ?? ((kind) => `${kind}-${crypto.randomUUID()}`);
  const createdAt = now();
  const project = createDefaultProject(createdAt);
  const promptId = createId('prompt') as Prompt['id'];
  const runId = createId('run') as Run['id'];
  const prompt: Prompt = {
    id: promptId,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    scope: 'project',
    projectId: project.id,
    title: createPromptTitle(body),
    body,
    kind: 'other',
    status: 'active',
    tags: [],
  };
  const run: Run & { readonly recipeId: null } = {
    id: runId,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null,
    projectId: project.id,
    recipeId: null,
    promptSnapshot: { promptId, title: prompt.title, body: prompt.body },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: body,
    status: 'prepared',
    evaluation: null,
    improvementNote: null,
  };
  return (await repository.createDirectRunBundle({ project, prompt, run })).run;
}
