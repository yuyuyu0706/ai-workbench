import { createContext, useContext, type ReactNode } from 'react';

import type { DeveloperToolsRuntime } from '../app/prompt-trail-runtime';

const DeveloperToolsContext = createContext<DeveloperToolsRuntime | null>(null);

export function DeveloperToolsProvider({
  value,
  children,
}: {
  value: DeveloperToolsRuntime | null;
  children: ReactNode;
}) {
  return (
    <DeveloperToolsContext.Provider value={value}>
      {children}
    </DeveloperToolsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- This hook is the public Context access point for UI code.
export function useDeveloperTools(): DeveloperToolsRuntime | null {
  return useContext(DeveloperToolsContext);
}
