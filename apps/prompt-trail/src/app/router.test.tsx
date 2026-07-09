import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';
import { AppRouter } from './router';
import { routePaths } from './routes';

function renderRoute(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell>
        <AppRouter />
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  it('redirects the root route to the dashboard placeholder', async () => {
    renderRoute(routePaths.root);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it.each([
    [routePaths.dashboard, 'Dashboard'],
    [routePaths.promptLibrary, 'Prompt Library'],
    [routePaths.contextLibrary, 'Context Library'],
    [routePaths.recipeBuilder, 'Recipe Builder'],
  ])('renders a minimal placeholder for %s', (pathname, heading) => {
    renderRoute(pathname);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(
      screen.getByText('P0-4-3で画面骨格を実装予定です。'),
    ).toBeInTheDocument();
  });
});
