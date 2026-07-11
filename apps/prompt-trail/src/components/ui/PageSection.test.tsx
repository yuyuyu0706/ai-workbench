import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';
import { PageSection } from './PageSection';

describe('PageSection', () => {
  it('renders the section heading, supporting text, children, and actions', () => {
    render(
      <PageSection
        actions={<Button variant="secondary">Open plan</Button>}
        description="Use this area for the first static skeleton pass."
        eyebrow="Next step"
        title="最近のRun"
      >
        <p>Repository data will replace this empty state in P0-5.</p>
      </PageSection>,
    );

    const section = screen.getByRole('region', { name: '最近のRun' });
    expect(section).toHaveClass('pt-page-section');
    expect(
      screen.getByRole('heading', { level: 2, name: '最近のRun' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Next step')).toHaveClass(
      'pt-page-section__eyebrow',
    );
    expect(
      screen.getByText('Use this area for the first static skeleton pass.'),
    ).toHaveClass('pt-page-section__description');
    expect(
      screen.getByText(
        'Repository data will replace this empty state in P0-5.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open plan' }),
    ).toBeInTheDocument();
  });

  it('renders only required content when optional content is omitted', () => {
    render(
      <PageSection title="利用開始">
        <p>PromptTrailで最初に見る案内です。</p>
      </PageSection>,
    );

    expect(
      screen.getByRole('region', { name: '利用開始' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Next step')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
