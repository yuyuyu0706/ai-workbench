import { createPromptTrailDatabase, type PromptTrailDatabase } from '../db';
import { DeveloperDataService } from '../developer-data';
import { PromptTrailRepository } from '../repository';

export interface DeveloperToolsRuntime {
  readonly dataService: DeveloperDataService;
}

export interface PromptTrailRuntime {
  readonly repository: PromptTrailRepository;
  readonly developerTools: DeveloperToolsRuntime | null;
  initialize(): Promise<void>;
  dispose(): void;
}

class DefaultPromptTrailRuntime implements PromptTrailRuntime {
  readonly repository: PromptTrailRepository;
  readonly developerTools: DeveloperToolsRuntime | null;
  #initializePromise: Promise<void> | undefined;

  constructor(
    private readonly database: PromptTrailDatabase,
    enableDeveloperTools: boolean,
  ) {
    this.repository = new PromptTrailRepository(database);
    this.developerTools = enableDeveloperTools
      ? { dataService: new DeveloperDataService(database) }
      : null;
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
  options: { readonly enableDeveloperTools?: boolean } = {},
): PromptTrailRuntime {
  return new DefaultPromptTrailRuntime(
    database,
    options.enableDeveloperTools ?? false,
  );
}
