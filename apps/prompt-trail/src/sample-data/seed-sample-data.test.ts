import { afterEach, describe, expect, it } from 'vitest';

import type { Project, ProjectId, UtcDateTimeString } from '../domain';
import { PromptTrailRepository } from '../repository';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { sampleDataset, seedSampleData } from './index';

const databaseScope = createDatabaseTestScope('seed-sample-data');

afterEach(async () => {
  await databaseScope.cleanup();
});

function projectId(value: string): ProjectId {
  return value as ProjectId;
}

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function buildUserProject(): Project {
  return {
    id: projectId('user-project'),
    name: 'User Project',
    description: 'Existing user data',
    tags: ['user'],
    repositoryUrl: null,
    createdAt: utc('2026-07-01T00:00:00.000Z'),
    updatedAt: utc('2026-07-01T00:00:00.000Z'),
    deletedAt: null,
    archivedAt: null,
  };
}

describe('seedSampleData', () => {
  it('seeds the complete sample dataset into a fresh database', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(seedSampleData(repository)).resolves.toEqual({
      status: 'seeded',
    });

    await expect(database.projects.count()).resolves.toBe(1);
    await expect(database.prompts.count()).resolves.toBe(1);
    await expect(database.contexts.count()).resolves.toBe(1);
    await expect(database.recipes.count()).resolves.toBe(1);
    await expect(database.runs.count()).resolves.toBe(1);
    await expect(database.links.count()).resolves.toBe(3);
    await expect(
      repository.getProject(sampleDataset.ids.project),
    ).resolves.toEqual(sampleDataset.project);
  });

  it('is idempotent and does not update an already present sample', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await seedSampleData(repository);
    await database.prompts.update(sampleDataset.ids.prompt, {
      title: 'User edited title',
    });

    await expect(seedSampleData(repository)).resolves.toEqual({
      status: 'already-present',
    });

    await expect(database.projects.count()).resolves.toBe(1);
    await expect(database.prompts.count()).resolves.toBe(1);
    await expect(
      repository.getPrompt(sampleDataset.ids.prompt),
    ).resolves.toMatchObject({ title: 'User edited title' });
  });

  it('preserves existing non-sample user data while adding the sample', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const userProject = buildUserProject();

    await repository.saveProject(userProject);

    await expect(seedSampleData(repository)).resolves.toEqual({
      status: 'seeded',
    });

    await expect(database.projects.count()).resolves.toBe(2);
    await expect(repository.getProject(userProject.id)).resolves.toEqual(
      userProject,
    );
  });

  it('reports conflict without repairing partial sample data', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await repository.saveProject(sampleDataset.project);

    await expect(seedSampleData(repository)).resolves.toEqual({
      status: 'conflict',
      existingIds: [sampleDataset.ids.project],
      missingIds: [
        sampleDataset.ids.prompt,
        sampleDataset.ids.context,
        sampleDataset.ids.recipe,
        sampleDataset.ids.run,
        sampleDataset.ids.links.chat,
        sampleDataset.ids.links.issue100,
        sampleDataset.ids.links.pr101,
      ],
    });

    await expect(database.projects.count()).resolves.toBe(1);
    await expect(database.prompts.count()).resolves.toBe(0);
    await expect(database.contexts.count()).resolves.toBe(0);
    await expect(database.recipes.count()).resolves.toBe(0);
    await expect(database.runs.count()).resolves.toBe(0);
    await expect(database.links.count()).resolves.toBe(0);
  });

  it('reports conflict for unavailable samples without reviving them', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await seedSampleData(repository);
    await repository.softDeleteProject(
      sampleDataset.ids.project,
      utc('2026-07-12T02:00:00.000Z'),
    );

    await expect(seedSampleData(repository)).resolves.toEqual({
      status: 'conflict',
      existingIds: [
        sampleDataset.ids.project,
        sampleDataset.ids.prompt,
        sampleDataset.ids.context,
        sampleDataset.ids.recipe,
        sampleDataset.ids.run,
        sampleDataset.ids.links.chat,
        sampleDataset.ids.links.issue100,
        sampleDataset.ids.links.pr101,
      ],
      missingIds: [],
    });

    await expect(
      repository.getProject(sampleDataset.ids.project),
    ).resolves.toMatchObject({ deletedAt: utc('2026-07-12T02:00:00.000Z') });
  });

  it('rolls back the atomic insert when a later reference validation fails', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      repository.insertTrailBundle({
        project: sampleDataset.project,
        prompt: sampleDataset.prompt,
        context: sampleDataset.context,
        recipe: sampleDataset.recipe,
        run: {
          ...sampleDataset.run,
          recipeId: 'missing-recipe' as typeof sampleDataset.run.recipeId,
        },
        links: sampleDataset.links,
      }),
    ).rejects.toMatchObject({
      name: 'PromptTrailRepositoryError',
      code: 'reference-not-found',
    });

    await expect(database.projects.count()).resolves.toBe(0);
    await expect(database.prompts.count()).resolves.toBe(0);
    await expect(database.contexts.count()).resolves.toBe(0);
    await expect(database.recipes.count()).resolves.toBe(0);
    await expect(database.runs.count()).resolves.toBe(0);
    await expect(database.links.count()).resolves.toBe(0);
  });
});
