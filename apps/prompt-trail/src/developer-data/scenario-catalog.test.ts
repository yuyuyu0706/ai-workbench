import { describe, expect, it } from 'vitest';

import { DEFAULT_PROJECT_ID } from '../domain';
import {
  DEVELOPER_DATA_SCENARIO_IDS,
  developerDataScenarios,
  getDeveloperDataScenario,
} from './index';

const countKeys = [
  'projects',
  'prompts',
  'contexts',
  'recipes',
  'runs',
  'links',
] as const;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('developer data scenario catalog', () => {
  it('publishes the five ordered, unique scenarios and resolves each ID', () => {
    expect(DEVELOPER_DATA_SCENARIO_IDS).toEqual([
      'empty',
      'standard',
      'reuse-ready',
      'dense',
      'legacy-compatible',
    ]);
    expect(developerDataScenarios.map(({ id }) => id)).toEqual(
      DEVELOPER_DATA_SCENARIO_IDS,
    );
    expect(Object.isFrozen(developerDataScenarios)).toBe(true);
    expect(new Set(DEVELOPER_DATA_SCENARIO_IDS)).toHaveLength(5);
    for (const scenario of developerDataScenarios) {
      expect(getDeveloperDataScenario(scenario.id)).toBe(scenario);
      expect(scenario.label.trim()).not.toBe('');
      expect(scenario.description.trim()).not.toBe('');
    }
  });

  it('matches expected active counts and keeps IDs unique within each scenario', () => {
    for (const scenario of developerDataScenarios) {
      for (const key of countKeys) {
        const activeRecords = scenario.dataset[key].filter(
          ({ deletedAt }) => deletedAt === null,
        );
        expect(activeRecords, `${scenario.id}.${key}`).toHaveLength(
          scenario.expectedCounts[key],
        );
      }
      const ids = countKeys.flatMap((key) =>
        scenario.dataset[key].map(({ id }) => id),
      );
      expect(new Set(ids), scenario.id).toHaveLength(ids.length);
    }
  });

  it('uses fixed UTC timestamps with valid entity lifecycles', () => {
    for (const scenario of developerDataScenarios) {
      for (const key of countKeys) {
        for (const entity of scenario.dataset[key]) {
          expect(entity.createdAt).toMatch(utcPattern);
          expect(entity.updatedAt).toMatch(utcPattern);
          expect(entity.createdAt <= entity.updatedAt).toBe(true);
          if (entity.deletedAt !== null) {
            expect(entity.deletedAt).toMatch(utcPattern);
            expect(entity.updatedAt <= entity.deletedAt).toBe(true);
          }
        }
      }
    }
  });

  it('keeps all model references internally consistent', () => {
    for (const { dataset } of developerDataScenarios) {
      const projectIds = new Set(dataset.projects.map(({ id }) => id));
      const promptIds = new Set(dataset.prompts.map(({ id }) => id));
      const contextIds = new Set(dataset.contexts.map(({ id }) => id));
      const recipeIds = new Set(dataset.recipes.map(({ id }) => id));
      const runIds = new Set(dataset.runs.map(({ id }) => id));
      for (const prompt of dataset.prompts)
        if (prompt.scope === 'project')
          expect(projectIds.has(prompt.projectId)).toBe(true);
      for (const context of dataset.contexts)
        if (context.scope === 'project')
          expect(projectIds.has(context.projectId)).toBe(true);
      for (const recipe of dataset.recipes) {
        expect(projectIds.has(recipe.projectId)).toBe(true);
        expect(promptIds.has(recipe.promptId)).toBe(true);
        expect(recipe.contextIds.every((id) => contextIds.has(id))).toBe(true);
      }
      for (const run of dataset.runs) {
        expect(projectIds.has(run.projectId)).toBe(true);
        expect(promptIds.has(run.promptSnapshot.promptId)).toBe(true);
        expect(
          run.contextSnapshots.every(({ contextId }) =>
            contextIds.has(contextId),
          ),
        ).toBe(true);
        if (run.recipeId !== null)
          expect(recipeIds.has(run.recipeId)).toBe(true);
      }
      for (const link of dataset.links)
        expect(runIds.has(link.runId)).toBe(true);
    }
  });

  it('represents the empty and current standard Direct Run contracts', () => {
    expect(
      countKeys.every(
        (key) => getDeveloperDataScenario('empty').dataset[key].length === 0,
      ),
    ).toBe(true);
    const standard = getDeveloperDataScenario('standard');
    expect(standard.dataset.projects[0].id).toBe(DEFAULT_PROJECT_ID);
    expect(standard.dataset.prompts[0]).toMatchObject({
      scope: 'project',
      projectId: DEFAULT_PROJECT_ID,
      status: 'active',
    });
    expect(standard.dataset.runs[0]).toMatchObject({
      projectId: DEFAULT_PROJECT_ID,
      recipeId: null,
      contextSnapshots: [],
      inputValues: {},
    });
    expect(standard.dataset.links[0]).toMatchObject({ role: null });
    expect(standard.dataset.links[0].title).not.toBeNull();
  });

  it('contains only a completed source trail in reuse-ready', () => {
    const reuseReady = getDeveloperDataScenario('reuse-ready');
    expect(reuseReady.dataset.prompts).toHaveLength(1);
    expect(reuseReady.dataset.prompts[0].status).toBe('active');
    expect(reuseReady.dataset.runs).toHaveLength(1);
    expect(reuseReady.dataset.runs[0].status).toBe('done');
    expect(reuseReady.dataset.links[0].title).not.toBeNull();
  });

  it('defines dense dashboard ordering and active link-count oracles', () => {
    const dense = getDeveloperDataScenario('dense');
    expect(dense.dataset.runs).toHaveLength(7);
    expect(
      new Set(dense.dataset.runs.map(({ status }) => status)).size,
    ).toBeGreaterThan(1);
    const expectedRecentIds = [...dense.dataset.runs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)
      .map(({ id }) => id);
    expect(dense.expectations.dashboard.recentRunIds).toEqual(
      expectedRecentIds,
    );
    const activeCounts = dense.dataset.runs.map(
      ({ id }) =>
        dense.dataset.links.filter(
          ({ runId, deletedAt }) => runId === id && deletedAt === null,
        ).length,
    );
    expect(activeCounts).toContain(0);
    expect(activeCounts).toContain(1);
    expect(activeCounts.some((count) => count > 1)).toBe(true);
    expect(
      dense.dataset.links.some(({ deletedAt }) => deletedAt !== null),
    ).toBe(true);
    expect(
      dense.expectations.dashboard.relatedLinkCounts.map(({ count }) => count),
    ).toEqual(activeCounts);
  });

  it('preserves the legacy Recipe Run and unnamed external Link', () => {
    const legacy = getDeveloperDataScenario('legacy-compatible');
    expect(legacy.dataset.runs[0].recipeId).toBe(legacy.dataset.recipes[0].id);
    const unnamed = legacy.dataset.links[0];
    expect(unnamed).toMatchObject({
      title: null,
      type: 'external',
      role: 'source',
    });
    expect(legacy.expectations.runDetail.urlFallbackLinkIds).toEqual([
      unnamed.id,
    ]);
  });
});
