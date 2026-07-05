import type { Table } from 'dexie';

import type { PromptTrailDatabase } from '../db';
import type {
  Context,
  ContextId,
  Project,
  ProjectId,
  Prompt,
  PromptId,
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

    if (asset.scope !== 'project' || asset.projectId === undefined) {
      throw new PromptTrailRepositoryError(
        'scope-mismatch',
        'Project asset must include projectId',
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
