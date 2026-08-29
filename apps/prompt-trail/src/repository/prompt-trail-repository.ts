import type { Table } from 'dexie';

import type { PromptTrailDatabase } from '../db';
import { createDefaultWorkspace } from '../domain';
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
  Trail,
  TrailId,
  TrailKind,
  UtcDateTimeString,
  Workspace,
  WorkspaceId,
} from '../domain';

import { PromptTrailRepositoryError } from './errors';

export type TrailBundle = {
  readonly project: Project;
  readonly prompt: Prompt;
  readonly context: Context;
  readonly recipe: Recipe;
  readonly trail: Trail;
  readonly run: Run;
  readonly links: readonly Link[];
};

/** Atomic creation payload for a Recipe-free Run from one project Prompt. */
export type DirectRunBundle = {
  readonly project: Project;
  readonly prompt: Prompt;
  readonly trail: Trail;
  readonly run: Run & { readonly recipeId: null };
};

export type DirectRunFromPromptCreation = {
  readonly project: Project;
  readonly promptId: PromptId;
  readonly expectedPromptUpdatedAt: UtcDateTimeString;
  readonly trail: Trail;
  readonly run: Run & { readonly recipeId: null };
};

export type DirectRunFromPromptResult = {
  readonly project: Project;
  readonly trail: Trail;
  readonly run: Run & { readonly recipeId: null };
};

export type PromptBodyUpdate = {
  readonly promptId: PromptId;
  readonly expectedUpdatedAt: UtcDateTimeString;
  readonly body: string;
  readonly variableValues: Record<string, string>;
  readonly updatedAt: UtcDateTimeString;
};

export type TrailMetadataUpdate = {
  readonly trailId: TrailId;
  readonly expectedUpdatedAt: UtcDateTimeString;
  readonly title: string;
  readonly kind: TrailKind;
  readonly updatedAt: UtcDateTimeString;
};

export class PromptTrailRepository {
  private readonly database: PromptTrailDatabase;

  constructor(database: PromptTrailDatabase) {
    this.database = database;
  }

  async insertTrailBundle(trailBundle: TrailBundle): Promise<TrailBundle> {
    await this.database.transaction(
      'rw',
      [
        this.database.workspaces,
        this.database.projects,
        this.database.prompts,
        this.database.contexts,
        this.database.recipes,
        this.database.trails,
        this.database.runs,
        this.database.links,
      ],
      async () => {
        await this.ensureBundleIdsAbsent(trailBundle);
        await this.ensureWorkspaceAvailable(
          trailBundle.project.workspaceId,
          true,
        );

        await this.database.projects.add(trailBundle.project);

        await this.ensureValidAssetScope(trailBundle.prompt);
        await this.database.prompts.add(trailBundle.prompt);

        await this.ensureValidAssetScope(trailBundle.context);
        await this.database.contexts.add(trailBundle.context);

        await this.ensureRecipeReferencesAvailable(trailBundle.recipe);
        await this.database.recipes.add(trailBundle.recipe);

        this.ensureTrailMatchesProject(trailBundle.trail, trailBundle.project);
        await this.database.trails.add(trailBundle.trail);

        await this.ensureRunReferencesAvailable(
          trailBundle.run,
          trailBundle.trail,
        );
        await this.database.runs.add(trailBundle.run);

        for (const link of trailBundle.links) {
          await this.ensureLinkReferencesAvailable(link);
          await this.database.links.add(link);
        }
      },
    );

    return trailBundle;
  }

  async createDirectRunBundle(
    directRunBundle: DirectRunBundle,
  ): Promise<DirectRunBundle> {
    let project = directRunBundle.project;

    await this.database.transaction(
      'rw',
      [
        this.database.workspaces,
        this.database.projects,
        this.database.prompts,
        this.database.trails,
        this.database.runs,
      ],
      async () => {
        this.ensureDirectRunBundleRelationships(directRunBundle);
        await this.ensureWorkspaceAvailable(project.workspaceId, true);
        const existingProject = await this.database.projects.get(project.id);

        if (existingProject === undefined) {
          await this.database.projects.add(project);
        } else {
          this.ensureProjectAvailable(existingProject);
          project = existingProject;
        }

        await this.ensureDirectRunIdsAbsent(directRunBundle);
        await this.database.prompts.add(directRunBundle.prompt);
        await this.database.trails.add(directRunBundle.trail);
        await this.ensureDirectRunReferencesAvailable(
          directRunBundle.run,
          directRunBundle.trail,
        );
        await this.database.runs.add(directRunBundle.run);
      },
    );

    return { ...directRunBundle, project };
  }

