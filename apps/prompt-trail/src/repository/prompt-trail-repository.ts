import type { PromptTrailDatabase } from '../db';

export class PromptTrailRepository {
  readonly database: PromptTrailDatabase;

  constructor(database: PromptTrailDatabase) {
    this.database = database;
  }
}
