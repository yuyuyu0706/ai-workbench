import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WelcomePage } from './WelcomePage';

const managementModels = ['Prompt', 'Context', 'Recipe', 'Run', 'Link'];

describe('WelcomePage', () => {
  it('renders the main heading and PromptTrail management model list', () => {
    render(<WelcomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'AIへの依頼から成果までを、再利用できるTrailに。',
      }),
    ).toBeInTheDocument();

    const modelList = screen.getByRole('list', {
      name: 'PromptTrail management model',
    });
    const modelItems = within(modelList).getAllByRole('listitem');

    expect(modelItems).toHaveLength(5);

    for (const model of managementModels) {
      expect(
        within(modelList).getByRole('heading', { level: 3, name: model }),
      ).toBeInTheDocument();
    }
  });

  it('renders the local-first assumption and current Phase 0 status', () => {
    render(<WelcomePage />);

    const assumptions = screen.getByRole('region', {
      name: 'PromptTrail assumptions and current phase',
    });

    expect(within(assumptions).getByText('Local first')).toBeInTheDocument();
    expect(within(assumptions).getByText('Phase 0')).toBeInTheDocument();
    expect(
      within(assumptions).getByRole('heading', {
        level: 2,
        name: 'まずは手元の作業資産として安全に育てる',
      }),
    ).toBeInTheDocument();
    expect(
      within(assumptions).getByRole('heading', {
        level: 2,
        name: '現在地はアプリ基盤と初期画面の整備',
      }),
    ).toBeInTheDocument();
  });
});
