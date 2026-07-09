import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';

function renderAppShell() {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppShell>
        <h1>Dashboard content</h1>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('renders the shared header, navigation region, and main slot', () => {
    renderAppShell();

    expect(screen.getByLabelText('PromptTrail')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Global navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Dashboard content');
  });
});
