import { createPromptTrailDatabase, type PromptTrailDatabase } from '../db';

export interface DatabaseTestScope {
  createDatabase(): PromptTrailDatabase;
  releaseDatabase(database: PromptTrailDatabase): void;
  cleanup(): Promise<void>;
}

export function createDatabaseTestScope(prefix: string): DatabaseTestScope {
  const trackedDatabases = new Set<PromptTrailDatabase>();

  return {
    createDatabase(): PromptTrailDatabase {
      const database = createPromptTrailDatabase(
        `prompt-trail-${prefix}-${crypto.randomUUID()}`,
      );

      trackedDatabases.add(database);

      return database;
    },

    releaseDatabase(database: PromptTrailDatabase): void {
      trackedDatabases.delete(database);
    },

    async cleanup(): Promise<void> {
      const databases = [...trackedDatabases];
      trackedDatabases.clear();

      await Promise.all(
        databases.map(async (database) => {
          database.close();
          await database.delete();
        }),
      );
    },
  };
}
