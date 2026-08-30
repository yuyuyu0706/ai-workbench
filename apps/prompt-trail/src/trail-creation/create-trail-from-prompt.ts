import {
  createDefaultProject,
  type Prompt,
  type Run,
  type Trail,
  type TrailKind,
  type UtcDateTimeString,
} from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';
import {
  normalizeTrailTitle,
  validateTrailMetadata,
  type TrailMetadataError,
} from '../trail-metadata';

export type CreateTrailFromPromptInput = {
  readonly sourcePrompt: Pick<Prompt, 'id' | 'title' | 'body' | 'updatedAt'>;
  readonly trailTitle: string;
  readonly trailKind: unknown;
};
export type CreateTrailFromPromptResult =
  | { readonly status: 'created'; readonly run: Run }
  | {
      readonly status: 'invalid';
      readonly errors: readonly TrailMetadataError[];
    }
  | { readonly status: 'not-found' | 'unavailable' | 'stale' };
export type CreateTrailFromPromptDependencies = {
  readonly createId?: (kind: 'run' | 'trail') => string;
  readonly now?: () => UtcDateTimeString;
};

export async function createTrailFromPrompt(
  repository: PromptTrailRepository,
  input: CreateTrailFromPromptInput,
  dependencies: CreateTrailFromPromptDependencies = {},
): Promise<CreateTrailFromPromptResult> {
  const errors = validateTrailMetadata(input);
  if (errors.length > 0) return { status: 'invalid', errors };
  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);
  const createId =
    dependencies.createId ?? ((kind) => `${kind}-${crypto.randomUUID()}`);
  const createdAt = now();
  const project = createDefaultProject(createdAt);
  const trail: Trail = {
    id: createId('trail') as Trail['id'],
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null,
    projectId: project.id,
    title: normalizeTrailTitle(input.trailTitle),
    kind: input.trailKind as TrailKind,
  };
  const run: Run & { readonly recipeId: null } = {
    id: createId('run') as Run['id'],
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null,
    projectId: project.id,
    trailId: trail.id,
    recipeId: null,
    promptSnapshot: {
      promptId: input.sourcePrompt.id,
      title: input.sourcePrompt.title,
      body: input.sourcePrompt.body,
    },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: input.sourcePrompt.body,
    status: 'prepared',
    evaluation: null,
    improvementNote: null,
    output: null,
    messages: [],
  };
  try {
    await repository.createDirectRunFromPrompt({
      project,
      promptId: input.sourcePrompt.id,
      expectedPromptUpdatedAt: input.sourcePrompt.updatedAt,
      trail,
      run,
    });
    return { status: 'created', run };
  } catch (error) {
    if (error instanceof PromptTrailRepositoryError) {
      if (error.code === 'reference-not-found') return { status: 'not-found' };
      if (
        error.code === 'reference-unavailable' ||
        error.code === 'project-mismatch' ||
        error.code === 'scope-mismatch'
      )
        return { status: 'unavailable' };
      if (error.code === 'stale-write') return { status: 'stale' };
    }
    throw error;
  }
}
