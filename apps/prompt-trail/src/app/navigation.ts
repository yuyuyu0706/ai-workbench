import { matchPath } from 'react-router-dom';

import { routeIds, routePaths, type RouteId } from './routes';

export type GlobalNavigationRouteId =
  | typeof routeIds.root
  | typeof routeIds.dashboard
  | typeof routeIds.promptLibrary;

export type ContextualRouteId =
  typeof routeIds.newTrail | typeof routeIds.runDetail;
export type RecoveryRouteId = typeof routeIds.notFound;

export interface NavigationItem {
  id: GlobalNavigationRouteId;
  label: string;
  path: (typeof routePaths)[GlobalNavigationRouteId];
}

export const contextualRouteIds = [
  routeIds.newTrail,
  routeIds.runDetail,
] as const satisfies readonly ContextualRouteId[];
export const recoveryRouteIds = [
  routeIds.notFound,
] as const satisfies readonly RecoveryRouteId[];

export const globalNavigationItems = [
  {
    id: routeIds.root,
    label: 'はじめに',
    path: routePaths.root,
  },
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
] as const satisfies readonly NavigationItem[];

const promptLibraryRoutePaths = [
  routePaths.promptLibrary,
  routePaths.promptNew,
  routePaths.promptEdit,
] as const;

export function getActiveNavigationItemId(
  pathname: string,
): GlobalNavigationRouteId | undefined {
  const normalizedPathname = normalizePathname(pathname);

  if (
    promptLibraryRoutePaths.some((path) =>
      matchPath({ path, end: true }, normalizedPathname),
    )
  ) {
    return routeIds.promptLibrary;
  }

  return globalNavigationItems.find((item) => item.path === normalizedPathname)
    ?.id;
}

export function isContextualRoute(routeId: RouteId) {
  return contextualRouteIds.includes(routeId as ContextualRouteId);
}

export function isRecoveryRoute(routeId: RouteId) {
  return recoveryRouteIds.includes(routeId as RecoveryRouteId);
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}
