import type { Link, Project, Recipe, Run } from '../domain';
import type { PromptTrailRepository } from '../repository';
export type RunDetailReadModel = {
  readonly run: Run;
  readonly project: Project;
  readonly recipe: Recipe | null;
  readonly links: readonly Link[];
};
export async function loadRunDetailReadModel(
  repository: PromptTrailRepository,
  runId: Run['id'],
): Promise<RunDetailReadModel | null> {
  const run = await repository.getRun(runId);
  if (run === null) return null;
  const [project, recipe, links] = await Promise.all([
    repository.getProject(run.projectId),
    run.recipeId === null
      ? Promise.resolve(null)
      : repository.getRecipe(run.recipeId),
    repository.listActiveLinks(run.id),
  ]);
  if (project === null || (run.recipeId !== null && recipe === null))
    throw new Error('Run data is inconsistent.');
  return { run, project, recipe, links };
}
