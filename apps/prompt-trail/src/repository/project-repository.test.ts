import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Project, ProjectId, UtcDateTimeString } from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { PromptTrailRepository, PromptTrailRepositoryError } from './index';

const databaseScope = createDatabaseTestScope('project-repository');

afterEach(async () => {
  vi.restoreAllMocks();
  await databaseScope.cleanup();
});

function projectId(value: string): ProjectId {
  return value as ProjectId;
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
    repositoryUrl: 'https://github.com/example/project-1',
    ...overrides,
  };
}

describe('PromptTrailRepository project persistence', () => {
  it('saves a complete Project entity and retrieves it by id', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();

    await expect(repository.saveProject(project)).resolves.toEqual(project);

    await expect(repository.getProject(project.id)).resolves.toEqual(project);
  });

  it('re-saves the same id by replacing it with the provided complete entity', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const originalProject = buildProject();
    const updatedProject = buildProject({
      updatedAt: utc('2026-07-05T01:00:00.000Z'),
      name: 'Updated Project',
      description: null,
      tags: ['updated', 'replacement'],
      repositoryUrl: null,
    });

    await repository.saveProject(originalProject);
    await repository.saveProject(updatedProject);

    await expect(repository.getProject(originalProject.id)).resolves.toEqual(
      updatedProject,
    );
  });

  it('lists only non-deleted and non-archived projects in descending updatedAt order', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const olderActiveProject = buildProject({
      id: projectId('project-older-active'),
      updatedAt: utc('2026-07-05T01:00:00.000Z'),
      name: 'Older Active Project',
    });
    const deletedProject = buildProject({
      id: projectId('project-deleted'),
      updatedAt: utc('2026-07-05T04:00:00.000Z'),
      deletedAt: utc('2026-07-05T05:00:00.000Z'),
      name: 'Deleted Project',
    });
    const archivedProject = buildProject({
      id: projectId('project-archived'),
      updatedAt: utc('2026-07-05T03:00:00.000Z'),
      archivedAt: utc('2026-07-05T03:30:00.000Z'),
      name: 'Archived Project',
    });
    const newerActiveProject = buildProject({
      id: projectId('project-newer-active'),
      updatedAt: utc('2026-07-05T02:00:00.000Z'),
      name: 'Newer Active Project',
    });

    await Promise.all(
      [
        olderActiveProject,
        deletedProject,
        archivedProject,
        newerActiveProject,
      ].map((project) => repository.saveProject(project)),
    );

    await expect(repository.listActiveProjects()).resolves.toEqual([
      newerActiveProject,
      olderActiveProject,
    ]);
    await expect(repository.getProject(deletedProject.id)).resolves.toEqual(
      deletedProject,
    );
    await expect(repository.getProject(archivedProject.id)).resolves.toEqual(
      archivedProject,
    );
  });

  it('soft deletes a project without removing it from the store', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    const deletedAt = utc('2026-07-05T06:00:00.000Z');
    const expectedDeletedProject = {
      ...project,
      deletedAt,
    };

    await repository.saveProject(project);

    await expect(
      repository.softDeleteProject(project.id, deletedAt),
    ).resolves.toEqual(expectedDeletedProject);
    await expect(repository.getProject(project.id)).resolves.toEqual(
      expectedDeletedProject,
    );
    await expect(repository.listActiveProjects()).resolves.toEqual([]);
    await expect(database.projects.get(project.id)).resolves.toEqual(
      expectedDeletedProject,
    );
  });

  it('returns null when getting a missing project', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      repository.getProject(projectId('missing-project')),
    ).resolves.toBe(null);
  });

  it('throws a repository reference-not-found error when soft deleting a missing project', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      repository.softDeleteProject(
        projectId('missing-project'),
        utc('2026-07-05T06:00:00.000Z'),
      ),
    ).rejects.toMatchObject({
      name: 'PromptTrailRepositoryError',
      code: 'reference-not-found',
    });
    await expect(
      repository.softDeleteProject(
        projectId('missing-project'),
        utc('2026-07-05T06:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(PromptTrailRepositoryError);
  });

  it('does not manage the database lifecycle during construction', () => {
    const database = databaseScope.createDatabase();
    const openSpy = vi.spyOn(database, 'open');
    const closeSpy = vi.spyOn(database, 'close');
    const deleteSpy = vi.spyOn(database, 'delete');

    new PromptTrailRepository(database);

    expect(openSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(database.isOpen()).toBe(false);
  });
});
