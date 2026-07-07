import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the page h1, optional content, and actions', () => {
    render(
      <PageHeader
        actions={<Button variant="secondary">Create</Button>}
        description="Reusable workbench records for the team."
        eyebrow="PromptTrail"
        title="Dashboard"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('PromptTrail')).toHaveClass(
      'pt-page-header__eyebrow',
    );
    expect(
      screen.getByText('Reusable workbench records for the team.'),
    ).toHaveClass('pt-page-header__description');
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('renders only a title when optional content is omitted', () => {
    render(<PageHeader title="Prompt Library" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Prompt Library' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('PromptTrail')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
