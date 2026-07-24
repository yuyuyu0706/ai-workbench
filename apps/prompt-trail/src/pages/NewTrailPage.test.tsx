/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { PromptTrailRepository } from '../repository';
import { NewTrailPage } from './NewTrailPage';
function renderPage(repository: PromptTrailRepository) {
  return render(
    <MemoryRouter>
      <PromptTrailRepositoryProvider repository={repository}>
        <NewTrailPage />
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}
describe('NewTrailPage', () => {
  it('rejects blank input and retains it after a save failure', async () => {
    const user = userEvent.setup();
    const repository = {
      createDirectRunBundle: vi.fn(async () => {
        throw new Error('db');
      }),
    } as unknown as PromptTrailRepository;
    renderPage(repository);
    const button = screen.getByRole('button', { name: 'Trailを作成' });
    expect(button).toBeDisabled();
    const input = screen.getByLabelText('Prompt本文');
    await user.type(input, 'keep this');
    await user.click(button);
    expect(
      await screen.findByText(
        '保存に失敗しました。内容を確認して再試行してください。',
      ),
    ).toBeInTheDocument();
    expect(input).toHaveValue('keep this');
  });
  it('disables repeated submits while saving', async () => {
    const user = userEvent.setup();
    let resolve!: (value: any) => void;
    const repository = {
      createDirectRunBundle: vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    } as unknown as PromptTrailRepository;
    renderPage(repository);
    await user.type(screen.getByLabelText('Prompt本文'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    expect(screen.getByRole('button', { name: '作成中...' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '作成中...' }));
    expect(repository.createDirectRunBundle).toHaveBeenCalledOnce();
    resolve({ run: { id: 'run-1' } });
  });
});
