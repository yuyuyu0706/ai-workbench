export const routeIds = {
  root: 'root',
  dashboard: 'dashboard',
  promptLibrary: 'promptLibrary',
  contextLibrary: 'contextLibrary',
  recipeBuilder: 'recipeBuilder',
  newTrail: 'newTrail',
  runDetail: 'runDetail',
  notFound: 'notFound',
} as const;

export type RouteId = (typeof routeIds)[keyof typeof routeIds];

export const routePaths = {
  [routeIds.root]: '/',
  [routeIds.dashboard]: '/dashboard',
  [routeIds.promptLibrary]: '/prompts',
  [routeIds.contextLibrary]: '/contexts',
  [routeIds.recipeBuilder]: '/recipes/builder',
  [routeIds.newTrail]: '/runs/new',
  [routeIds.runDetail]: '/runs/:runId',
  [routeIds.notFound]: '*',
} as const satisfies Record<RouteId, string>;

export type RoutePath = (typeof routePaths)[RouteId];

export interface RouteDefinition {
  id: RouteId;
  path: RoutePath;
  label: string;
}

export const routeDefinitions = [
  { id: routeIds.root, path: routePaths.root, label: 'Root' },
  { id: routeIds.dashboard, path: routePaths.dashboard, label: 'Dashboard' },
  {
    id: routeIds.promptLibrary,
    path: routePaths.promptLibrary,
    label: 'Prompt Library',
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
  { id: routeIds.runDetail, path: routePaths.runDetail, label: 'Run Detail' },
  { id: routeIds.notFound, path: routePaths.notFound, label: 'Not Found' },
] as const satisfies readonly RouteDefinition[];

export function buildRunDetailPath(runId: string) {
  return `/runs/${encodeURIComponent(runId)}`;
}
