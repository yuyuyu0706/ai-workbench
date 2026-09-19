import { afterEach, describe, expect, it } from 'vitest';

import type {
  PromptId,
  Run,
  RunId,
  TrailId,
  TrailStepId,
  UtcDateTimeString,
} from '../domain';
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

async function insertBaseTrail(
  repository: PromptTrailRepository,
  run: Run = cloneSampleRun(),
  links: typeof sampleDataset.links = run.id === sampleDataset.run.id
    ? sampleDataset.links.map((link) => ({ ...link }))
    : [],
) {
  await repository.insertTrailBundle({
    project: { ...sampleDataset.project },
    prompt: { ...sampleDataset.prompt },
    context: { ...sampleDataset.context },
    recipe: { ...sampleDataset.recipe },
    trail: { ...sampleDataset.trail },
    trailStep: { ...sampleDataset.trailStep },
    run,
    links,
  });
}

describe('loadTrailDetailReadModel', () => {
  it('returns null when the Trail does not exist', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadTrailDetailReadModel(repository, 'missing-trail' as TrailId),
    ).resolves.toBeNull();
  });

  it('loads the Trail with its Project and one Step carrying its Run, Prompt, and active Links', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);

    await expect(
      loadTrailDetailReadModel(repository, sampleDataset.trail.id),
    ).resolves.toEqual({
      trail: sampleDataset.trail,
      project: sampleDataset.project,
      availablePrompts: [sampleDataset.prompt],
      steps: [
        {
          step: sampleDataset.trailStep,
          prompt: sampleDataset.prompt,
          runs: [
            {
              run: sampleDataset.run,
              recipe: sampleDataset.recipe,
              links: sampleDataset.links,
            },
          ],
        },
      ],
    });
  });

  it('returns Steps in order ascending, each carrying its own Runs', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);

    const secondStep = await repository.addTrailStep({
      trailStep: {
        id: 'trail-step-second' as TrailStepId,
        createdAt: utc('2026-08-01T00:00:00.000Z'),
        updatedAt: utc('2026-08-01T00:00:00.000Z'),
        deletedAt: null,
        trailId: sampleDataset.trail.id,
        kind: 'manual',
        title: 'Manual review',
        promptId: null,
        note: null,
      },
      expectedUpdatedAt: sampleDataset.trail.updatedAt,
      updatedAt: utc('2026-08-01T00:00:00.000Z'),
    });

    const model = await loadTrailDetailReadModel(
      repository,
      sampleDataset.trail.id,
    );

    expect(model?.steps.map((item) => item.step.id)).toEqual([
      sampleDataset.trailStep.id,
      secondStep.id,
    ]);
    expect(model?.steps[1]).toMatchObject({
      step: secondStep,
      prompt: null,
      runs: [],
    });
  });

  it('groups Runs by trailStepId, most recently updated first', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(
      repository,
      cloneSampleRun({
        id: runId('run-older'),
        updatedAt: utc('2026-07-13T00:00:00.000Z'),
      }),
    );
    const newerRun = cloneSampleRun({
      id: runId('run-newer'),
      updatedAt: utc('2026-07-14T00:00:00.000Z'),
    });
    await repository.saveRun(newerRun);

    const model = await loadTrailDetailReadModel(
      repository,
      sampleDataset.trail.id,
    );

    expect(model?.steps[0]?.runs.map((item) => item.run.id)).toEqual([
      'run-newer',
      'run-older',
    ]);
  });

  it('resolves prompt to null for a manual Step', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const manualTrail = {
      ...sampleDataset.trail,
      id: 'trail-manual' as TrailId,
    };
    await repository.saveProject({ ...sampleDataset.project });
    await repository.saveTrail(manualTrail);
    const manualStep = await repository.addTrailStep({
      trailStep: {
        id: 'trail-step-manual' as TrailStepId,
        createdAt: utc('2026-08-01T00:00:00.000Z'),
        updatedAt: utc('2026-08-01T00:00:00.000Z'),
        deletedAt: null,
        trailId: manualTrail.id,
        kind: 'manual',
        title: 'Manual work',
        promptId: null,
        note: null,
      },
      expectedUpdatedAt: manualTrail.updatedAt,
      updatedAt: utc('2026-08-01T00:00:00.000Z'),
    });

    const model = await loadTrailDetailReadModel(repository, manualTrail.id);

    expect(model?.steps).toEqual([
      { step: manualStep, prompt: null, runs: [] },
    ]);
  });

  it('returns a read model for a Trail with zero Runs', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const trail = { ...sampleDataset.trail, id: 'trail-no-runs' as TrailId };
    await repository.saveProject({ ...sampleDataset.project });
    await repository.savePrompt({ ...sampleDataset.prompt });
    await repository.saveTrail(trail);
    const step = await repository.addTrailStep({
      trailStep: {
        id: 'trail-step-no-runs' as TrailStepId,
        createdAt: utc('2026-08-01T00:00:00.000Z'),
        updatedAt: utc('2026-08-01T00:00:00.000Z'),
        deletedAt: null,
        trailId: trail.id,
        kind: 'prompt',
        title: 'Planned step',
        promptId: sampleDataset.prompt.id,
        note: null,
      },
      expectedUpdatedAt: trail.updatedAt,
      updatedAt: utc('2026-08-01T00:00:00.000Z'),
    });

    const expectedTrail = await repository.getTrail(trail.id);

    await expect(
      loadTrailDetailReadModel(repository, trail.id),
    ).resolves.toEqual({
      trail: expectedTrail,
      project: sampleDataset.project,
      availablePrompts: [sampleDataset.prompt],
      steps: [{ step, prompt: sampleDataset.prompt, runs: [] }],
    });
  });

  it('does not throw when the referenced Prompt is soft-deleted', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);
    await repository.softDeletePrompt(
      sampleDataset.prompt.id,
      utc('2026-07-15T00:00:00.000Z'),
    );

    const model = await loadTrailDetailReadModel(
      repository,
      sampleDataset.trail.id,
    );

    expect(model?.steps[0]?.prompt?.id).toBe(sampleDataset.prompt.id);
    expect(model?.steps[0]?.prompt?.deletedAt).not.toBeNull();
  });

  it('does not throw when the referenced Prompt no longer exists', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);
    await database.prompts.delete(
      sampleDataset.prompt.id as unknown as PromptId,
    );

    const model = await loadTrailDetailReadModel(
      repository,
      sampleDataset.trail.id,
    );

    expect(model?.steps[0]?.prompt).toBeNull();
  });

  it('throws when an active Run references a missing Recipe', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);
    await database.recipes.delete(sampleDataset.recipe.id);

    await expect(
      loadTrailDetailReadModel(repository, sampleDataset.trail.id),
    ).rejects.toThrow('Run data is inconsistent.');
  });

  it('excludes deleted Runs from a Step', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(
      repository,
      cloneSampleRun({ deletedAt: utc('2026-07-13T00:00:00.000Z') }),
      [],
    );

    await expect(
      loadTrailDetailReadModel(repository, sampleDataset.trail.id),
    ).resolves.toEqual({
      trail: sampleDataset.trail,
      project: sampleDataset.project,
      availablePrompts: [sampleDataset.prompt],
      steps: [
        {
          step: sampleDataset.trailStep,
          prompt: sampleDataset.prompt,
          runs: [],
        },
      ],
    });
  });

  it('populates availablePrompts from listActivePrompts(trail.projectId), including the Trail Project’s own Prompts and global Prompts', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId: _projectId, ...promptWithoutProject } =
      sampleDataset.prompt;
    const globalPrompt = {
      ...promptWithoutProject,
      id: 'prompt-global' as PromptId,
      scope: 'global' as const,
    };
    await repository.savePrompt(globalPrompt);

    const model = await loadTrailDetailReadModel(
      repository,
      sampleDataset.trail.id,
    );

    expect(model?.availablePrompts).toEqual(
      expect.arrayContaining([sampleDataset.prompt, globalPrompt]),
    );
    expect(model?.availablePrompts).toHaveLength(2);
  });

  it('does not include Prompts from a different Project as availablePrompts candidates', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await insertBaseTrail(repository);
    const otherProject = {
      ...sampleDataset.project,
      id: 'other-project' as (typeof sampleDataset.project)['id'],
    };
    await repository.saveProject(otherProject);
    const otherProjectPrompt = {
      ...sampleDataset.prompt,
      id: 'prompt-other-project' as PromptId,
      projectId: otherProject.id,
    };
    await repository.savePrompt(otherProjectPrompt);

    const model = await loadTrailDetailReadModel(
      repository,
      sampleDataset.trail.id,
    );

    expect(model?.availablePrompts).toEqual([sampleDataset.prompt]);
  });

  it('does not resolve a Recipe for a Direct Run', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const directTrail = {
      ...sampleDataset.trail,
      id: 'trail-detail-direct' as TrailId,
    };
    const directTrailStep = {
      ...sampleDataset.trailStep,
      id: 'trail-step-detail-direct' as (typeof sampleDataset.trailStep)['id'],
      trailId: directTrail.id,
    };
    const directRun: Run & { recipeId: null } = {
      ...sampleDataset.run,
      id: runId('run-detail-direct'),
      trailId: directTrail.id,
      trailStepId: directTrailStep.id,
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
      trailStep: directTrailStep,
      run: directRun,
    });

    const model = await loadTrailDetailReadModel(repository, directTrail.id);

    expect(model?.steps[0]?.runs[0]).toMatchObject({
      run: directRun,
      recipe: null,
    });
  });
});
