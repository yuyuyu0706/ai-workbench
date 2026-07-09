import type { ReactNode } from 'react';

import { GlobalNavigation } from './GlobalNavigation';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand" aria-label="PromptTrail">
          <span className="app-shell__eyebrow">AI Workbench</span>
          <span className="app-shell__title">PromptTrail</span>
        </div>
      </header>
      <GlobalNavigation />
      <main className="app-shell__main" id="main-content">
        {children}
      </main>
    </div>
  );
}
