import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { GlobalNavigation } from './GlobalNavigation';
import { globalNavigationItems } from './navigation';
import { routePaths } from './routes';

function renderNavigation(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <GlobalNavigation />
    </MemoryRouter>,
  );
}

describe('GlobalNavigation', () => {
  it('renders exactly the global navigation items', () => {
    renderNavigation(routePaths.dashboard);

    const navigation = screen.getByRole('navigation', {
      name: 'Global navigation',
    });
    const links = within(navigation).getAllByRole('link');

    expect(links).toHaveLength(globalNavigationItems.length);
    for (const item of globalNavigationItems) {
      expect(
        within(navigation).getByRole('link', { name: item.label }),
      ).toHaveAttribute('href', item.path);
    }
    expect(
      within(navigation).queryByRole('link', { name: 'Run Detail' }),
    ).not.toBeInTheDocument();
    expect(
      within(navigation).queryByRole('link', { name: 'Not Found' }),
    ).not.toBeInTheDocument();
    expect(
      within(navigation).queryByRole('link', { name: 'Root' }),
    ).not.toBeInTheDocument();
  });

  it.each(globalNavigationItems)(
    'marks $label as the active navigation item for $path',
    (item) => {
      renderNavigation(item.path);

      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute(
        'aria-current',
        'page',
      );
    },
  );

  it.each([routePaths.root, '/runs/run-123', '/unknown-route'])(
    'does not mark any global navigation item active for %s',
    (pathname) => {
      renderNavigation(pathname);

      const navigation = screen.getByRole('navigation', {
        name: 'Global navigation',
      });

      expect(
        within(navigation).queryByRole('link', { current: 'page' }),
      ).not.toBeInTheDocument();
    },
  );
});
