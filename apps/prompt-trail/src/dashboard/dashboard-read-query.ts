import type { Link, Project, Recipe, Run } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type DashboardRecentRun = {
  readonly run: Run;
  readonly project: Project;
  readonly recipe: Recipe | null;
  readonly links: readonly Link[];
};

export type DashboardReadModel = {
  readonly recentRuns: readonly DashboardRecentRun[];
};

export type DashboardReadOptions = {
  readonly recentRunLimit: number;
};

type RunWithProject = {
  readonly run: Run;
  readonly project: Project;
};

export async function loadDashboardReadModel(
  repository: PromptTrailRepository,
  options: DashboardReadOptions,
): Promise<DashboardReadModel> {
  if (!Number.isInteger(options.recentRunLimit) || options.recentRunLimit < 0) {
    throw new Error('recentRunLimit must be a non-negative integer');
  }

  const projects = await repository.listActiveProjects();
  const runsByProject = await Promise.all(
    projects.map(async (project) => ({
      project,
      runs: await repository.listActiveRuns(project.id),
    })),
  );

  const recentRunSources = runsByProject
    .flatMap(({ project, runs }) => runs.map((run) => ({ project, run })))
    .sort(compareRunWithProjectByUpdatedAtDesc)
    .slice(0, options.recentRunLimit);

  const recentRuns = await Promise.all(
    recentRunSources.map(async ({ project, run }) => {
      const [recipe, links] = await Promise.all([
        run.recipeId === null
          ? Promise.resolve(null)
          : repository.getRecipe(run.recipeId),
        repository.listActiveLinks(run.id),
      ]);

      if (run.recipeId !== null && recipe === null) {
        throw new Error(`Recipe not found for dashboard run: ${run.recipeId}`);
      }

      return {
        run,
        project,
        recipe,
        links,
      } satisfies DashboardRecentRun;
    }),
  );

  return { recentRuns };
}

function compareRunWithProjectByUpdatedAtDesc(
  first: RunWithProject,
  second: RunWithProject,
): number {
  const updatedAtComparison = second.run.updatedAt.localeCompare(
    first.run.updatedAt,
  );

  if (updatedAtComparison !== 0) {
    return updatedAtComparison;
  }

  return first.run.id.localeCompare(second.run.id);
}
