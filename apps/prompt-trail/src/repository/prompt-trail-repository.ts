import type { PromptTrailDatabase } from '../db';

export class PromptTrailRepository {
  private readonly database: PromptTrailDatabase;

  constructor(database: PromptTrailDatabase) {
    this.database = database;

    void this.database;
  }
}
