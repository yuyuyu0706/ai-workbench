import {
  type Link,
  type Project,
  type Prompt,
  type Recipe,
  type Run,
  type Trail,
  type TrailId,
  type TrailStep,
  type TrailStepId,
} from '../domain';
import type { PromptTrailRepository } from '../repository';

export type TrailDetailRunItem = {
  readonly run: Run;
  readonly recipe: Recipe | null;
  readonly links: readonly Link[];
};

export type TrailDetailStepItem = {
  readonly step: TrailStep;
  /** null when the Step is `kind: 'manual'`, or the referenced Prompt cannot be resolved. */
  readonly prompt: Prompt | null;
  /** Runs for this Step, `updatedAt` descending. */
  readonly runs: readonly TrailDetailRunItem[];
};

export type TrailDetailReadModel = {
  readonly trail: Trail;
  readonly project: Project;
  /** Steps, `order` ascending. */
  readonly steps: readonly TrailDetailStepItem[];
  readonly availablePrompts: readonly Prompt[];
};

export async function loadTrailDetailReadModel(
  repository: PromptTrailRepository,
  trailId: TrailId,
): Promise<TrailDetailReadModel | null> {
  const trail = await repository.getTrail(trailId);
  if (trail === null) return null;

  const project = await repository.getProject(trail.projectId);
  if (project === null) throw new Error('Trail data is inconsistent.');

  const [steps, runs, availablePrompts] = await Promise.all([
    repository.listStepsByTrail(trailId),
    repository.listRunsByTrail(trailId),
    repository.listActivePrompts(trail.projectId),
  ]);

  const runsByStepId = new Map<TrailStepId, Run[]>();
  for (const run of runs) {
    const existing = runsByStepId.get(run.trailStepId);
    if (existing) {
      existing.push(run);
    } else {
      runsByStepId.set(run.trailStepId, [run]);
    }
  }

  const stepItems = await Promise.all(
    steps.map(async (step) => {
      const stepRuns = [...(runsByStepId.get(step.id) ?? [])].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );

      const [prompt, runItems] = await Promise.all([
        step.kind === 'manual' || step.promptId === null
          ? Promise.resolve(null)
          : repository.getPrompt(step.promptId),
        Promise.all(
          stepRuns.map(async (run) => {
            const [recipe, links] = await Promise.all([
              run.recipeId === null
                ? Promise.resolve(null)
                : repository.getRecipe(run.recipeId),
              repository.listActiveLinks(run.id),
            ]);

            if (run.recipeId !== null && recipe === null)
              throw new Error('Run data is inconsistent.');

            return { run, recipe, links } satisfies TrailDetailRunItem;
          }),
        ),
      ]);

      return { step, prompt, runs: runItems } satisfies TrailDetailStepItem;
    }),
  );

  return { trail, project, steps: stepItems, availablePrompts };
}
