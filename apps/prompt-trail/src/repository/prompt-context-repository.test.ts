import { afterEach, describe, expect, it } from 'vitest';

import type {
  Context,
  ContextId,
  Project,
  ProjectId,
  Prompt,
  PromptId,
  UtcDateTimeString,
} from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { PromptTrailRepository } from './index';

const databaseScope = createDatabaseTestScope('prompt-context-repository');

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

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: projectId('project-1'),
    createdAt: utc('2026-07-05T00:00:00.000Z'),
    updatedAt: utc('2026-07-05T00:00:00.000Z'),
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
    createdAt: utc('2026-07-05T00:00:00.000Z'),
    updatedAt: utc('2026-07-05T00:00:00.000Z'),
    deletedAt: null,
    scope: 'global',
    title: 'Prompt 1',
    body: 'Body',
    kind: 'codex-request',
    status: 'active',
    tags: ['prompt'],
    ...overrides,
  } as Prompt;
}

function buildContext(overrides: Partial<Context> = {}): Context {
  return {
    id: contextId('context-1'),
    createdAt: utc('2026-07-05T00:00:00.000Z'),
    updatedAt: utc('2026-07-05T00:00:00.000Z'),
    deletedAt: null,
    scope: 'global',
    title: 'Context 1',
    body: 'Body',
    kind: 'project-overview',
    status: 'enabled',
    tags: ['context'],
    ...overrides,
  } as Context;
}

