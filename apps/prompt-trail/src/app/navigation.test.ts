import { describe, expect, it } from 'vitest';

import {
  contextualRouteIds,
  getActiveNavigationItemId,
  globalNavigationItems,
  isContextualRoute,
  isRecoveryRoute,
  recoveryRouteIds,
} from './navigation';
import { routeIds, routePaths } from './routes';

describe('navigation contract', () => {
  it('contains only the global navigation route items', () => {
    expect(globalNavigationItems).toEqual([
      {
        id: routeIds.dashboard,
        label: 'Dashboard',
        path: routePaths.dashboard,
      },
      {
        id: routeIds.promptLibrary,
        label: 'Prompt Library',
        path: routePaths.promptLibrary,
      },
      {
        id: routeIds.contextLibrary,
        label: 'Context Library',
        path: routePaths.contextLibrary,
      },
      {
        id: routeIds.recipeBuilder,
        label: 'Recipe Builder',
        path: routePaths.recipeBuilder,
      },
    ]);
  });

  it('keeps Run Detail contextual and Not Found recoverable instead of global', () => {
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.runDetail,
    );
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.newTrail,
    );
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.notFound,
    );
    expect(contextualRouteIds).toEqual([routeIds.newTrail, routeIds.runDetail]);
    expect(recoveryRouteIds).toEqual([routeIds.notFound]);
    expect(isContextualRoute(routeIds.newTrail)).toBe(true);
    expect(isContextualRoute(routeIds.runDetail)).toBe(true);
    expect(isRecoveryRoute(routeIds.notFound)).toBe(true);
  });

  it('resolves active global navigation from the current pathname', () => {
    expect(getActiveNavigationItemId('/dashboard')).toBe(routeIds.dashboard);
    expect(getActiveNavigationItemId('/prompts')).toBe(routeIds.promptLibrary);
    expect(getActiveNavigationItemId('/contexts')).toBe(
      routeIds.contextLibrary,
    );
    expect(getActiveNavigationItemId('/recipes/builder')).toBe(
      routeIds.recipeBuilder,
    );
    expect(getActiveNavigationItemId('/dashboard/')).toBe(routeIds.dashboard);
    expect(getActiveNavigationItemId('/runs/run-1')).toBeUndefined();
    expect(getActiveNavigationItemId('/unknown')).toBeUndefined();
    expect(getActiveNavigationItemId('/')).toBeUndefined();
  });
});
