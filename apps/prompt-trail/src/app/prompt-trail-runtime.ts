import { createPromptTrailDatabase, type PromptTrailDatabase } from '../db';
import { PromptTrailRepository } from '../repository';

export interface PromptTrailRuntime {
  readonly repository: PromptTrailRepository;
  initialize(): Promise<void>;
  dispose(): void;
}

class DefaultPromptTrailRuntime implements PromptTrailRuntime {
  readonly repository: PromptTrailRepository;
  #initializePromise: Promise<void> | undefined;

  constructor(private readonly database: PromptTrailDatabase) {
    this.repository = new PromptTrailRepository(database);
  }

  initialize(): Promise<void> {
    this.#initializePromise ??= this.database.open().then(() => undefined);

    return this.#initializePromise;
  }

  dispose(): void {
    this.database.close();
  }
}

export function createPromptTrailRuntime(
  database: PromptTrailDatabase = createPromptTrailDatabase(),
): PromptTrailRuntime {
  return new DefaultPromptTrailRuntime(database);
}
