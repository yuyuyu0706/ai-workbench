import type { PromptTrailDatabase } from '../db';
import type { Project, ProjectId, UtcDateTimeString } from '../domain';

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
}
