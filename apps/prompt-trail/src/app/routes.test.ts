import { describe, expect, it } from 'vitest';

import {
  buildPromptEditPath,
  buildRunDetailPath,
  buildNewTrailReusePath,
  routeDefinitions,
  routeIds,
  routePaths,
} from './routes';

describe('route contract', () => {
  it('defines the PromptTrail screen paths in one route map', () => {
    expect(routePaths).toEqual({
      [routeIds.root]: '/',
      [routeIds.dashboard]: '/dashboard',
      [routeIds.promptLibrary]: '/prompts',
      [routeIds.promptNew]: '/prompts/new',
      [routeIds.promptEdit]: '/prompts/:promptId/edit',
      [routeIds.contextLibrary]: '/contexts',
      [routeIds.recipeBuilder]: '/recipes/builder',
      [routeIds.newTrail]: '/runs/new',
      [routeIds.runList]: '/runs',
      [routeIds.runDetail]: '/runs/:runId',
      [routeIds.notFound]: '*',
    });
  });

  it('keeps route definitions aligned with the route map and labels', () => {
    expect(routeDefinitions).toEqual([
      { id: routeIds.root, path: routePaths.root, label: 'Root' },
      {
        id: routeIds.dashboard,
        path: routePaths.dashboard,
        label: 'Dashboard',
      },
      {
        id: routeIds.promptLibrary,
        path: routePaths.promptLibrary,
        label: 'Prompt Library',
      },
      {
        id: routeIds.promptNew,
        path: routePaths.promptNew,
        label: 'New Prompt',
      },
      {
        id: routeIds.promptEdit,
        path: routePaths.promptEdit,
        label: 'Edit Prompt',
      },
      {
        id: routeIds.contextLibrary,
        path: routePaths.contextLibrary,
        label: 'Context Library',
      },
      {
        id: routeIds.recipeBuilder,
        path: routePaths.recipeBuilder,
        label: 'Recipe Builder',
      },
      { id: routeIds.newTrail, path: routePaths.newTrail, label: 'New Trail' },
      {
        id: routeIds.runList,
        path: routePaths.runList,
        label: 'Run List',
      },
      {
        id: routeIds.runDetail,
        path: routePaths.runDetail,
        label: 'Run Detail',
      },
      { id: routeIds.notFound, path: routePaths.notFound, label: 'Not Found' },
    ]);
  });

  it('builds URL-encoded Run Detail paths', () => {
    expect(buildRunDetailPath('run 1/with symbols?')).toBe(
      '/runs/run%201%2Fwith%20symbols%3F',
    );
  });

  it('builds URL-encoded Prompt edit paths', () => {
    expect(buildPromptEditPath('prompt 1/with symbols?')).toBe(
      '/prompts/prompt%201%2Fwith%20symbols%3F/edit',
    );
  });

  it('builds URL-encoded New Trail reuse paths', () => {
    expect(buildNewTrailReusePath('run 1/with symbols?&')).toBe(
      '/runs/new?sourceRunId=run+1%2Fwith+symbols%3F%26',
    );
  });
});
