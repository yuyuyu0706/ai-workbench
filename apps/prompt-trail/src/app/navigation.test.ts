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
  it('contains only the Public Alpha guide and Dashboard', () => {
    expect(globalNavigationItems).toEqual([
      { id: routeIds.root, label: 'はじめに', path: routePaths.root },
      {
        id: routeIds.dashboard,
        label: 'Dashboard',
        path: routePaths.dashboard,
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
    expect(getActiveNavigationItemId('/prompts')).toBeUndefined();
    expect(getActiveNavigationItemId('/contexts')).toBeUndefined();
    expect(getActiveNavigationItemId('/recipes/builder')).toBeUndefined();
    expect(getActiveNavigationItemId('/dashboard/')).toBe(routeIds.dashboard);
    expect(getActiveNavigationItemId('/runs/run-1')).toBeUndefined();
    expect(getActiveNavigationItemId('/unknown')).toBeUndefined();
    expect(getActiveNavigationItemId('/')).toBe(routeIds.root);
  });
});