describe('PromptTrailRepository prompt and context persistence', () => {
  it('saves global and project scoped Prompt and Context entities', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const archivedProject = buildProject({
      id: projectId('project-archived'),
      archivedAt: utc('2026-07-05T01:00:00.000Z'),
    });
    const globalPrompt = buildPrompt();
    const projectPrompt = buildPrompt({
      id: promptId('prompt-project'),
      scope: 'project',
      projectId: project.id,
    });
    const archivedProjectPrompt = buildPrompt({
      id: promptId('prompt-archived-project'),
      scope: 'project',
      projectId: archivedProject.id,
    });
    const globalContext = buildContext();
    const projectContext = buildContext({
      id: contextId('context-project'),
      scope: 'project',
      projectId: project.id,
    });
    const archivedProjectContext = buildContext({
      id: contextId('context-archived-project'),
      scope: 'project',
      projectId: archivedProject.id,
    });

    await repository.saveProject(project);
    await repository.saveProject(archivedProject);

    await expect(repository.savePrompt(globalPrompt)).resolves.toEqual(
      globalPrompt,
    );
    await expect(repository.savePrompt(projectPrompt)).resolves.toEqual(
      projectPrompt,
    );
    await expect(repository.savePrompt(archivedProjectPrompt)).resolves.toEqual(
      archivedProjectPrompt,
    );
    await expect(repository.saveContext(globalContext)).resolves.toEqual(
      globalContext,
    );
    await expect(repository.saveContext(projectContext)).resolves.toEqual(
      projectContext,
    );
    await expect(
      repository.saveContext(archivedProjectContext),
    ).resolves.toEqual(archivedProjectContext);
    await expect(repository.getPrompt(projectPrompt.id)).resolves.toEqual(
      projectPrompt,
    );
    await expect(repository.getContext(projectContext.id)).resolves.toEqual(
      projectContext,
    );
  });

  it('rejects invalid Prompt and Context scope references without writing failed assets', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const deletedProject = buildProject({
      id: projectId('project-deleted'),
      deletedAt: utc('2026-07-05T01:00:00.000Z'),
    });

    await repository.saveProject(deletedProject);

    const missingProjectPrompt = buildPrompt({
      id: promptId('prompt-missing-project'),
      scope: 'project',
      projectId: projectId('missing-project'),
    });
    const deletedProjectContext = buildContext({
      id: contextId('context-deleted-project'),
      scope: 'project',
      projectId: deletedProject.id,
    });
    const globalPromptWithProjectId = {
      ...buildPrompt({ id: promptId('prompt-global-with-project') }),
      projectId: projectId('project-leak'),
    } as unknown as Prompt;
    const projectContextWithoutProjectId = {
      ...buildContext({ id: contextId('context-project-without-project') }),
      scope: 'project',
    } as unknown as Context;

    await expect(
      repository.savePrompt(missingProjectPrompt),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
    await expect(
      repository.saveContext(deletedProjectContext),
    ).rejects.toMatchObject({ code: 'reference-unavailable' });
    await expect(
      repository.savePrompt(globalPromptWithProjectId),
    ).rejects.toMatchObject({ code: 'scope-mismatch' });
    await expect(
      repository.saveContext(projectContextWithoutProjectId),
    ).rejects.toMatchObject({ code: 'scope-mismatch' });
    await expect(repository.getPrompt(missingProjectPrompt.id)).resolves.toBe(
      null,
    );
    await expect(repository.getContext(deletedProjectContext.id)).resolves.toBe(
      null,
    );
    await expect(
      repository.getPrompt(globalPromptWithProjectId.id),
    ).resolves.toBe(null);
    await expect(
      repository.getContext(projectContextWithoutProjectId.id),
    ).resolves.toBe(null);
  });

  it('lists active prompts by requested scope in descending updatedAt order', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const otherProject = buildProject({ id: projectId('project-other') });
    const olderGlobal = buildPrompt({
      id: promptId('prompt-older-global'),
      updatedAt: utc('2026-07-05T01:00:00.000Z'),
    });
    const newerGlobal = buildPrompt({
      id: promptId('prompt-newer-global'),
      updatedAt: utc('2026-07-05T05:00:00.000Z'),
    });
    const projectPrompt = buildPrompt({
      id: promptId('prompt-project'),
      scope: 'project',
      projectId: project.id,
      updatedAt: utc('2026-07-05T03:00:00.000Z'),
    });
    const draftPrompt = buildPrompt({
      id: promptId('prompt-draft'),
      status: 'draft',
      updatedAt: utc('2026-07-05T06:00:00.000Z'),
    });
    const deprecatedPrompt = buildPrompt({
      id: promptId('prompt-deprecated'),
      status: 'deprecated',
      updatedAt: utc('2026-07-05T07:00:00.000Z'),
    });
    const deletedPrompt = buildPrompt({
      id: promptId('prompt-deleted'),
      deletedAt: utc('2026-07-05T08:00:00.000Z'),
      updatedAt: utc('2026-07-05T08:00:00.000Z'),
    });
    const otherProjectPrompt = buildPrompt({
      id: promptId('prompt-other-project'),
      scope: 'project',
      projectId: otherProject.id,
      updatedAt: utc('2026-07-05T04:00:00.000Z'),
    });

    await Promise.all(
      [project, otherProject].map((p) => repository.saveProject(p)),
    );
    await Promise.all(
      [
        olderGlobal,
        newerGlobal,
        projectPrompt,
        draftPrompt,
        deprecatedPrompt,
        deletedPrompt,
        otherProjectPrompt,
      ].map((p) => repository.savePrompt(p)),
    );

    await expect(repository.listActivePrompts()).resolves.toEqual([
      newerGlobal,
      olderGlobal,
    ]);
    await expect(repository.listActivePrompts(project.id)).resolves.toEqual([
      newerGlobal,
      projectPrompt,
      olderGlobal,
    ]);
  });

  it('lists enabled contexts by requested scope in descending updatedAt order', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const otherProject = buildProject({ id: projectId('project-other') });
    const olderGlobal = buildContext({
      id: contextId('context-older-global'),
      updatedAt: utc('2026-07-05T01:00:00.000Z'),
    });
    const newerGlobal = buildContext({
      id: contextId('context-newer-global'),
      updatedAt: utc('2026-07-05T05:00:00.000Z'),
    });
    const projectContext = buildContext({
      id: contextId('context-project'),
      scope: 'project',
      projectId: project.id,
      updatedAt: utc('2026-07-05T03:00:00.000Z'),
    });
    const disabledContext = buildContext({
      id: contextId('context-disabled'),
      status: 'disabled',
      updatedAt: utc('2026-07-05T06:00:00.000Z'),
    });
    const deletedContext = buildContext({
      id: contextId('context-deleted'),
      deletedAt: utc('2026-07-05T08:00:00.000Z'),
      updatedAt: utc('2026-07-05T08:00:00.000Z'),
    });
    const otherProjectContext = buildContext({
      id: contextId('context-other-project'),
      scope: 'project',
      projectId: otherProject.id,
      updatedAt: utc('2026-07-05T04:00:00.000Z'),
    });

    await Promise.all(
      [project, otherProject].map((p) => repository.saveProject(p)),
    );
    await Promise.all(
      [
        olderGlobal,
        newerGlobal,
        projectContext,
        disabledContext,
        deletedContext,
        otherProjectContext,
      ].map((c) => repository.saveContext(c)),
    );

    await expect(repository.listEnabledContexts()).resolves.toEqual([
      newerGlobal,
      olderGlobal,
    ]);
    await expect(repository.listEnabledContexts(project.id)).resolves.toEqual([
      newerGlobal,
      projectContext,
      olderGlobal,
    ]);
  });

  it('soft deletes prompts and contexts without changing status, updatedAt, parent project, or physical storage', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const prompt = buildPrompt({ scope: 'project', projectId: project.id });
    const context = buildContext({ scope: 'project', projectId: project.id });
    const promptDeletedAt = utc('2026-07-05T09:00:00.000Z');
    const contextDeletedAt = utc('2026-07-05T10:00:00.000Z');
    const expectedPrompt = { ...prompt, deletedAt: promptDeletedAt };
    const expectedContext = { ...context, deletedAt: contextDeletedAt };

    await repository.saveProject(project);
    await repository.savePrompt(prompt);
    await repository.saveContext(context);

    await expect(
      repository.softDeletePrompt(prompt.id, promptDeletedAt),
    ).resolves.toEqual(expectedPrompt);
    await expect(
      repository.softDeleteContext(context.id, contextDeletedAt),
    ).resolves.toEqual(expectedContext);
    await expect(repository.getPrompt(prompt.id)).resolves.toEqual(
      expectedPrompt,
    );
    await expect(repository.getContext(context.id)).resolves.toEqual(
      expectedContext,
    );
    await expect(repository.listActivePrompts(project.id)).resolves.toEqual([]);
    await expect(repository.listEnabledContexts(project.id)).resolves.toEqual(
      [],
    );
    await expect(database.prompts.get(prompt.id)).resolves.toEqual(
      expectedPrompt,
    );
    await expect(database.contexts.get(context.id)).resolves.toEqual(
      expectedContext,
    );
    await expect(repository.getProject(project.id)).resolves.toEqual(project);
  });

  it('rejects soft deleting missing prompts and contexts', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      repository.softDeletePrompt(
        promptId('missing'),
        utc('2026-07-05T09:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
    await expect(
      repository.softDeleteContext(
        contextId('missing'),
        utc('2026-07-05T09:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
  });
});
