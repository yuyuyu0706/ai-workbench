import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DeveloperToolsProvider,
  useDeveloperUiStateSnapshot,
} from './DeveloperToolsContext';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import { createDatabaseTestScope } from '../test/database-test-utils';

const databaseTestScope = createDatabaseTestScope('developer-tools-context');

function SnapshotConsumer() {
  const snapshot = useDeveloperUiStateSnapshot();
  return (
    <p>
      {snapshot === null
        ? 'Developer Tools disabled'
        : snapshot.activeOverride === null
          ? 'No override'
          : `${snapshot.activeOverride.target}: ${snapshot.activeOverride.state}`}
    </p>
  );
}

describe('useDeveloperUiStateSnapshot', () => {
  it('distinguishes disabled Developer Tools from no override', () => {
    const { rerender } = render(
      <DeveloperToolsProvider value={null}>
        <SnapshotConsumer />
      </DeveloperToolsProvider>,
    );
    expect(screen.getByText('Developer Tools disabled')).toBeInTheDocument();

    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database, {
      enableDeveloperTools: true,
      developerUiStateStorage: localStorage,
    });
    rerender(
      <DeveloperToolsProvider value={runtime.developerTools}>
        <SnapshotConsumer />
      </DeveloperToolsProvider>,
    );
    expect(screen.getByText('No override')).toBeInTheDocument();

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
  });

  it('updates and clears a subscribed component in StrictMode', () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database, {
      enableDeveloperTools: true,
      developerUiStateStorage: localStorage,
    });

    render(
      <StrictMode>
        <DeveloperToolsProvider value={runtime.developerTools}>
          <SnapshotConsumer />
        </DeveloperToolsProvider>
      </StrictMode>,
    );

    act(() => {
      runtime.developerTools?.uiStateStore.setActiveOverride({
        target: 'run-detail-link-delete',
        state: 'deleting',
      });
    });
    expect(
      screen.getByText('run-detail-link-delete: deleting'),
    ).toBeInTheDocument();

    act(() => runtime.developerTools?.uiStateStore.clearActiveOverride());
    expect(screen.getByText('No override')).toBeInTheDocument();

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
  });
});
