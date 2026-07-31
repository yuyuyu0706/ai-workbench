import type { ReactNode } from 'react';

import { GlobalNavigation } from './GlobalNavigation';
import { DeveloperToolsPanel } from '../developer-tools/DeveloperToolsPanel';
import { publicAlphaFeedbackUrl } from './public-alpha';
import { routePaths } from './routes';
import { Link } from 'react-router-dom';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand" aria-label="PromptTrail Public Alpha">
          <span className="app-shell__eyebrow">
            AI Workbench · Public Alpha
          </span>
          <span className="app-shell__title">PromptTrail</span>
        </div>
      </header>
      <GlobalNavigation />
      <DeveloperToolsPanel />
      <main className="app-shell__main" id="main-content">
        {children}
      </main>
      <footer
        className="app-shell__footer"
        aria-label="Public Alpha information"
      >
        <div className="app-shell__footer-inner">
          <p>
            データはこのbrowser
            originのIndexedDBにのみ保存され、端末やorigin間では同期されません。
          </p>
          <div className="app-shell__footer-links">
            <Link to={routePaths.root}>保存について確認</Link>
            <a
              href={publicAlphaFeedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Feedbackを送る
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
