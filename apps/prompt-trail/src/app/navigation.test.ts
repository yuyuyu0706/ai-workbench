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
  it('contains the Public Alpha guide, Dashboard, and Prompt Library', () => {
    expect(globalNavigationItems).toEqual([
      { id: routeIds.root, label: 'はじめに', path: routePaths.root },
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
    ]);
  });

  it('keeps Run Detail contextual and Not Found recoverable instead of global', () => {
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.trailDetail,
    );
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.newTrail,
    );
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.notFound,
    );
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.contextLibrary,
    );
    expect(globalNavigationItems.map((item) => item.id)).not.toContain(
      routeIds.recipeBuilder,
    );
    expect(contextualRouteIds).toEqual([
      routeIds.newTrail,
      routeIds.trailDetail,
    ]);
    expect(recoveryRouteIds).toEqual([routeIds.notFound]);
    expect(isContextualRoute(routeIds.newTrail)).toBe(true);
    expect(isContextualRoute(routeIds.trailDetail)).toBe(true);
    expect(isRecoveryRoute(routeIds.notFound)).toBe(true);
  });

  it('resolves active global navigation from the current pathname', () => {
    expect(getActiveNavigationItemId('/dashboard')).toBe(routeIds.dashboard);
    expect(getActiveNavigationItemId('/prompts')).toBe(routeIds.promptLibrary);
    expect(getActiveNavigationItemId('/prompts/')).toBe(routeIds.promptLibrary);
    expect(getActiveNavigationItemId('/prompts/new')).toBe(
      routeIds.promptLibrary,
    );
    expect(getActiveNavigationItemId('/prompts/new/')).toBe(
      routeIds.promptLibrary,
    );
    expect(getActiveNavigationItemId('/prompts/prompt-1/edit')).toBe(
      routeIds.promptLibrary,
    );
    expect(getActiveNavigationItemId('/prompts/prompt-1/edit/')).toBe(
      routeIds.promptLibrary,
    );
    expect(getActiveNavigationItemId('/contexts')).toBeUndefined();
    expect(getActiveNavigationItemId('/recipes/builder')).toBeUndefined();
    expect(getActiveNavigationItemId('/dashboard/')).toBe(routeIds.dashboard);
    expect(getActiveNavigationItemId('/trails/trail-1')).toBeUndefined();
    expect(getActiveNavigationItemId('/trails/new')).toBeUndefined();
    expect(getActiveNavigationItemId('/prompts/unknown')).toBeUndefined();
    expect(getActiveNavigationItemId('/prompts/prompt-1')).toBeUndefined();
    expect(
      getActiveNavigationItemId('/prompts/prompt-1/unknown'),
    ).toBeUndefined();
    expect(getActiveNavigationItemId('/unknown')).toBeUndefined();
    expect(getActiveNavigationItemId('/')).toBe(routeIds.root);
  });
});
