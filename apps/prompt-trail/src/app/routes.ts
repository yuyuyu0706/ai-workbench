export const routeIds = {
  root: 'root',
  dashboard: 'dashboard',
  promptLibrary: 'promptLibrary',
  promptNew: 'promptNew',
  promptEdit: 'promptEdit',
  contextLibrary: 'contextLibrary',
  recipeBuilder: 'recipeBuilder',
  newTrail: 'newTrail',
  trailList: 'trailList',
  trailDetail: 'trailDetail',
  notFound: 'notFound',
} as const;

export type RouteId = (typeof routeIds)[keyof typeof routeIds];

export const routePaths = {
  [routeIds.root]: '/',
  [routeIds.dashboard]: '/dashboard',
  [routeIds.promptLibrary]: '/prompts',
  [routeIds.promptNew]: '/prompts/new',
  [routeIds.promptEdit]: '/prompts/:promptId/edit',
  [routeIds.contextLibrary]: '/contexts',
  [routeIds.recipeBuilder]: '/recipes/builder',
  [routeIds.newTrail]: '/trails/new',
  [routeIds.trailList]: '/trails',
  [routeIds.trailDetail]: '/trails/:trailId',
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
  { id: routeIds.promptNew, path: routePaths.promptNew, label: 'New Prompt' },
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
    id: routeIds.trailList,
    path: routePaths.trailList,
    label: 'Trail List',
  },
  {
    id: routeIds.trailDetail,
    path: routePaths.trailDetail,
    label: 'Trail Detail',
  },
  { id: routeIds.notFound, path: routePaths.notFound, label: 'Not Found' },
] as const satisfies readonly RouteDefinition[];

export function buildTrailDetailPath(trailId: string) {
  return `/trails/${encodeURIComponent(trailId)}`;
}

export function buildPromptEditPath(promptId: string) {
  return `/prompts/${encodeURIComponent(promptId)}/edit`;
}

export function buildNewTrailReusePath(runId: string) {
  const search = new URLSearchParams({ sourceRunId: runId });
  return `${routePaths.newTrail}?${search.toString()}`;
}

export function buildNewTrailFromPromptPath(promptId: string) {
  const search = new URLSearchParams({ sourcePromptId: promptId });
  return `${routePaths.newTrail}?${search.toString()}`;
}

export const trailListPromptIdParam = 'promptId';

export function buildTrailListByPromptPath(promptId: string) {
  const search = new URLSearchParams({ [trailListPromptIdParam]: promptId });
  return `${routePaths.trailList}?${search.toString()}`;
}
