import type { Table } from 'dexie';

import type { PromptTrailDatabase } from '../db';
import type {
  Context,
  ContextId,
  Project,
  ProjectId,
  Prompt,
  PromptId,
  Link,
  LinkId,
  Recipe,
  RecipeId,
  Run,
  RunId,
  UtcDateTimeString,
} from '../domain';

import { PromptTrailRepositoryError } from './errors';

export class PromptTrailRepository {
  private readonly database: PromptTrailDatabase;

  constructor(database: PromptTrailDatabase) {
    this.database = database;
  }

  async saveProject(project: Project): Promise<Project> {
    await this.database.projects.put(project);

    return project;
  }

  async getProject(projectId: ProjectId): Promise<Project | null> {
    return (await this.database.projects.get(projectId)) ?? null;
  }

  async listActiveProjects(): Promise<readonly Project[]> {
    const projects = await this.database.projects
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return projects.filter(
      (project) => project.deletedAt === null && project.archivedAt === null,
    );
  }

  async softDeleteProject(
    projectId: ProjectId,
    deletedAt: UtcDateTimeString,
  ): Promise<Project> {
    const project = await this.getProject(projectId);

    if (project === null) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Project not found: ${projectId}`,
      );
    }

    const deletedProject: Project = {
      ...project,
      deletedAt,
    };

    await this.database.projects.put(deletedProject);

    return deletedProject;
  }

  async savePrompt(prompt: Prompt): Promise<Prompt> {
    await this.database.transaction(
      'rw',
      this.database.projects,
      this.database.prompts,
      async () => {
        await this.ensureValidAssetScope(prompt);
        await this.database.prompts.put(prompt);
      },
    );

    return prompt;
  }

  async getPrompt(promptId: PromptId): Promise<Prompt | null> {
    return (await this.database.prompts.get(promptId)) ?? null;
  }

  async listActivePrompts(projectId?: ProjectId): Promise<readonly Prompt[]> {
    const prompts = await this.database.prompts
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return prompts.filter(
      (prompt) =>
        prompt.deletedAt === null &&
        prompt.status === 'active' &&
        this.matchesRequestedScope(prompt, projectId),
    );
  }

  async softDeletePrompt(
    promptId: PromptId,
    deletedAt: UtcDateTimeString,
  ): Promise<Prompt> {
    return this.softDeleteEntity(
      this.database.prompts,
      promptId,
      deletedAt,
      'Prompt',
    );
  }

  async saveContext(context: Context): Promise<Context> {
    await this.database.transaction(
      'rw',
      this.database.projects,
      this.database.contexts,
      async () => {
        await this.ensureValidAssetScope(context);
        await this.database.contexts.put(context);
      },
    );

    return context;
  }

  async getContext(contextId: ContextId): Promise<Context | null> {
    return (await this.database.contexts.get(contextId)) ?? null;
  }

  async listEnabledContexts(
    projectId?: ProjectId,
  ): Promise<readonly Context[]> {
    const contexts = await this.database.contexts
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return contexts.filter(
      (context) =>
        context.deletedAt === null &&
        context.status === 'enabled' &&
        this.matchesRequestedScope(context, projectId),
    );
  }

  async softDeleteContext(
    contextId: ContextId,
    deletedAt: UtcDateTimeString,
  ): Promise<Context> {
    return this.softDeleteEntity(
      this.database.contexts,
      contextId,
      deletedAt,
      'Context',
    );
  }

  async saveRecipe(recipe: Recipe): Promise<Recipe> {
    await this.database.transaction(
      'rw',
      this.database.projects,
      this.database.prompts,
      this.database.contexts,
      this.database.recipes,
      async () => {
        await this.ensureRecipeReferencesAvailable(recipe);
        await this.database.recipes.put(recipe);
      },
    );

    return recipe;
  }

  async getRecipe(recipeId: RecipeId): Promise<Recipe | null> {
    return (await this.database.recipes.get(recipeId)) ?? null;
  }

  async listActiveRecipes(projectId: ProjectId): Promise<readonly Recipe[]> {
    const recipes = await this.database.recipes
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return recipes.filter(
      (recipe) => recipe.projectId === projectId && recipe.deletedAt === null,
    );
  }

  async softDeleteRecipe(
    recipeId: RecipeId,
    deletedAt: UtcDateTimeString,
  ): Promise<Recipe> {
    return this.softDeleteEntity(
      this.database.recipes,
      recipeId,
      deletedAt,
      'Recipe',
    );
  }

  async saveRun(run: Run): Promise<Run> {
    await this.database.transaction(
      'rw',
      this.database.projects,
      this.database.recipes,
      this.database.runs,
      async () => {
        await this.ensureRunReferencesAvailable(run);
        await this.database.runs.put(run);
      },
    );

    return run;
  }

  async getRun(runId: RunId): Promise<Run | null> {
    return (await this.database.runs.get(runId)) ?? null;
  }

  async listActiveRuns(projectId: ProjectId): Promise<readonly Run[]> {
    const runs = await this.database.runs
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return runs.filter(
      (run) =>
        run.projectId === projectId &&
        run.deletedAt === null &&
        run.archivedAt === null,
    );
  }

  async softDeleteRun(
    runId: RunId,
    deletedAt: UtcDateTimeString,
  ): Promise<Run> {
    return this.softDeleteEntity(this.database.runs, runId, deletedAt, 'Run');
  }

  async saveLink(link: Link): Promise<Link> {
    await this.database.transaction(
      'rw',
      this.database.runs,
      this.database.links,
      async () => {
        await this.ensureLinkReferencesAvailable(link);
        await this.database.links.put(link);
      },
    );

    return link;
  }

  async getLink(linkId: LinkId): Promise<Link | null> {
    return (await this.database.links.get(linkId)) ?? null;
  }

  async listActiveLinks(runId: RunId): Promise<readonly Link[]> {
    const links = await this.database.links.orderBy('createdAt').toArray();

    return links.filter(
      (link) => link.runId === runId && link.deletedAt === null,
    );
  }

  async softDeleteLink(
    linkId: LinkId,
    deletedAt: UtcDateTimeString,
  ): Promise<Link> {
    return this.softDeleteEntity(
      this.database.links,
      linkId,
      deletedAt,
      'Link',
    );
  }

  private async ensureRunReferencesAvailable(run: Run): Promise<void> {
    const project = await this.database.projects.get(run.projectId);

    if (project === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Project not found: ${run.projectId}`,
      );
    }

    if (project.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Project is unavailable: ${run.projectId}`,
      );
    }

    const recipe = await this.database.recipes.get(run.recipeId);

    if (recipe === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Recipe not found: ${run.recipeId}`,
      );
    }

    if (recipe.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Recipe is unavailable: ${run.recipeId}`,
      );
    }

    if (run.projectId !== recipe.projectId) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        `Run belongs to another project than recipe: ${run.id}`,
      );
    }

    if (run.promptSnapshot.promptId !== recipe.promptId) {
      throw new PromptTrailRepositoryError(
        'snapshot-mismatch',
        `Run prompt snapshot does not match recipe: ${run.id}`,
      );
    }

    if (run.contextSnapshots.length !== recipe.contextIds.length) {
      throw new PromptTrailRepositoryError(
        'snapshot-mismatch',
        `Run context snapshots do not match recipe: ${run.id}`,
      );
    }

    for (const [index, contextId] of recipe.contextIds.entries()) {
      if (run.contextSnapshots[index]?.contextId !== contextId) {
        throw new PromptTrailRepositoryError(
          'snapshot-mismatch',
          `Run context snapshots do not match recipe order: ${run.id}`,
        );
      }
    }
  }

  private async ensureLinkReferencesAvailable(link: Link): Promise<void> {
    const run = await this.database.runs.get(link.runId);

    if (run === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Run not found: ${link.runId}`,
      );
    }

    if (run.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Run is unavailable: ${link.runId}`,
      );
    }
  }

  private async ensureRecipeReferencesAvailable(recipe: Recipe): Promise<void> {
    const project = await this.database.projects.get(recipe.projectId);

    if (project === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Project not found: ${recipe.projectId}`,
      );
    }

    if (project.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Project is unavailable: ${recipe.projectId}`,
      );
    }

    const prompt = await this.database.prompts.get(recipe.promptId);

    if (prompt === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Prompt not found: ${recipe.promptId}`,
      );
    }

    if (prompt.deletedAt !== null || prompt.status === 'deprecated') {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Prompt is unavailable: ${recipe.promptId}`,
      );
    }

    this.ensureAssetMatchesRecipeProject(prompt, recipe.projectId);
    this.ensureUniqueContextIds(recipe.contextIds);

    for (const contextId of recipe.contextIds) {
      const context = await this.database.contexts.get(contextId);

      if (context === undefined) {
        throw new PromptTrailRepositoryError(
          'reference-not-found',
          `Context not found: ${contextId}`,
        );
      }

      if (context.deletedAt !== null || context.status !== 'enabled') {
        throw new PromptTrailRepositoryError(
          'reference-unavailable',
          `Context is unavailable: ${contextId}`,
        );
      }

      this.ensureAssetMatchesRecipeProject(context, recipe.projectId);
    }
  }

  private ensureUniqueContextIds(contextIds: readonly ContextId[]): void {
    const uniqueContextIds = new Set<ContextId>();

    for (const contextId of contextIds) {
      if (uniqueContextIds.has(contextId)) {
        throw new PromptTrailRepositoryError(
          'duplicate-context-id',
          `Duplicate contextId: ${contextId}`,
        );
      }

      uniqueContextIds.add(contextId);
    }
  }

  private ensureAssetMatchesRecipeProject(
    asset: Pick<Prompt | Context, 'id' | 'scope'> &
      Partial<Pick<Prompt | Context, 'projectId'>>,
    recipeProjectId: ProjectId,
  ): void {
    if (asset.scope === 'global') {
      if ('projectId' in asset) {
        throw new PromptTrailRepositoryError(
          'scope-mismatch',
          'Global asset must not include projectId',
        );
      }

      return;
    }

    if (
      asset.scope !== 'project' ||
      !('projectId' in asset) ||
      typeof asset.projectId !== 'string'
    ) {
      throw new PromptTrailRepositoryError(
        'scope-mismatch',
        'Project asset must include a string projectId',
      );
    }

    if (asset.projectId !== recipeProjectId) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        `Project scoped asset belongs to another project: ${asset.id}`,
      );
    }
  }

  private async ensureValidAssetScope(
    asset: Pick<Prompt | Context, 'scope'> &
      Partial<Pick<Prompt | Context, 'projectId'>>,
  ): Promise<void> {
    if (asset.scope === 'global') {
      if ('projectId' in asset) {
        throw new PromptTrailRepositoryError(
          'scope-mismatch',
          'Global asset must not include projectId',
        );
      }

      return;
    }

    if (
      asset.scope !== 'project' ||
      !('projectId' in asset) ||
      typeof asset.projectId !== 'string'
    ) {
      throw new PromptTrailRepositoryError(
        'scope-mismatch',
        'Project asset must include a string projectId',
      );
    }

    const project = await this.database.projects.get(asset.projectId);

    if (project === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Project not found: ${asset.projectId}`,
      );
    }

    if (project.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Project is unavailable: ${asset.projectId}`,
      );
    }
  }

  private matchesRequestedScope(
    asset: Pick<Prompt | Context, 'scope'> &
      Partial<Pick<Prompt | Context, 'projectId'>>,
    projectId: ProjectId | undefined,
  ): boolean {
    if (asset.scope === 'global') {
      return !('projectId' in asset);
    }

    return projectId !== undefined && asset.projectId === projectId;
  }

  private async softDeleteEntity<
    Entity extends {
      readonly id: Id;
      readonly deletedAt: UtcDateTimeString | null;
    },
    Id,
  >(
    table: Table<Entity, Id>,
    id: Id,
    deletedAt: UtcDateTimeString,
    entityName: string,
  ): Promise<Entity> {
    const entity = await table.get(id);

    if (entity === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `${entityName} not found: ${String(id)}`,
      );
    }

    const deletedEntity: Entity = {
      ...entity,
      deletedAt,
    };

    await table.put(deletedEntity);

    return deletedEntity;
  }
}
