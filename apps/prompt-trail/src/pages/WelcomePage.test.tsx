import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { publicAlphaFeedbackUrl } from '../app/public-alpha';
import { WelcomePage } from './WelcomePage';

describe('WelcomePage', () => {
  it('introduces the Public Alpha core flow and Dashboard action', () => {
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '次の仕事に活かせるTrailへ',
    );
    expect(
      screen.getByRole('link', { name: 'PromptTrailを試す' }),
    ).toHaveAttribute('href', '/dashboard');
    const steps = screen.getByRole('list', { name: 'PromptTrailの使い方' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getByText('1. Trailを作る')).toBeInTheDocument();
    expect(within(steps).getByText('2. Linkを残す')).toBeInTheDocument();
    expect(
      within(steps).getByText('3. Promptを再利用する'),
    ).toBeInTheDocument();
  });

  it('explains storage, security, and safe feedback behavior', () => {
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    const storage = screen
      .getByRole('heading', { name: 'Public Alphaを試す前にご確認ください' })
      .closest('article');
    expect(storage).not.toBeNull();
    expect(storage).toHaveTextContent('browser origin単位のIndexedDB');
    expect(storage).toHaveTextContent(
      'browser、端末、originをまたいだ同期は行われません',
    );
    expect(storage).toHaveTextContent('データを失う可能性');
    expect(storage).toHaveTextContent('Backup、Restore、Cloud Sync');
    expect(storage).toHaveTextContent('API Key、Token');

    const feedback = screen.getByRole('link', { name: 'Feedbackを送る' });
    expect(feedback).toHaveAttribute('href', publicAlphaFeedbackUrl);
    expect(feedback).toHaveAttribute('target', '_blank');
    expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      screen.getByText(
        /アプリ内のPrompt、Run、Link、保存データが自動送信されることはありません/,
      ),
    ).toBeInTheDocument();
  });
});
