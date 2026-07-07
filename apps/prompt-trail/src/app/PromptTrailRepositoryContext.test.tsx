import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  PromptTrailRepositoryProvider,
  usePromptTrailRepository,
} from './PromptTrailRepositoryContext';
import { createPromptTrailRuntime } from './prompt-trail-runtime';
import { createDatabaseTestScope } from '../test/database-test-utils';

const databaseTestScope = createDatabaseTestScope('repository-context');

describe('PromptTrailRepositoryContext', () => {
  it('returns the injected repository from the provider', () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);

    function RepositoryConsumer() {
      const repository = usePromptTrailRepository();

      return (
        <p>
          {repository === runtime.repository ? 'same repository' : 'mismatch'}
        </p>
      );
    }

    render(
      <PromptTrailRepositoryProvider repository={runtime.repository}>
        <RepositoryConsumer />
      </PromptTrailRepositoryProvider>,
    );

    expect(screen.getByText('same repository')).toBeInTheDocument();

    databaseTestScope.releaseDatabase(database);
  });

  it('throws a clear error outside the provider', () => {
    function RepositoryConsumer() {
      usePromptTrailRepository();

      return null;
    }

    expect(() => render(<RepositoryConsumer />)).toThrow(
      'usePromptTrailRepository must be used within PromptTrailRepositoryProvider.',
    );
  });
});
