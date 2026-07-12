import type { Context, Link, Project, Prompt, Recipe, Run } from '../domain';
import type { PromptTrailRepository, TrailBundle } from '../repository';

import { sampleDataset } from './sample-dataset';

export type SeedSampleDataResult =
  | { readonly status: 'seeded' }
  | { readonly status: 'already-present' }
  | {
      readonly status: 'conflict';
      readonly existingIds: readonly string[];
      readonly missingIds: readonly string[];
    };

type SampleRecord = Project | Prompt | Context | Recipe | Run | Link | null;

type SamplePreflight = {
  readonly project: Project | null;
  readonly prompt: Prompt | null;
  readonly context: Context | null;
  readonly recipe: Recipe | null;
  readonly run: Run | null;
  readonly links: readonly (Link | null)[];
};

const sampleIds = [
  sampleDataset.ids.project,
  sampleDataset.ids.prompt,
  sampleDataset.ids.context,
  sampleDataset.ids.recipe,
  sampleDataset.ids.run,
  sampleDataset.ids.links.chat,
  sampleDataset.ids.links.issue100,
  sampleDataset.ids.links.pr101,
] as const;

export async function seedSampleData(
  repository: PromptTrailRepository,
): Promise<SeedSampleDataResult> {
  const preflight = await getSamplePreflight(repository);
  const records = getPreflightRecords(preflight);
  const existingIds = records
    .filter((record): record is Exclude<SampleRecord, null> => record !== null)
    .map((record) => record.id);

  if (existingIds.length === 0) {
    await repository.insertTrailBundle(getSampleTrailBundle());

    return { status: 'seeded' };
  }

  const missingIds = sampleIds.filter((id) => !existingIds.includes(id));

  if (missingIds.length > 0 || !isCompleteSample(preflight)) {
    return {
      status: 'conflict',
      existingIds,
      missingIds,
    };
  }

  return { status: 'already-present' };
}

async function getSamplePreflight(
  repository: PromptTrailRepository,
): Promise<SamplePreflight> {
  const [project, prompt, context, recipe, run, chatLink, issueLink, prLink] =
    await Promise.all([
      repository.getProject(sampleDataset.ids.project),
      repository.getPrompt(sampleDataset.ids.prompt),
      repository.getContext(sampleDataset.ids.context),
      repository.getRecipe(sampleDataset.ids.recipe),
      repository.getRun(sampleDataset.ids.run),
      repository.getLink(sampleDataset.ids.links.chat),
      repository.getLink(sampleDataset.ids.links.issue100),
      repository.getLink(sampleDataset.ids.links.pr101),
    ]);

  return {
    project,
    prompt,
    context,
    recipe,
    run,
    links: [chatLink, issueLink, prLink],
  };
}

function getPreflightRecords(
  preflight: SamplePreflight,
): readonly SampleRecord[] {
  return [
    preflight.project,
    preflight.prompt,
    preflight.context,
    preflight.recipe,
    preflight.run,
    ...preflight.links,
  ];
}

function isCompleteSample(preflight: SamplePreflight): boolean {
  const { project, prompt, context, recipe, run, links } = preflight;

  if (
    project === null ||
    prompt === null ||
    context === null ||
    recipe === null ||
    run === null ||
    links.some((link) => link === null)
  ) {
    return false;
  }

  return (
    project.deletedAt === null &&
    project.archivedAt === null &&
    prompt.deletedAt === null &&
    prompt.status === 'active' &&
    prompt.scope === 'project' &&
    prompt.projectId === project.id &&
    context.deletedAt === null &&
    context.status === 'enabled' &&
    context.scope === 'project' &&
    context.projectId === project.id &&
    recipe.deletedAt === null &&
    recipe.projectId === project.id &&
    recipe.promptId === prompt.id &&
    recipe.contextIds.length === 1 &&
    recipe.contextIds[0] === context.id &&
    run.deletedAt === null &&
    run.archivedAt === null &&
    run.projectId === project.id &&
    run.recipeId === recipe.id &&
    run.promptSnapshot.promptId === prompt.id &&
    run.contextSnapshots.length === 1 &&
    run.contextSnapshots[0]?.contextId === context.id &&
    links.every(
      (link) =>
        link !== null && link.deletedAt === null && link.runId === run.id,
    )
  );
}

function getSampleTrailBundle(): TrailBundle {
  return {
    project: sampleDataset.project,
    prompt: sampleDataset.prompt,
    context: sampleDataset.context,
    recipe: sampleDataset.recipe,
    run: sampleDataset.run,
    links: sampleDataset.links,
  };
}
