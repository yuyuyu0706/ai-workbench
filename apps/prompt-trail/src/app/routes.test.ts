import { describe, expect, it } from 'vitest';

import { buildRunDetailPath, routeIds, routePaths } from './routes';

describe('route contract', () => {
  it('defines the PromptTrail screen paths in one route map', () => {
    expect(routePaths).toEqual({
      [routeIds.root]: '/',
      [routeIds.dashboard]: '/dashboard',
      [routeIds.promptLibrary]: '/prompts',
      [routeIds.contextLibrary]: '/contexts',
      [routeIds.recipeBuilder]: '/recipes/builder',
      [routeIds.runDetail]: '/runs/:runId',
      [routeIds.notFound]: '*',
    });
  });

  it('builds URL-encoded Run Detail paths', () => {
    expect(buildRunDetailPath('run 1/with symbols?')).toBe(
      '/runs/run%201%2Fwith%20symbols%3F',
    );
  });
});
