import type { Link, Project, Recipe, Run, Trail, TrailId } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type TrailDetailRunItem = {
  readonly run: Run;
  readonly project: Project;
  readonly recipe: Recipe | null;
  readonly links: readonly Link[];
};

export type TrailDetailReadModel = {
  readonly trail: Trail;
  readonly runs: readonly TrailDetailRunItem[];
};

export async function loadTrailDetailReadModel(
  repository: PromptTrailRepository,
  trailId: TrailId,
): Promise<TrailDetailReadModel | null> {
  const trail = await repository.getTrail(trailId);
  if (trail === null) return null;

  const runs = await repository.listRunsByTrail(trailId);

  const runItems = await Promise.all(
    runs.map(async (run) => {
      const [project, recipe, links] = await Promise.all([
        repository.getProject(run.projectId),
        run.recipeId === null
          ? Promise.resolve(null)
          : repository.getRecipe(run.recipeId),
        repository.listActiveLinks(run.id),
      ]);

      if (project === null || (run.recipeId !== null && recipe === null))
        throw new Error('Run data is inconsistent.');

      return { run, project, recipe, links } satisfies TrailDetailRunItem;
    }),
  );

  return { trail, runs: runItems };
}