  async createDirectRunFromPrompt(
    creation: DirectRunFromPromptCreation,
  ): Promise<DirectRunFromPromptResult> {
    let project = creation.project;
    await this.database.transaction(
      'rw',
      [
        this.database.workspaces,
        this.database.projects,
        this.database.prompts,
        this.database.trails,
        this.database.runs,
      ],
      async () => {
        await this.ensureWorkspaceAvailable(project.workspaceId, true);
        const existingProject = await this.database.projects.get(project.id);
        if (existingProject === undefined)
          await this.database.projects.add(project);
        else {
          this.ensureProjectAvailable(existingProject);
          project = existingProject;
        }
        const prompt = await this.database.prompts.get(creation.promptId);
        if (prompt === undefined)
          throw new PromptTrailRepositoryError(
            'reference-not-found',
            'Source Prompt not found',
          );
        if (prompt.deletedAt !== null || prompt.status !== 'active')
          throw new PromptTrailRepositoryError(
            'reference-unavailable',
            'Source Prompt is unavailable',
          );
        if (
          prompt.scope !== 'global' &&
          (prompt.scope !== 'project' ||
            prompt.projectId !== creation.run.projectId)
        )
          throw new PromptTrailRepositoryError(
            'project-mismatch',
            'Source Prompt belongs to another project',
          );
        if (prompt.updatedAt !== creation.expectedPromptUpdatedAt)
          throw new PromptTrailRepositoryError(
            'stale-write',
            'Source Prompt was updated',
          );
        if (await this.database.runs.get(creation.run.id))
          throw new PromptTrailRepositoryError(
            'duplicate-id',
            'Run ID already exists',
          );
        if (
          creation.run.projectId !== project.id ||
          creation.run.promptSnapshot.promptId !== prompt.id
        )
          throw new PromptTrailRepositoryError(
            'project-mismatch',
            'Run relationship is invalid',
          );
        this.ensureTrailMatchesProject(creation.trail, project);
        if (await this.database.trails.get(creation.trail.id))
          throw new PromptTrailRepositoryError(
            'duplicate-id',
            'Trail ID already exists',
          );
        await this.database.trails.add(creation.trail);
        await this.ensureDirectRunReferencesAvailable(
          creation.run,
          creation.trail,
        );
        await this.database.runs.add(creation.run);
      },
    );
    return { project, trail: creation.trail, run: creation.run };
  }

  async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    await this.database.workspaces.put(workspace);

