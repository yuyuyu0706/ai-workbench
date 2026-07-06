import { afterEach, describe, expect, it } from 'vitest';

import type {
  Context,
  ContextId,
  Link,
  LinkId,
  Project,
  ProjectId,
  Prompt,
  PromptId,
  Recipe,
  RecipeId,
  Run,
  RunId,
  UtcDateTimeString,
} from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';

import {
  PromptTrailRepository,
  type PromptTrailRepositoryErrorCode,
} from './index';

const databaseScope = createDatabaseTestScope('repository-lifecycle');

const T0 = utc('2026-07-06T00:00:00.000Z');
const T1 = utc('2026-07-06T01:00:00.000Z');
const T2 = utc('2026-07-06T02:00:00.000Z');
const T3 = utc('2026-07-06T03:00:00.000Z');
const T4 = utc('2026-07-06T04:00:00.000Z');
const T5 = utc('2026-07-06T05:00:00.000Z');
const T6 = utc('2026-07-06T06:00:00.000Z');
const T7 = utc('2026-07-06T07:00:00.000Z');
const T8 = utc('2026-07-06T08:00:00.000Z');

interface RepresentativeTrail {
  readonly project: Project;
  readonly prompt: Prompt;
  readonly globalContext: Context;
  readonly projectContext: Context;
  readonly recipe: Recipe;
  readonly run: Run;
  readonly link: Link;
}

afterEach(async () => {
  await databaseScope.cleanup();
});

function projectId(value: string): ProjectId {
  return value as ProjectId;
}

function promptId(value: string): PromptId {
  return value as PromptId;
}

function contextId(value: string): ContextId {
  return value as ContextId;
}

function recipeId(value: string): RecipeId {
  return value as RecipeId;
}

function runId(value: string): RunId {
  return value as RunId;
}

function linkId(value: string): LinkId {
  return value as LinkId;
}

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function expectedRepositoryError(code: PromptTrailRepositoryErrorCode) {
  return {
    name: 'PromptTrailRepositoryError',
    code,
  };
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: projectId('project-lifecycle'),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    archivedAt: null,
    name: 'Lifecycle project',
    description: 'Project for repository lifecycle integration tests',
    tags: ['lifecycle'],
    repositoryUrl: 'https://github.com/example/repo',
    ...overrides,
  };
}

function buildPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: promptId('prompt-lifecycle'),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    scope: 'project',
    projectId: projectId('project-lifecycle'),
    title: 'Initial prompt title',
    body: 'Initial prompt body',
    kind: 'codex-request',
    status: 'active',
    tags: ['prompt'],
    ...overrides,
  } as Prompt;
}

function buildContext(overrides: Partial<Context> = {}): Context {
  return {
    id: contextId('context-project'),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    scope: 'project',
    projectId: projectId('project-lifecycle'),
    title: 'Initial project context title',
    body: 'Initial project context body',
    kind: 'project-overview',
    status: 'enabled',
    tags: ['context'],
    ...overrides,
  } as Context;
}

function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: recipeId('recipe-lifecycle'),
    createdAt: T1,
    updatedAt: T1,
    deletedAt: null,
    projectId: projectId('project-lifecycle'),
    title: 'Lifecycle recipe',
    description: 'Recipe that combines project and global assets',
    promptId: promptId('prompt-lifecycle'),
    contextIds: [contextId('context-global'), contextId('context-project')],
    ...overrides,
  };
}

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: runId('run-lifecycle'),
    createdAt: T2,
    updatedAt: T2,
    deletedAt: null,
    archivedAt: null,
    projectId: projectId('project-lifecycle'),
    recipeId: recipeId('recipe-lifecycle'),
    promptSnapshot: {
      promptId: promptId('prompt-lifecycle'),
      title: 'Initial prompt title',
      body: 'Initial prompt body',
    },
    contextSnapshots: [
      {
        contextId: contextId('context-global'),
        title: 'Initial global context title',
        body: 'Initial global context body',
      },
      {
        contextId: contextId('context-project'),
        title: 'Initial project context title',
        body: 'Initial project context body',
      },
    ],
    inputValues: { issue: 57, phase: 'P0-3-3-6' },
    finalPrompt:
      'Initial prompt body\nInitial global context body\nInitial project context body',
    status: 'done',
    evaluation: 'good',
    improvementNote: 'Snapshot is reproducible.',
    ...overrides,
  };
}

function buildLink(overrides: Partial<Link> = {}): Link {
  return {
    id: linkId('link-lifecycle'),
    createdAt: T3,
    updatedAt: T3,
    deletedAt: null,
    runId: runId('run-lifecycle'),
    url: 'https://example.com/lifecycle-result',
    title: 'Lifecycle result',
    type: 'document',
    role: 'result',
    summary: 'External artifact linked from the representative run.',
    externalId: 'issue-57-result',
    ...overrides,
  };
}

