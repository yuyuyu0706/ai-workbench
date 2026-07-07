import { createContext, useContext, type ReactNode } from 'react';

import type { PromptTrailRepository } from '../repository';

const PromptTrailRepositoryContext =
  createContext<PromptTrailRepository | null>(null);

export interface PromptTrailRepositoryProviderProps {
  repository: PromptTrailRepository;
  children: ReactNode;
}

export function PromptTrailRepositoryProvider({
  repository,
  children,
}: PromptTrailRepositoryProviderProps) {
  return (
    <PromptTrailRepositoryContext value={repository}>
      {children}
    </PromptTrailRepositoryContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- This hook is the public Context access point for UI code.
export function usePromptTrailRepository(): PromptTrailRepository {
  const repository = useContext(PromptTrailRepositoryContext);

  if (repository === null) {
    throw new Error(
      'usePromptTrailRepository must be used within PromptTrailRepositoryProvider.',
    );
  }

  return repository;
}
