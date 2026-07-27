import { describe, expect, it } from 'vitest';

import { DEFAULT_PROJECT_ID, type UtcDateTimeString } from '../domain';
import {
  DEVELOPER_DATA_SCENARIO_IDS,
  developerDataScenarios,
  getDeveloperDataScenario,
  type DeveloperDataScenario,
} from './index';

const allRecords = (scenario: DeveloperDataScenario) => [
  ...scenario.dataset.projects,
  ...scenario.dataset.prompts,
  ...scenario.dataset.contexts,
  ...scenario.dataset.recipes,
  ...scenario.dataset.runs,
  ...scenario.dataset.links,
];

const activeLinkCount = (
  scenario: DeveloperDataScenario,
  runId: string,
): number =>
  scenario.dataset.links.filter(
    (link) => link.runId === runId && link.deletedAt === null,
  ).length;

const expectUtcDateTime = (value: UtcDateTimeString): void => {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(Number.isNaN(Date.parse(value))).toBe(false);
};

const expectReferencesToBeConsistent = (
  scenario: DeveloperDataScenario,
): void => {
  const projectIds = new Set(
    scenario.dataset.projects.map((project) => project.id),
  );
  const promptById = new Map(
    scenario.dataset.prompts.map((prompt) => [prompt.id, prompt]),
  );
  const contextById = new Map(
    scenario.dataset.contexts.map((context) => [context.id, context]),
  );
  const recipeIds = new Set(
    scenario.dataset.recipes.map((recipe) => recipe.id),
  );
  const runIds = new Set(scenario.dataset.runs.map((run) => run.id));

  for (const prompt of scenario.dataset.prompts) {
    if (prompt.scope === 'project') {
      expect(projectIds.has(prompt.projectId)).toBe(true);
    }
  }

  for (const context of scenario.dataset.contexts) {
    if (context.scope === 'project') {
      expect(projectIds.has(context.projectId)).toBe(true);
    }
  }

  for (const recipe of scenario.dataset.recipes) {
    expect(projectIds.has(recipe.projectId)).toBe(true);
    expect(promptById.has(recipe.promptId)).toBe(true);
    for (const contextId of recipe.contextIds) {
      expect(contextById.has(contextId)).toBe(true);
    }
  }

  for (const run of scenario.dataset.runs) {
    expect(projectIds.has(run.projectId)).toBe(true);
    if (run.recipeId !== null) {
      expect(recipeIds.has(run.recipeId)).toBe(true);
    }

    const sourcePrompt = promptById.get(run.promptSnapshot.promptId);
    expect(sourcePrompt).toBeDefined();
    expect(run.promptSnapshot).toEqual({
      promptId: sourcePrompt?.id,
      title: sourcePrompt?.title,
      body: sourcePrompt?.body,
    });

    for (const snapshot of run.contextSnapshots) {
      const sourceContext = contextById.get(snapshot.contextId);
      expect(sourceContext).toBeDefined();
      expect(snapshot).toEqual({
        contextId: sourceContext?.id,
        title: sourceContext?.title,
        body: sourceContext?.body,
      });
    }
  }

  for (const link of scenario.dataset.links) {
    expect(runIds.has(link.runId)).toBe(true);
  }
};

