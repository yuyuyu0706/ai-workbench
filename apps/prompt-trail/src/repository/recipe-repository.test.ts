import { afterEach, describe, expect, it } from 'vitest';

import type {
  Context,
  ContextId,
  Project,
  ProjectId,
  Prompt,
  PromptId,
  Recipe,
  RecipeId,
  UtcDateTimeString,
} from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { PromptTrailRepository } from './index';

const databaseScope = createDatabaseTestScope('recipe-repository');

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

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: projectId('project-1'),
    createdAt: utc('2026-07-06T00:00:00.000Z'),
    updatedAt: utc('2026-07-06T00:00:00.000Z'),
    deletedAt: null,
    archivedAt: null,
    name: 'Project 1',
    description: 'A test project',
    tags: ['test'],
    repositoryUrl: null,
    ...overrides,
  };
}

function buildPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: promptId('prompt-1'),
    createdAt: utc('2026-07-06T00:00:00.000Z'),
    updatedAt: utc('2026-07-06T00:00:00.000Z'),
    deletedAt: null,
    scope: 'global',
    title: 'Prompt 1',
    body: 'Prompt body',
    kind: 'codex-request',
    status: 'active',
    tags: ['prompt'],
    ...overrides,
  } as Prompt;
}

function buildContext(overrides: Partial<Context> = {}): Context {
  return {
    id: contextId('context-1'),
    createdAt: utc('2026-07-06T00:00:00.000Z'),
    updatedAt: utc('2026-07-06T00:00:00.000Z'),
    deletedAt: null,
    scope: 'global',
    title: 'Context 1',
    body: 'Context body',
    kind: 'project-overview',
    status: 'enabled',
    tags: ['context'],
    ...overrides,
  } as Context;
}

function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: recipeId('recipe-1'),
    createdAt: utc('2026-07-06T00:00:00.000Z'),
    updatedAt: utc('2026-07-06T00:00:00.000Z'),
    deletedAt: null,
    projectId: projectId('project-1'),
    title: 'Recipe 1',
    description: 'Recipe description',
    promptId: promptId('prompt-1'),
    contextIds: [contextId('context-1')],
    ...overrides,
  };
}

