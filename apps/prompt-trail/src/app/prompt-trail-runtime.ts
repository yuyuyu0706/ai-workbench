import { createPromptTrailDatabase, type PromptTrailDatabase } from '../db';
import { DeveloperDataService } from '../developer-data';
import {
  createDeveloperUiStateStore,
  type DeveloperUiStateStorage,
  type DeveloperUiStateStore,
} from '../developer-ui-state';
import { PromptTrailRepository } from '../repository';

export interface DeveloperToolsRuntime {
  readonly dataService: DeveloperDataService;
  readonly uiStateStore: DeveloperUiStateStore;
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
    developerUiStateStorage?: DeveloperUiStateStorage,
  ) {
    this.repository = new PromptTrailRepository(database);
    if (enableDeveloperTools && developerUiStateStorage === undefined) {
      throw new Error(
        'developerUiStateStorage is required when Developer Tools are enabled',
      );
    }
    this.developerTools =
      enableDeveloperTools && developerUiStateStorage
        ? {
            dataService: new DeveloperDataService(database),
            uiStateStore: createDeveloperUiStateStore(developerUiStateStorage),
          }
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
  options: {
    readonly enableDeveloperTools?: boolean;
    readonly developerUiStateStorage?: DeveloperUiStateStorage;
  } = {},
): PromptTrailRuntime {
  return new DefaultPromptTrailRuntime(
    database,
    options.enableDeveloperTools ?? false,
    options.developerUiStateStorage,
  );
}
