import { describe, expect, it } from 'vitest';

import { LINK_ROLES, LINK_TYPES } from '../domain';
import { SAMPLE_IDS, SAMPLE_ID_SET, sampleDataset } from './index';

const allSampleIds = [
  sampleDataset.project.id,
  sampleDataset.prompt.id,
  sampleDataset.context.id,
  sampleDataset.recipe.id,
  sampleDataset.run.id,
  ...sampleDataset.links.map((link) => link.id),
];

const dateValue = (value: string): number => new Date(value).getTime();

describe('Sample Dataset Contract', () => {
  it('fixes unique stable IDs for sample identification without domain sample flags', () => {
    expect(allSampleIds).toHaveLength(8);
    expect(new Set(allSampleIds).size).toBe(allSampleIds.length);
    expect(SAMPLE_ID_SET).toEqual(new Set(allSampleIds));
    expect(SAMPLE_IDS).toEqual({
      project: 'sample-project-prompttrail-development',
      prompt: 'sample-prompt-github-issue-request',
      context: 'sample-context-ai-driven-development',
      recipe: 'sample-recipe-codex-development-request',
      run: 'sample-run-roadmap-resync',
      links: {
        chat: 'sample-link-chat',
        issue100: 'sample-link-issue-100',
        pr101: 'sample-link-pr-101',
      },
    });
    expect('isSample' in sampleDataset.project).toBe(false);
    expect('isSample' in sampleDataset.run).toBe(false);
  });

  it('fixes the expected model counts', () => {
    expect(sampleDataset.expectedCounts).toEqual({
      projects: 1,
      prompts: 1,
      contexts: 1,
      recipes: 1,
      runs: 1,
      links: 3,
    });
    expect(sampleDataset.project).toBeDefined();
    expect(sampleDataset.prompt).toBeDefined();
    expect(sampleDataset.context).toBeDefined();
    expect(sampleDataset.recipe).toBeDefined();
    expect(sampleDataset.run).toBeDefined();
    expect(sampleDataset.links).toHaveLength(
      sampleDataset.expectedCounts.links,
    );
  });

  it('keeps project ownership and recipe references consistent', () => {
    expect(sampleDataset.prompt).toMatchObject({
      scope: 'project',
      projectId: sampleDataset.project.id,
      kind: 'issue-creation',
      status: 'active',
    });
    expect(sampleDataset.context).toMatchObject({
      scope: 'project',
      projectId: sampleDataset.project.id,
      kind: 'development-rules',
      status: 'enabled',
    });
    expect(sampleDataset.recipe).toMatchObject({
      projectId: sampleDataset.project.id,
      promptId: sampleDataset.prompt.id,
      contextIds: [sampleDataset.context.id],
    });
  });

  it('freezes run snapshots, input values, status, and evaluation', () => {
    expect(sampleDataset.run).toMatchObject({
      projectId: sampleDataset.project.id,
      recipeId: sampleDataset.recipe.id,
      status: 'done',
      evaluation: 'good',
      inputValues: {
        roadmapTarget: 'Phase 0',
        sourceIssue: 100,
        resultPullRequest: 101,
      },
    });
    expect(sampleDataset.run.promptSnapshot).toEqual({
      promptId: sampleDataset.prompt.id,
      title: sampleDataset.prompt.title,
      body: sampleDataset.prompt.body,
    });
    expect(sampleDataset.run.contextSnapshots).toEqual([
      {
        contextId: sampleDataset.context.id,
        title: sampleDataset.context.title,
        body: sampleDataset.context.body,
      },
    ]);
  });

  it('connects multiple links to the run with existing type and role contracts', () => {
    expect(sampleDataset.links.map((link) => link.runId)).toEqual([
      sampleDataset.run.id,
      sampleDataset.run.id,
      sampleDataset.run.id,
    ]);
    expect(sampleDataset.links.map((link) => [link.type, link.role])).toEqual([
      ['chat', 'source'],
      ['issue', 'execution'],
      ['pull-request', 'result'],
    ]);
    for (const link of sampleDataset.links) {
      expect(LINK_TYPES).toContain(link.type);
      expect(LINK_ROLES).toContain(link.role);
    }
  });

  it('uses a fixed non-contradictory timeline', () => {
    const timeline = sampleDataset.timeline;
    expect(dateValue(timeline.projectCreatedAt)).toBeLessThan(
      dateValue(timeline.assetsCreatedAt),
    );
    expect(dateValue(timeline.assetsCreatedAt)).toBeLessThan(
      dateValue(timeline.recipeCreatedAt),
    );
    expect(dateValue(timeline.recipeCreatedAt)).toBeLessThan(
      dateValue(timeline.runStartedAt),
    );
    expect(dateValue(timeline.runStartedAt)).toBeLessThan(
      dateValue(timeline.chatLinkedAt),
    );
    expect(dateValue(timeline.chatLinkedAt)).toBeLessThan(
      dateValue(timeline.issueLinkedAt),
    );
    expect(dateValue(timeline.issueLinkedAt)).toBeLessThan(
      dateValue(timeline.prLinkedAt),
    );
    expect(dateValue(timeline.prLinkedAt)).toBeLessThan(
      dateValue(timeline.runUpdatedAt),
    );
    expect(sampleDataset.run.createdAt).toBe(timeline.runStartedAt);
    expect(sampleDataset.run.updatedAt).toBe(timeline.runUpdatedAt);
  });
});