describe('PromptTrailRepository recipe persistence', () => {
  it('saves and gets recipes with global and same-project scoped references while preserving context order', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const prompt = buildPrompt({ scope: 'project', projectId: project.id });
    const globalContext = buildContext({ id: contextId('context-global') });
    const projectContext = buildContext({
      id: contextId('context-project'),
      scope: 'project',
      projectId: project.id,
    });
    const recipe = buildRecipe({
      promptId: prompt.id,
      contextIds: [projectContext.id, globalContext.id],
    });

    await repository.saveProject(project);
    await repository.savePrompt(prompt);
    await repository.saveContext(globalContext);
    await repository.saveContext(projectContext);

    await expect(repository.saveRecipe(recipe)).resolves.toEqual(recipe);
    await expect(repository.getRecipe(recipe.id)).resolves.toEqual(recipe);
  });

  it('allows recipes for archived projects', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject({
      archivedAt: utc('2026-07-06T01:00:00.000Z'),
    });
    const prompt = buildPrompt();
    const recipe = buildRecipe({ contextIds: [] });

    await repository.saveProject(project);
    await repository.savePrompt(prompt);

    await expect(repository.saveRecipe(recipe)).resolves.toEqual(recipe);
  });

  it('rejects missing and unavailable recipe references without writing failed recipes', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const deletedProject = buildProject({
      id: projectId('project-deleted'),
      deletedAt: utc('2026-07-06T01:00:00.000Z'),
    });
    const prompt = buildPrompt();
    const deletedPrompt = buildPrompt({
      id: promptId('prompt-deleted'),
      deletedAt: utc('2026-07-06T01:00:00.000Z'),
    });
    const deprecatedPrompt = buildPrompt({
      id: promptId('prompt-deprecated'),
      status: 'deprecated',
    });
    const context = buildContext();
    const deletedContext = buildContext({
      id: contextId('context-deleted'),
      deletedAt: utc('2026-07-06T01:00:00.000Z'),
    });
    const disabledContext = buildContext({
      id: contextId('context-disabled'),
      status: 'disabled',
    });

    await repository.saveProject(project);
    await repository.saveProject(deletedProject);
    await Promise.all(
      [prompt, deletedPrompt, deprecatedPrompt].map((p) =>
        repository.savePrompt(p),
      ),
    );
    await Promise.all(
      [context, deletedContext, disabledContext].map((c) =>
        repository.saveContext(c),
      ),
    );

    const cases = [
      [
        buildRecipe({
          id: recipeId('recipe-missing-project'),
          projectId: projectId('missing-project'),
        }),
        'reference-not-found',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-deleted-project'),
          projectId: deletedProject.id,
        }),
        'reference-unavailable',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-missing-prompt'),
          promptId: promptId('missing-prompt'),
        }),
        'reference-not-found',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-deleted-prompt'),
          promptId: deletedPrompt.id,
        }),
        'reference-unavailable',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-deprecated-prompt'),
          promptId: deprecatedPrompt.id,
        }),
        'reference-unavailable',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-missing-context'),
          contextIds: [contextId('missing-context')],
        }),
        'reference-not-found',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-deleted-context'),
          contextIds: [deletedContext.id],
        }),
        'reference-unavailable',
      ],
      [
        buildRecipe({
          id: recipeId('recipe-disabled-context'),
          contextIds: [disabledContext.id],
        }),
        'reference-unavailable',
      ],
    ] as const;

    for (const [recipe, code] of cases) {
      await expect(repository.saveRecipe(recipe)).rejects.toMatchObject({
        code,
      });
      await expect(repository.getRecipe(recipe.id)).resolves.toBe(null);
    }
  });

  it('rejects duplicate contexts, project mismatches, and malformed referenced scopes', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const otherProject = buildProject({ id: projectId('project-other') });
    const prompt = buildPrompt();
    const projectPrompt = buildPrompt({
      id: promptId('prompt-project'),
      scope: 'project',
      projectId: otherProject.id,
    });
    const context = buildContext();
    const projectContext = buildContext({
      id: contextId('context-project'),
      scope: 'project',
      projectId: otherProject.id,
    });
    const invalidPrompt = {
      ...buildPrompt({ id: promptId('prompt-invalid-scope') }),
      scope: 'global',
      projectId: project.id,
    } as unknown as Prompt;
    const invalidContext = {
      ...buildContext({ id: contextId('context-invalid-scope') }),
      scope: 'project',
      projectId: null,
    } as unknown as Context;

    await repository.saveProject(project);
    await repository.saveProject(otherProject);
    await repository.savePrompt(prompt);
    await repository.savePrompt(projectPrompt);
    await repository.saveContext(context);
    await repository.saveContext(projectContext);
    await database.prompts.put(invalidPrompt);
    await database.contexts.put(invalidContext);

    await expect(
      repository.saveRecipe(
        buildRecipe({
          id: recipeId('recipe-duplicate-context'),
          contextIds: [context.id, context.id],
        }),
      ),
    ).rejects.toMatchObject({ code: 'duplicate-context-id' });
    await expect(
      repository.saveRecipe(
        buildRecipe({
          id: recipeId('recipe-prompt-mismatch'),
          promptId: projectPrompt.id,
        }),
      ),
    ).rejects.toMatchObject({ code: 'project-mismatch' });
    await expect(
      repository.saveRecipe(
        buildRecipe({
          id: recipeId('recipe-context-mismatch'),
          contextIds: [projectContext.id],
        }),
      ),
    ).rejects.toMatchObject({ code: 'project-mismatch' });
    await expect(
      repository.saveRecipe(
        buildRecipe({
          id: recipeId('recipe-prompt-scope'),
          promptId: invalidPrompt.id,
        }),
      ),
    ).rejects.toMatchObject({ code: 'scope-mismatch' });
    await expect(
      repository.saveRecipe(
        buildRecipe({
          id: recipeId('recipe-context-scope'),
          contextIds: [invalidContext.id],
        }),
      ),
    ).rejects.toMatchObject({ code: 'scope-mismatch' });
  });

  it('rolls back failed upserts and keeps an existing recipe unchanged', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const prompt = buildPrompt();
    const context = buildContext();
    const existingRecipe = buildRecipe();
    const invalidUpsert = buildRecipe({
      title: 'Invalid update',
      contextIds: [context.id, contextId('missing-context')],
    });

    await repository.saveProject(project);
    await repository.savePrompt(prompt);
    await repository.saveContext(context);
    await repository.saveRecipe(existingRecipe);

    await expect(repository.saveRecipe(invalidUpsert)).rejects.toMatchObject({
      code: 'reference-not-found',
    });
    await expect(repository.getRecipe(existingRecipe.id)).resolves.toEqual(
      existingRecipe,
    );
  });

  it('lists active recipes for one project in descending updatedAt order', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const otherProject = buildProject({ id: projectId('project-other') });
    const prompt = buildPrompt();
    const olderRecipe = buildRecipe({
      id: recipeId('recipe-older'),
      updatedAt: utc('2026-07-06T01:00:00.000Z'),
      contextIds: [],
    });
    const newerRecipe = buildRecipe({
      id: recipeId('recipe-newer'),
      updatedAt: utc('2026-07-06T03:00:00.000Z'),
      contextIds: [],
    });
    const deletedRecipe = buildRecipe({
      id: recipeId('recipe-deleted'),
      updatedAt: utc('2026-07-06T04:00:00.000Z'),
      deletedAt: utc('2026-07-06T04:30:00.000Z'),
      contextIds: [],
    });
    const otherProjectRecipe = buildRecipe({
      id: recipeId('recipe-other-project'),
      projectId: otherProject.id,
      updatedAt: utc('2026-07-06T05:00:00.000Z'),
      contextIds: [],
    });

    await repository.saveProject(project);
    await repository.saveProject(otherProject);
    await repository.savePrompt(prompt);
    await Promise.all(
      [olderRecipe, newerRecipe, deletedRecipe, otherProjectRecipe].map(
        (recipe) => repository.saveRecipe(recipe),
      ),
    );

    await expect(repository.listActiveRecipes(project.id)).resolves.toEqual([
      newerRecipe,
      olderRecipe,
    ]);
  });

  it('soft deletes only the recipe and keeps retrieval non-cascading after referenced assets change', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const prompt = buildPrompt({ scope: 'project', projectId: project.id });
    const context = buildContext({ scope: 'project', projectId: project.id });
    const recipe = buildRecipe({
      promptId: prompt.id,
      contextIds: [context.id],
    });
    const deletedAt = utc('2026-07-06T09:00:00.000Z');
    const expectedRecipe = { ...recipe, deletedAt };

    await repository.saveProject(project);
    await repository.savePrompt(prompt);
    await repository.saveContext(context);
    await repository.saveRecipe(recipe);
    await repository.softDeleteProject(
      project.id,
      utc('2026-07-06T07:00:00.000Z'),
    );
    await repository.softDeletePrompt(
      prompt.id,
      utc('2026-07-06T07:30:00.000Z'),
    );
    await repository.softDeleteContext(
      context.id,
      utc('2026-07-06T08:00:00.000Z'),
    );

    await expect(repository.getRecipe(recipe.id)).resolves.toEqual(recipe);
    await expect(repository.listActiveRecipes(project.id)).resolves.toEqual([
      recipe,
    ]);
    await expect(
      repository.softDeleteRecipe(recipe.id, deletedAt),
    ).resolves.toEqual(expectedRecipe);
    await expect(repository.getRecipe(recipe.id)).resolves.toEqual(
      expectedRecipe,
    );
    await expect(repository.listActiveRecipes(project.id)).resolves.toEqual([]);
    await expect(database.recipes.get(recipe.id)).resolves.toEqual(
      expectedRecipe,
    );
    await expect(repository.getPrompt(prompt.id)).resolves.toMatchObject({
      deletedAt: utc('2026-07-06T07:30:00.000Z'),
    });
  });

  it('rejects soft deleting missing recipes', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      repository.softDeleteRecipe(
        recipeId('missing'),
        utc('2026-07-06T09:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
  });
});
