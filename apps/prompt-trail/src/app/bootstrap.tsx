import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { App } from './App';
import { ApplicationBootstrap } from './ApplicationBootstrap';
import {
  createPromptTrailRuntime,
  type PromptTrailRuntime,
} from './prompt-trail-runtime';
import { getBrowserDeveloperUiStateStorage } from '../developer-ui-state';

export interface PromptTrailApplicationHandle {
  dispose(): void;
}

export interface MountPromptTrailApplicationOptions {
  runtime?: PromptTrailRuntime;
}

export function mountPromptTrailApplication(
  rootElement: HTMLElement,
  options: MountPromptTrailApplicationOptions = {},
): PromptTrailApplicationHandle {
  const enableDeveloperTools =
    import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_DEVELOPER_TOOLS === 'true';
  const runtime =
    options.runtime ??
    createPromptTrailRuntime(undefined, {
      enableDeveloperTools,
      developerUiStateStorage: enableDeveloperTools
        ? getBrowserDeveloperUiStateStorage(window)
        : undefined,
    });
  const root: Root = createRoot(rootElement);

  root.render(
    <StrictMode>
      <ApplicationBootstrap runtime={runtime}>
        <App />
      </ApplicationBootstrap>
    </StrictMode>,
  );

  return {
    dispose() {
      root.unmount();
      runtime.dispose();
    },
  };
}
