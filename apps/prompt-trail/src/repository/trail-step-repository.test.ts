import { afterEach, describe, expect, it } from 'vitest';

import type { Prompt, Trail, TrailStep, UtcDateTimeString } from '../domain';
import { createDefaultProject, DEFAULT_PROJECT_ID } from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from './index';

const scope = createDatabaseTestScope('trail-step-repository');
const oldTime = '2026-08-10T00:00:00.000Z' as UtcDateTimeString;
const newTime = '2026-08-10T01:00:00.000Z' as UtcDateTimeString;

afterEach(() => scope.cleanup());

async function prepare() {
  const database = scope.createDatabase();
  const repository = new PromptTrailRepository(database);
  const project = createDefaultProject(oldTime);
  const promptId = 'prompt-1' as Prompt['id'];
  const trailId = 'trail-1' as Trail['id'];
  const prompt: Prompt = {
    id: promptId,
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    scope: 'project',
    projectId: DEFAULT_PROJECT_ID,
    title: 'Prompt',
    body: 'Body',
    status: 'active',
    tags: [],
    variableValues: {},
  };
  const trail: Trail = {
    id: trailId,
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    archivedAt: null,
    projectId: DEFAULT_PROJECT_ID,
    title: 'Trail',
    kind: 'other',
  };
  await repository.saveProject(project);
  await repository.savePrompt(prompt);
  await repository.saveTrail(trail);
  return { database, repository, project, prompt, trail };
}

function buildStepInput(
  trail: Trail,
  overrides: Partial<Omit<TrailStep, 'order'>> = {},
): Omit<TrailStep, 'order'> {
  return {
    id: `trail-step-${Math.random().toString(36).slice(2)}` as TrailStep['id'],
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    trailId: trail.id,
    kind: 'prompt',
    title: 'Step',
    promptId: 'prompt-1' as Prompt['id'],
    note: null,
    ...overrides,
  };
}

describe('addTrailStep', () => {
  it('assigns order 1 to the first Step and appends subsequent Steps at max(order) + 1', async () => {
    const { repository, trail } = await prepare();

    const first = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-1' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: newTime,
    });
    expect(first.order).toBe(1);

    const second = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-2' as TrailStep['id'],
        kind: 'manual',
        promptId: null,
      }),
      expectedUpdatedAt: newTime,
      updatedAt: newTime,
    });
    expect(second.order).toBe(2);

    await expect(repository.listStepsByTrail(trail.id)).resolves.toEqual([
      first,
      second,
    ]);
  });

  it('rejects a stale expectedUpdatedAt without adding the Step', async () => {
    const { repository, trail } = await prepare();

    await expect(
      repository.addTrailStep({
        trailStep: buildStepInput(trail),
        expectedUpdatedAt: newTime,
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'stale-write' });
    await expect(repository.listStepsByTrail(trail.id)).resolves.toEqual([]);
  });

  it('rejects kind manual with a non-null promptId', async () => {
    const { repository, trail } = await prepare();

    await expect(
      repository.addTrailStep({
        trailStep: buildStepInput(trail, { kind: 'manual' }),
        expectedUpdatedAt: oldTime,
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'snapshot-mismatch' });
  });

  it('rejects kind prompt with a null promptId', async () => {
    const { repository, trail } = await prepare();

    await expect(
      repository.addTrailStep({
        trailStep: buildStepInput(trail, { promptId: null }),
        expectedUpdatedAt: oldTime,
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'snapshot-mismatch' });
  });

  it('rejects a duplicate Trail Step ID with the repository duplicate-id error', async () => {
    const { repository, trail } = await prepare();

    const first = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-duplicate' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: newTime,
    });

    await expect(
      repository.addTrailStep({
        trailStep: buildStepInput(trail, { id: first.id }),
        expectedUpdatedAt: newTime,
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'duplicate-id' });
    await expect(repository.listStepsByTrail(trail.id)).resolves.toEqual([
      first,
    ]);
  });
});

describe('updateTrailStep', () => {
  it('updates title, kind, promptId, and note without changing order', async () => {
    const { repository, trail } = await prepare();
    const step = await repository.addTrailStep({
      trailStep: buildStepInput(trail),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });

    const updated = await repository.updateTrailStep({
      trailStepId: step.id,
      expectedUpdatedAt: oldTime,
      title: 'Renamed',
      kind: 'manual',
      promptId: null,
      note: 'Manual follow-up',
      updatedAt: newTime,
    });

    expect(updated).toMatchObject({
      id: step.id,
      order: step.order,
      title: 'Renamed',
      kind: 'manual',
      promptId: null,
      note: 'Manual follow-up',
    });
  });
});

describe('reorderTrailSteps', () => {
  it('renumbers Steps to 1..N in the given order', async () => {
    const { repository, trail } = await prepare();
    const first = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-1' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });
    const second = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-2' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });
    const third = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-3' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });

    const reordered = await repository.reorderTrailSteps({
      trailId: trail.id,
      orderedStepIds: [third.id, first.id, second.id],
      expectedUpdatedAt: oldTime,
      updatedAt: newTime,
    });

    expect(reordered.map((step) => [step.id, step.order])).toEqual([
      [third.id, 1],
      [first.id, 2],
      [second.id, 3],
    ]);
    await expect(repository.listStepsByTrail(trail.id)).resolves.toEqual(
      reordered,
    );
  });

  it('rejects an orderedStepIds array that does not match the current Step set', async () => {
    const { repository, trail } = await prepare();
    await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-1' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });

    await expect(
      repository.reorderTrailSteps({
        trailId: trail.id,
        orderedStepIds: ['missing-step' as TrailStep['id']],
        expectedUpdatedAt: oldTime,
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
  });
});

describe('softDeleteTrailStep', () => {
  it('renumbers the remaining Steps to 1..N after a delete', async () => {
    const { repository, trail } = await prepare();
    const first = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-1' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });
    const second = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-2' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });
    const third = await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-3' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });

    await repository.softDeleteTrailStep({
      trailId: trail.id,
      trailStepId: first.id,
      deletedAt: newTime,
      expectedUpdatedAt: oldTime,
      updatedAt: newTime,
    });

    const remaining = await repository.listStepsByTrail(trail.id);
    expect(remaining.map((step) => [step.id, step.order])).toEqual([
      [second.id, 1],
      [third.id, 2],
    ]);
  });
});

describe('listStepsByTrail', () => {
  it('rejects reading active Steps with a duplicate order', async () => {
    const { database, repository, trail } = await prepare();

    await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-1' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });
    await repository.addTrailStep({
      trailStep: buildStepInput(trail, {
        id: 'trail-step-2' as TrailStep['id'],
      }),
      expectedUpdatedAt: oldTime,
      updatedAt: oldTime,
    });

    // Simulate corrupted data that bypassed the repository's write path.
    await database.trailSteps.update('trail-step-2' as TrailStep['id'], {
      order: 1,
    });

    await expect(repository.listStepsByTrail(trail.id)).rejects.toMatchObject({
      code: 'duplicate-step-order',
    });
  });
});