describe('Developer Data Scenario Catalog', () => {
  it('publishes the fixed five-scenario catalog in a stable order', () => {
    expect(DEVELOPER_DATA_SCENARIO_IDS).toEqual([
      'empty',
      'standard',
      'reuse-ready',
      'dense',
      'legacy-compatible',
    ]);
    expect(new Set(DEVELOPER_DATA_SCENARIO_IDS).size).toBe(5);
    expect(developerDataScenarios.map((scenario) => scenario.id)).toEqual(
      DEVELOPER_DATA_SCENARIO_IDS,
    );

    for (const scenario of developerDataScenarios) {
      expect(getDeveloperDataScenario(scenario.id)).toBe(scenario);
      expect(scenario.label.trim()).not.toBe('');
      expect(scenario.description.trim()).not.toBe('');
    }
  });

  it('keeps expected counts, stable IDs, timestamps, and references consistent', () => {
    for (const scenario of developerDataScenarios) {
      expect(scenario.expectedCounts).toEqual({
        projects: scenario.dataset.projects.length,
        prompts: scenario.dataset.prompts.length,
        contexts: scenario.dataset.contexts.length,
        recipes: scenario.dataset.recipes.length,
        runs: scenario.dataset.runs.length,
        links: scenario.dataset.links.length,
      });

      const records = allRecords(scenario);
      const recordIds = records.map((record) => record.id);
      expect(new Set(recordIds).size).toBe(recordIds.length);

      for (const record of records) {
        expectUtcDateTime(record.createdAt);
        expectUtcDateTime(record.updatedAt);
        expect(Date.parse(record.createdAt)).toBeLessThanOrEqual(
          Date.parse(record.updatedAt),
        );

        if (record.deletedAt !== null) {
          expectUtcDateTime(record.deletedAt);
        }
        if ('archivedAt' in record && record.archivedAt !== null) {
          expectUtcDateTime(record.archivedAt);
        }

        expect('isSample' in record).toBe(false);
        expect('scenarioId' in record).toBe(false);
      }

      expectReferencesToBeConsistent(scenario);
    }
  });

  it('keeps dashboard link-count expectations limited to active Links', () => {
    for (const scenario of developerDataScenarios) {
      for (const expectation of scenario.expectations.dashboard
        .relatedLinkCounts) {
        expect(expectation.count).toBe(
          activeLinkCount(scenario, expectation.runId),
        );
      }
    }
  });

  it('represents an entirely empty Fresh DB scenario', () => {
    const scenario = getDeveloperDataScenario('empty');
    expect(allRecords(scenario)).toEqual([]);
    expect(scenario.expectations.dashboard.recentRunIds).toEqual([]);
    expect(scenario.expectations.runDetail.urlFallbackLinkIds).toEqual([]);
  });

  it('represents the current Direct Run and named-Link contract', () => {
    const scenario = getDeveloperDataScenario('standard');
    expect(scenario.dataset.projects).toHaveLength(1);
    expect(scenario.dataset.projects[0]?.id).toBe(DEFAULT_PROJECT_ID);
    expect(scenario.dataset.recipes).toEqual([]);
    expect(scenario.dataset.runs).toHaveLength(1);
    expect(scenario.dataset.runs[0]).toMatchObject({
      projectId: DEFAULT_PROJECT_ID,
      recipeId: null,
      status: 'prepared',
      contextSnapshots: [],
      inputValues: {},
    });
    expect(scenario.dataset.links.length).toBeGreaterThan(0);
    for (const link of scenario.dataset.links) {
      expect(link.title?.trim()).not.toBe('');
      expect(link.role).toBeNull();
      expect(link.deletedAt).toBeNull();
    }
  });

  it('provides one reusable source without implementing reuse itself', () => {
    const scenario = getDeveloperDataScenario('reuse-ready');
    expect(scenario.dataset.prompts).toHaveLength(1);
    expect(scenario.dataset.prompts[0]).toMatchObject({ status: 'active' });
    expect(scenario.dataset.runs).toHaveLength(1);
    expect(scenario.dataset.runs[0]).toMatchObject({
      recipeId: null,
      status: 'done',
    });
    expect(scenario.dataset.links.length).toBeGreaterThan(0);
    expect(
      allRecords(scenario).some((record) => 'reusedFromId' in record),
    ).toBe(false);
  });

  it('provides dense ordering, boundary strings, and varied active Link counts', () => {
    const scenario = getDeveloperDataScenario('dense');
    const activeRuns = scenario.dataset.runs.filter(
      (run) => run.deletedAt === null && run.archivedAt === null,
    );
    expect(activeRuns.length).toBeGreaterThanOrEqual(6);

    const expectedRecentRunIds = [...activeRuns]
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
      .slice(0, 5)
      .map((run) => run.id);
    expect(scenario.expectations.dashboard.recentRunIds).toEqual(
      expectedRecentRunIds,
    );

    const activeCounts = scenario.expectations.dashboard.relatedLinkCounts.map(
      (expectation) => expectation.count,
    );
    expect(activeCounts).toContain(0);
    expect(activeCounts).toContain(1);
    expect(activeCounts.some((count) => count > 1)).toBe(true);
    expect(scenario.dataset.links.some((link) => link.deletedAt !== null)).toBe(
      true,
    );
    expect(
      scenario.dataset.prompts.some((prompt) => prompt.title.length > 80),
    ).toBe(true);
    expect(
      scenario.dataset.prompts.some((prompt) => prompt.body.includes('\n')),
    ).toBe(true);
    expect(scenario.dataset.links.some((link) => link.url.length > 120)).toBe(
      true,
    );
  });

  it('preserves legacy Recipe Run, untitled Link, role, and external type values', () => {
    const scenario = getDeveloperDataScenario('legacy-compatible');
    expect(scenario.dataset.recipes).toHaveLength(1);
    expect(scenario.dataset.runs[0]?.recipeId).toBe(
      scenario.dataset.recipes[0]?.id,
    );
    expect(scenario.dataset.links.some((link) => link.role !== null)).toBe(
      true,
    );
    expect(
      scenario.dataset.links.some((link) => link.type === 'external'),
    ).toBe(true);

    const untitledLinkIds = scenario.dataset.links
      .filter((link) => link.title === null)
      .map((link) => link.id);
    expect(untitledLinkIds.length).toBeGreaterThan(0);
    expect(scenario.expectations.runDetail.urlFallbackLinkIds).toEqual(
      untitledLinkIds,
    );
  });
});