async function saveRepresentativeTrail(
  repository: PromptTrailRepository,
): Promise<RepresentativeTrail> {
  const project = buildProject();
  const prompt = buildPrompt();
  const globalContext = {
    id: contextId('context-global'),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    scope: 'global',
    title: 'Initial global context title',
    body: 'Initial global context body',
    kind: 'project-overview',
    status: 'enabled',
    tags: ['context'],
  } as Context;
  const projectContext = buildContext();
  const recipe = buildRecipe();
  const run = buildRun();
  const link = buildLink();

  await repository.saveProject(project);
  await repository.savePrompt(prompt);
  await repository.saveContext(globalContext);
  await repository.saveContext(projectContext);
  await repository.saveRecipe(recipe);
  await repository.saveRun(run);
  await repository.saveLink(link);

  return { project, prompt, globalContext, projectContext, recipe, run, link };
}

describe('PromptTrailRepository cross-store lifecycle integration', () => {
  it('preserves representative Trail history and immutable Run snapshots after later lifecycle changes', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const trail = await saveRepresentativeTrail(repository);
    const originalRun = trail.run;
    const originalLink = trail.link;

    const updatedPrompt: Prompt = {
      ...trail.prompt,
      updatedAt: T4,
      title: 'Updated prompt title',
      body: 'Updated prompt body',
      status: 'deprecated',
    };
    const updatedGlobalContext: Context = {
      ...trail.globalContext,
      updatedAt: T4,
      title: 'Updated global context title',
      body: 'Updated global context body',
      status: 'disabled',
    };
    const archivedProject: Project = {
      ...trail.project,
      updatedAt: T4,
      archivedAt: T4,
    };

    await repository.savePrompt(updatedPrompt);
    await repository.saveContext(updatedGlobalContext);
    await repository.saveProject(archivedProject);

    const deletedPrompt = await repository.softDeletePrompt(
      trail.prompt.id,
      T5,
    );
    const deletedContext = await repository.softDeleteContext(
      trail.globalContext.id,
      T5,
    );
    const archivedRun: Run = { ...originalRun, updatedAt: T7, archivedAt: T7 };

    await repository.saveRun(archivedRun);
    await expect(repository.getLink(originalLink.id)).resolves.toEqual(
      originalLink,
    );
    await expect(repository.listActiveLinks(originalRun.id)).resolves.toEqual([
      originalLink,
    ]);

    const deletedRecipe = await repository.softDeleteRecipe(
      trail.recipe.id,
      T6,
    );
    const deletedProject = await repository.softDeleteProject(
      trail.project.id,
      T6,
    );

    await expect(repository.getRun(originalRun.id)).resolves.toEqual(
      archivedRun,
    );
    await expect(repository.getLink(originalLink.id)).resolves.toEqual(
      originalLink,
    );
    await expect(repository.listActiveLinks(originalRun.id)).resolves.toEqual([
      originalLink,
    ]);

    const deletedRun = await repository.softDeleteRun(originalRun.id, T8);
    const deletedLink = await repository.softDeleteLink(originalLink.id, T8);

    expect(deletedPrompt).toEqual({ ...updatedPrompt, deletedAt: T5 });
    expect(deletedContext).toEqual({ ...updatedGlobalContext, deletedAt: T5 });
    expect(deletedRecipe).toEqual({ ...trail.recipe, deletedAt: T6 });
    expect(deletedProject).toEqual({ ...archivedProject, deletedAt: T6 });
    expect(deletedRun).toEqual({ ...archivedRun, deletedAt: T8 });
    expect(deletedLink).toEqual({ ...originalLink, deletedAt: T8 });

    await expect(repository.getProject(trail.project.id)).resolves.toEqual(
      deletedProject,
    );
    await expect(repository.getPrompt(trail.prompt.id)).resolves.toEqual(
      deletedPrompt,
    );
    await expect(
      repository.getContext(trail.globalContext.id),
    ).resolves.toEqual(deletedContext);
    await expect(repository.getRecipe(trail.recipe.id)).resolves.toEqual(
      deletedRecipe,
    );
    await expect(repository.getRun(originalRun.id)).resolves.toEqual(
      deletedRun,
    );
    await expect(repository.getLink(originalLink.id)).resolves.toEqual(
      deletedLink,
    );

    expect(deletedRun.promptSnapshot).toEqual(originalRun.promptSnapshot);
    expect(deletedRun.contextSnapshots).toEqual(originalRun.contextSnapshots);
    expect(deletedRun.inputValues).toEqual(originalRun.inputValues);
    expect(deletedRun.finalPrompt).toBe(originalRun.finalPrompt);
    expect(deletedLink.runId).toBe(originalRun.id);
  });

  it('separates active list filtering from history lookups across parent lifecycle changes', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const trail = await saveRepresentativeTrail(repository);

    await repository.saveProject({ ...trail.project, archivedAt: T4 });
    await repository.savePrompt({ ...trail.prompt, status: 'deprecated' });
    await repository.saveContext({
      ...trail.projectContext,
      status: 'disabled',
    });
    await repository.softDeleteRecipe(trail.recipe.id, T5);

    await expect(repository.listActiveProjects()).resolves.toEqual([]);
    await expect(
      repository.listActivePrompts(trail.project.id),
    ).resolves.toEqual([]);
    await expect(
      repository.listEnabledContexts(trail.project.id),
    ).resolves.toEqual([trail.globalContext]);
    await expect(
      repository.listActiveRecipes(trail.project.id),
    ).resolves.toEqual([]);
    await expect(repository.listActiveRuns(trail.project.id)).resolves.toEqual([
      trail.run,
    ]);

    await expect(repository.listActiveLinks(trail.run.id)).resolves.toEqual([
      trail.link,
    ]);

    await repository.softDeleteRun(trail.run.id, T7);
    await expect(repository.listActiveLinks(trail.run.id)).resolves.toEqual([
      trail.link,
    ]);

    await expect(
      repository.getProject(trail.project.id),
    ).resolves.toMatchObject({
      archivedAt: T4,
    });
    await expect(repository.getPrompt(trail.prompt.id)).resolves.toMatchObject({
      status: 'deprecated',
    });
    await expect(
      repository.getContext(trail.projectContext.id),
    ).resolves.toMatchObject({ status: 'disabled' });
    await expect(repository.getRecipe(trail.recipe.id)).resolves.toMatchObject({
      deletedAt: T5,
    });
    await expect(repository.getRun(trail.run.id)).resolves.toMatchObject({
      deletedAt: T7,
    });
    await expect(repository.getLink(trail.link.id)).resolves.toEqual(
      trail.link,
    );
  });

  it('rejects new child entities after referenced parents become unavailable without mutating the existing Trail', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const trail = await saveRepresentativeTrail(repository);
    const deprecatedPromptCandidateRecipe = buildRecipe({
      id: recipeId('candidate-recipe-deprecated-prompt'),
    });
    const deletedPromptCandidateRecipe = buildRecipe({
      id: recipeId('candidate-recipe-deleted-prompt'),
    });
    const candidateRun = buildRun({
      id: runId('candidate-run'),
      recipeId: recipeId('recipe-soft-deleted'),
    });
    const candidateLink = buildLink({
      id: linkId('candidate-link'),
      runId: runId('run-soft-deleted'),
    });
    const recipeSoftDeletedBeforeRun = buildRecipe({
      id: recipeId('recipe-soft-deleted'),
    });
    const runSoftDeletedBeforeLink = buildRun({
      id: runId('run-soft-deleted'),
    });

    await repository.savePrompt({ ...trail.prompt, status: 'deprecated' });
    await expect(
      repository.saveRecipe(deprecatedPromptCandidateRecipe),
    ).rejects.toMatchObject(expectedRepositoryError('reference-unavailable'));
    await expect(
      repository.getRecipe(deprecatedPromptCandidateRecipe.id),
    ).resolves.toBeNull();

    await repository.savePrompt(trail.prompt);
    await repository.softDeletePrompt(trail.prompt.id, T4);
    await expect(
      repository.saveRecipe(deletedPromptCandidateRecipe),
    ).rejects.toMatchObject(expectedRepositoryError('reference-unavailable'));
    await expect(
      repository.getRecipe(deletedPromptCandidateRecipe.id),
    ).resolves.toBeNull();

    await repository.savePrompt(trail.prompt);
    await repository.saveRecipe(recipeSoftDeletedBeforeRun);
    await repository.softDeleteRecipe(recipeSoftDeletedBeforeRun.id, T4);
    await expect(repository.saveRun(candidateRun)).rejects.toMatchObject(
      expectedRepositoryError('reference-unavailable'),
    );
    await expect(repository.getRun(candidateRun.id)).resolves.toBeNull();

    await repository.saveRun(runSoftDeletedBeforeLink);
    await repository.softDeleteRun(runSoftDeletedBeforeLink.id, T5);
    await expect(repository.saveLink(candidateLink)).rejects.toMatchObject(
      expectedRepositoryError('reference-unavailable'),
    );
    await expect(repository.getLink(candidateLink.id)).resolves.toBeNull();

    await expect(repository.getRun(trail.run.id)).resolves.toEqual(trail.run);
    await expect(repository.getLink(trail.link.id)).resolves.toEqual(
      trail.link,
    );
  });
});
