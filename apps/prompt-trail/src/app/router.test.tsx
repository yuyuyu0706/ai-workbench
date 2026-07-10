import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';
import { AppRouter } from './router';
import { buildRunDetailPath, routePaths } from './routes';

function renderRoute(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell>
        <AppRouter />
      </AppShell>
    </MemoryRouter>,
  );
}

function getGlobalNavigation() {
  return screen.getByRole('navigation', { name: 'Global navigation' });
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
      within(getGlobalNavigation()).getByRole('link', { current: 'page' }),
    ).toHaveAccessibleName(heading);
    expect(
      screen.getByText('P0-4-3で画面骨格を実装予定です。'),
    ).toBeInTheDocument();
  });

  it('renders run detail from a direct URL with an explicit dashboard recovery link', async () => {
    const user = userEvent.setup();
    renderRoute(buildRunDetailPath('run-123'));

    expect(
      screen.getByRole('heading', { name: 'Run Detail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Run run-123 の詳細placeholderです。'),
    ).toBeInTheDocument();

    const navigation = getGlobalNavigation();
    expect(
      within(navigation).queryByRole('link', { current: 'page' }),
    ).toBeNull();

    const dashboardLink = screen.getByRole('link', { name: 'Dashboardへ戻る' });
    expect(dashboardLink).toHaveAttribute('href', routePaths.dashboard);

    await user.click(dashboardLink);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('renders not found for an unknown URL with an explicit dashboard recovery link', async () => {
    const user = userEvent.setup();
    renderRoute('/unknown-route');

    expect(
      screen.getByRole('heading', { name: 'Not Found' }),
    ).toBeInTheDocument();
    expect(screen.getByText('未知のURLです。')).toBeInTheDocument();

    const navigation = getGlobalNavigation();
    expect(
      within(navigation).queryByRole('link', { current: 'page' }),
    ).toBeNull();

    const dashboardLink = screen.getByRole('link', { name: 'Dashboardへ戻る' });
    expect(dashboardLink).toHaveAttribute('href', routePaths.dashboard);

    await user.click(dashboardLink);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });
});
