import {
  RUN_STATUSES,
  type PromptId,
  type Run,
  type RunStatus,
  type Trail,
} from '../domain';
import type { PromptTrailRepository } from '../repository';

export type TrailListItem = {
  readonly trail: Trail;
  readonly title: string;
  readonly kind: Trail['kind'];
  readonly status: RunStatus;
  readonly updatedAt: Trail['updatedAt'];
  readonly runCount: number;
  readonly linkCount: number;
};

export type TrailListReadModel = {
  readonly trails: readonly TrailListItem[];
};

export type TrailListReadOptions = {
  readonly limit: number;
};

export async function loadTrailListReadModel(
  repository: PromptTrailRepository,
  options?: TrailListReadOptions,
): Promise<TrailListReadModel> {
  if (
    options !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 0)
  ) {
    throw new Error('limit must be a non-negative integer');
  }

  const projects = await repository.listActiveProjects();
  const trailsByProject = await Promise.all(
    projects.map((project) => repository.listActiveTrails(project.id)),
  );
  const trails = trailsByProject.flat();

  const items = await Promise.all(
    trails.map((trail) => buildTrailListItem(repository, trail)),
  );

  const sortedItems = items.sort(compareTrailByUpdatedAtDesc);
  const limitedItems =
    options === undefined ? sortedItems : sortedItems.slice(0, options.limit);

  return { trails: limitedItems };
}

/**
 * Trails a Prompt was used to create, most recently updated first.
 *
 * Looks up Runs via the promptSnapshot.promptId index (see
 * repository.listRunsByPrompt) rather than scanning every Trail, so cost
 * scales with the matching Runs, not the full Trail table.
 */
export async function listTrailsByPromptId(
  repository: PromptTrailRepository,
  promptId: PromptId,
  limit?: number,
): Promise<readonly TrailListItem[]> {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new Error('limit must be a non-negative integer');
  }

  const runs = await repository.listRunsByPrompt(promptId);
  const trailIds = [...new Set(runs.map((run) => run.trailId))];
  const candidateTrails = await Promise.all(
    trailIds.map((trailId) => repository.getTrail(trailId)),
  );
  const trails = candidateTrails.filter(
    (trail): trail is Trail =>
      trail !== null && trail.deletedAt === null && trail.archivedAt === null,
  );

  const items = await Promise.all(
    trails.map((trail) => buildTrailListItem(repository, trail)),
  );
  const sortedItems = items.sort(compareTrailByUpdatedAtDesc);

  return limit === undefined ? sortedItems : sortedItems.slice(0, limit);
}

async function buildTrailListItem(
  repository: PromptTrailRepository,
  trail: Trail,
): Promise<TrailListItem> {
  const runs = await repository.listRunsByTrail(trail.id);
  const linkCounts = await Promise.all(
    runs.map(async (run) => (await repository.listActiveLinks(run.id)).length),
  );
  const linkCount = linkCounts.reduce((sum, count) => sum + count, 0);

  return {
    trail,
    title: trail.title,
    kind: trail.kind,
    status: mostAdvancedStatus(runs),
    updatedAt: trail.updatedAt,
    runCount: runs.length,
    linkCount,
  } satisfies TrailListItem;
}

// A Trail with zero Runs cannot occur through normal creation flows (every
// Trail is created together with its first Run), so it is treated as
// 'draft', the least-advanced status, rather than modeled as a distinct case.
function mostAdvancedStatus(runs: readonly Run[]): RunStatus {
  let mostAdvancedIndex = 0;

  for (const run of runs) {
    const index = RUN_STATUSES.indexOf(run.status);
    if (index > mostAdvancedIndex) mostAdvancedIndex = index;
  }

  return RUN_STATUSES[mostAdvancedIndex];
}

function compareTrailByUpdatedAtDesc(
  first: TrailListItem,
  second: TrailListItem,
): number {
  const updatedAtComparison = second.trail.updatedAt.localeCompare(
    first.trail.updatedAt,
  );

  if (updatedAtComparison !== 0) {
    return updatedAtComparison;
  }

  return first.trail.id.localeCompare(second.trail.id);
}
