import { afterEach, describe, expect, it } from 'vitest';

import type { Run, RunId, TrailId, UtcDateTimeString } from '../domain';
import { sampleDataset } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from '../repository';

import { loadTrailDetailReadModel } from './trail-detail-read-query';

const databaseScope = createDatabaseTestScope('trail-detail-read-query');

afterEach(async () => {
  await databaseScope.cleanup();
});

function runId(value: string): RunId {
  return value as RunId;
}

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function cloneSampleRun(overrides: Partial<Run> = {}): Run {
  return { ...sampleDataset.run, ...overrides };
}

describe('loadTrailDetailReadModel', () => {
  it('returns null when the Trail does not exist', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadTrailDetailReadModel(repository, 'missing-trail' as TrailId),
    ).resolves.toBeNull();
  });

  it('loads the Trail with its Run, Project, Recipe, and active Links', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun(),
      links: sampleDataset.links.map((link) => ({ ...link })),
    });

    await expect(
      loadTrailDetailReadModel(repository, sampleDataset.trail.id),
    ).resolves.toEqual({
      trail: sampleDataset.trail,
      runs: [
        {
          run: sampleDataset.run,
          project: sampleDataset.project,
          recipe: sampleDataset.recipe,
          links: sampleDataset.links,
        },
      ],
    });
  });

  it('excludes deleted Runs from the run list', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun({
        deletedAt: utc('2026-07-13T00:00:00.000Z'),
      }),
      links: [],
    });

    await expect(
      loadTrailDetailReadModel(repository, sampleDataset.trail.id),
    ).resolves.toEqual({ trail: sampleDataset.trail, runs: [] });
  });

  it('throws when an active Run references a missing Recipe', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun(),
      links: [],
    });
    await database.recipes.delete(sampleDataset.recipe.id);

    await expect(
      loadTrailDetailReadModel(repository, sampleDataset.trail.id),
    ).rejects.toThrow('Run data is inconsistent.');
  });

  it('does not resolve a Recipe for a Direct Run', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const directTrail = {
      ...sampleDataset.trail,
      id: 'trail-detail-direct' as TrailId,
    };
    const directRun: Run & { recipeId: null } = {
      ...sampleDataset.run,
      id: runId('run-detail-direct'),
      trailId: directTrail.id,
      recipeId: null,
      contextSnapshots: [],
      inputValues: {},
      finalPrompt: sampleDataset.prompt.body,
      promptSnapshot: {
        promptId: sampleDataset.prompt.id,
        title: sampleDataset.prompt.title,
        body: sampleDataset.prompt.body,
      },
    };
    await repository.createDirectRunBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt, id: sampleDataset.prompt.id },
      trail: directTrail,
      run: directRun,
    });

    const model = await loadTrailDetailReadModel(repository, directTrail.id);

    expect(model?.runs[0]).toMatchObject({ run: directRun, recipe: null });
  });
});