    return workspace;
  }

  async getWorkspace(workspaceId: WorkspaceId): Promise<Workspace | null> {
    return (await this.database.workspaces.get(workspaceId)) ?? null;
  }

  async listActiveWorkspaces(): Promise<readonly Workspace[]> {
    const workspaces = await this.database.workspaces
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return workspaces.filter((workspace) => workspace.deletedAt === null);
  }

  async softDeleteWorkspace(
    workspaceId: WorkspaceId,
    deletedAt: UtcDateTimeString,
  ): Promise<Workspace> {
    return this.softDeleteEntity(
      this.database.workspaces,
      workspaceId,
      deletedAt,
      'Workspace',
    );
  }

  async saveTrail(trail: Trail): Promise<Trail> {
    await this.database.transaction(
      'rw',
      this.database.projects,
      this.database.trails,
      async () => {
        const project = await this.database.projects.get(trail.projectId);

        if (project === undefined) {
          throw new PromptTrailRepositoryError(
            'reference-not-found',
            `Project not found: ${trail.projectId}`,
          );
        }

        this.ensureProjectAvailable(project);
        await this.database.trails.put(trail);
      },
    );

    return trail;
  }

  async getTrail(trailId: TrailId): Promise<Trail | null> {
    return (await this.database.trails.get(trailId)) ?? null;
  }

  async listActiveTrails(projectId: ProjectId): Promise<readonly Trail[]> {
    const trails = await this.database.trails
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return trails.filter(
      (trail) =>
        trail.projectId === projectId &&
        trail.deletedAt === null &&
        trail.archivedAt === null,
    );
  }

  async softDeleteTrail(
    trailId: TrailId,
    deletedAt: UtcDateTimeString,
  ): Promise<Trail> {
    return this.softDeleteEntity(
      this.database.trails,
      trailId,
      deletedAt,
      'Trail',
    );
  }

  async updateTrailMetadata(update: TrailMetadataUpdate): Promise<Trail> {
    return this.database.transaction('rw', this.database.trails, async () => {
      const current = await this.database.trails.get(update.trailId);
      if (current === undefined) {
        throw new PromptTrailRepositoryError(
          'reference-not-found',
          `Trail not found: ${update.trailId}`,
        );
      }
      if (current.deletedAt !== null) {
        throw new PromptTrailRepositoryError(
          'reference-unavailable',
          `Trail is unavailable: ${update.trailId}`,
        );
      }
      if (current.updatedAt !== update.expectedUpdatedAt) {
        throw new PromptTrailRepositoryError(
          'stale-write',
          `Trail was updated: ${update.trailId}`,
        );
      }
      const updated: Trail = {
        ...current,
        title: update.title,
        kind: update.kind,
        updatedAt: update.updatedAt,
      };
      await this.database.trails.put(updated);
      return updated;
    });
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

  async updatePromptBody(update: PromptBodyUpdate): Promise<Prompt> {
    return this.database.transaction('rw', this.database.prompts, async () => {
      const current = await this.database.prompts.get(update.promptId);
      if (current === undefined) {
        throw new PromptTrailRepositoryError(
          'reference-not-found',
          `Prompt not found: ${update.promptId}`,
        );
      }
      if (current.deletedAt !== null || current.status !== 'active') {
        throw new PromptTrailRepositoryError(
          'reference-unavailable',
          `Prompt is unavailable: ${update.promptId}`,
        );
      }
      if (current.updatedAt !== update.expectedUpdatedAt) {
        throw new PromptTrailRepositoryError(
          'stale-write',
          `Prompt was updated: ${update.promptId}`,
        );
      }
      const updated: Prompt = {
        ...current,
        body: update.body,
        variableValues: update.variableValues,
        updatedAt: update.updatedAt,
      };
      await this.database.prompts.put(updated);
      return updated;
    });
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
      this.database.prompts,
      this.database.recipes,
      this.database.trails,
      this.database.runs,
      async () => {
        const trail = await this.database.trails.get(run.trailId);
        if (trail === undefined) {
          throw new PromptTrailRepositoryError(
            'reference-not-found',
            `Trail not found: ${run.trailId}`,
          );
        }
        await this.ensureRunReferencesAvailable(run, trail);
        await this.database.runs.put(run);
      },
    );

    return run;
  }

  async getRun(runId: RunId): Promise<Run | null> {
    return (await this.database.runs.get(runId)) ?? null;
  }

  async listRunsByTrail(trailId: TrailId): Promise<readonly Run[]> {
    const runs = await this.database.runs
      .where('trailId')
      .equals(trailId)
      .toArray();

    return runs.filter((run) => run.deletedAt === null);
  }

  async listRunsByPrompt(promptId: PromptId): Promise<readonly Run[]> {
    const runs = await this.database.runs
      .where('promptSnapshot.promptId')
      .equals(promptId)
      .toArray();

    return runs.filter((run) => run.deletedAt === null);
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
    runId: RunId,
    linkId: LinkId,
    deletedAt: UtcDateTimeString,
  ): Promise<Link> {
    const link = await this.getLink(linkId);

    if (link === null || link.runId !== runId) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Link not found for Run: ${runId}/${linkId}`,
      );
    }

    if (link.deletedAt !== null) return link;

    const deletedLink = { ...link, deletedAt };
    await this.database.links.put(deletedLink);
    return deletedLink;
  }

  private async ensureBundleIdsAbsent(trailBundle: TrailBundle): Promise<void> {
    const existingIds = await Promise.all([
      this.database.projects.get(trailBundle.project.id),
      this.database.prompts.get(trailBundle.prompt.id),
      this.database.contexts.get(trailBundle.context.id),
      this.database.recipes.get(trailBundle.recipe.id),
      this.database.trails.get(trailBundle.trail.id),
      this.database.runs.get(trailBundle.run.id),
      ...trailBundle.links.map((link) => this.database.links.get(link.id)),
    ]);

    if (existingIds.some((entity) => entity !== undefined)) {
      throw new PromptTrailRepositoryError(
        'duplicate-id',
        'Trail bundle contains an ID that already exists',
      );
    }
  }

  private async ensureDirectRunIdsAbsent(
    directRunBundle: DirectRunBundle,
  ): Promise<void> {
    const [prompt, trail, run] = await Promise.all([
      this.database.prompts.get(directRunBundle.prompt.id),
      this.database.trails.get(directRunBundle.trail.id),
      this.database.runs.get(directRunBundle.run.id),
    ]);

    if (prompt !== undefined || trail !== undefined || run !== undefined) {
      throw new PromptTrailRepositoryError(
        'duplicate-id',
        'Direct Run bundle contains an ID that already exists',
      );
    }
  }

  private ensureDirectRunBundleRelationships(
    directRunBundle: DirectRunBundle,
  ): void {
    const { project, prompt, trail, run } = directRunBundle;

    if (prompt.scope !== 'project' || prompt.projectId !== project.id) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        'Direct Run Prompt must belong to the bundle Project',
      );
    }

    this.ensureTrailMatchesProject(trail, project);

    if (run.projectId !== project.id) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        'Direct Run must belong to the bundle Project',
      );
    }

    if (run.trailId !== trail.id) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        'Direct Run must belong to the bundle Trail',
      );
    }

    if (run.promptSnapshot.promptId !== prompt.id) {
      throw new PromptTrailRepositoryError(
        'snapshot-mismatch',
        'Direct Run Prompt Snapshot must reference the bundle Prompt',
      );
    }
  }

  private ensureTrailMatchesProject(trail: Trail, project: Project): void {
    if (trail.projectId !== project.id) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        `Trail belongs to another project: ${trail.id}`,
      );
    }
  }

  private async ensureWorkspaceAvailable(
    workspaceId: WorkspaceId,
    createIfMissing = false,
  ): Promise<void> {
    const workspace = await this.database.workspaces.get(workspaceId);

    if (workspace === undefined) {
      if (createIfMissing) {
        await this.database.workspaces.add(
          createDefaultWorkspace(new Date().toISOString() as UtcDateTimeString),
        );
        return;
      }

      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Workspace not found: ${workspaceId}`,
      );
    }

    if (workspace.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Workspace is unavailable: ${workspaceId}`,
      );
    }
  }

  private async ensureRunReferencesAvailable(
    run: Run,
    trail: Trail,
  ): Promise<void> {
    if (run.recipeId === null) {
      await this.ensureDirectRunReferencesAvailable(
        run as Run & { readonly recipeId: null },
        trail,
      );
      return;
    }

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

    this.ensureRunTrailConsistent(run, trail);

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

  private async ensureDirectRunReferencesAvailable(
    run: Run & { readonly recipeId: null },
    trail: Trail,
  ): Promise<void> {
    const project = await this.database.projects.get(run.projectId);

    if (project === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Project not found: ${run.projectId}`,
      );
    }

    this.ensureProjectAvailable(project);
    this.ensureRunTrailConsistent(run, trail);

    const prompt = await this.database.prompts.get(run.promptSnapshot.promptId);

    if (prompt === undefined) {
      throw new PromptTrailRepositoryError(
        'reference-not-found',
        `Prompt not found: ${run.promptSnapshot.promptId}`,
      );
    }

    if (prompt.deletedAt !== null || prompt.status !== 'active') {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Prompt is unavailable: ${run.promptSnapshot.promptId}`,
      );
    }

    if (
      prompt.scope !== 'global' &&
      (prompt.scope !== 'project' || prompt.projectId !== run.projectId)
    ) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        `Direct Run Prompt belongs to another project: ${run.id}`,
      );
    }

    if (
      run.promptSnapshot.title !== prompt.title ||
      run.promptSnapshot.body !== prompt.body ||
      run.contextSnapshots.length !== 0 ||
      Object.keys(run.inputValues).length !== 0 ||
      run.finalPrompt !== prompt.body
    ) {
      throw new PromptTrailRepositoryError(
        'snapshot-mismatch',
        `Direct Run invariants do not match Prompt: ${run.id}`,
      );
    }
  }

  private ensureRunTrailConsistent(run: Run, trail: Trail): void {
    if (run.trailId !== trail.id || trail.projectId !== run.projectId) {
      throw new PromptTrailRepositoryError(
        'project-mismatch',
        `Run does not belong to the referenced Trail: ${run.id}`,
      );
    }

    if (trail.deletedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Trail is unavailable: ${trail.id}`,
      );
    }
  }

  private ensureProjectAvailable(project: Project): void {
    if (project.deletedAt !== null || project.archivedAt !== null) {
      throw new PromptTrailRepositoryError(
        'reference-unavailable',
        `Project is unavailable: ${project.id}`,
      );
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
