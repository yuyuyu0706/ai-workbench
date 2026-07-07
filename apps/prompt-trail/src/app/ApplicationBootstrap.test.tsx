import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApplicationBootstrap } from './ApplicationBootstrap';
import { createPromptTrailRuntime } from './prompt-trail-runtime';
import { createDatabaseTestScope } from '../test/database-test-utils';

const databaseTestScope = createDatabaseTestScope('application-bootstrap');

describe('ApplicationBootstrap', () => {
  it('shows the loading state before rendering children after initialization succeeds', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);

    render(
      <ApplicationBootstrap runtime={runtime}>
        <p>Application content</p>
      </ApplicationBootstrap>,
    );

    expect(
      screen.getByText('PromptTrailを起動しています...'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();

    expect(await screen.findByText('Application content')).toBeInTheDocument();
    expect(
      screen.queryByText('PromptTrailを起動しています...'),
    ).not.toBeInTheDocument();

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
    await database.delete();
  });

  it('shows an alert and does not render children when initialization fails', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);
    vi.spyOn(runtime, 'initialize').mockRejectedValue(new Error('open failed'));

    render(
      <ApplicationBootstrap runtime={runtime}>
        <p>Application content</p>
      </ApplicationBootstrap>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'PromptTrailの起動に失敗しました。',
    );
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
  });

  it('stably renders children in StrictMode with the same runtime', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);
    const initializeSpy = vi.spyOn(runtime, 'initialize');

    render(
      <StrictMode>
        <ApplicationBootstrap runtime={runtime}>
          <p>StrictMode content</p>
        </ApplicationBootstrap>
      </StrictMode>,
    );

    expect(await screen.findByText('StrictMode content')).toBeInTheDocument();
    await waitFor(() => expect(initializeSpy).toHaveBeenCalledTimes(2));

    runtime.dispose();
    databaseTestScope.releaseDatabase(database);
    await database.delete();
  });
});
