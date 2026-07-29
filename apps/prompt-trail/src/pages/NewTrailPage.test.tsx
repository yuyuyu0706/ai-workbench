/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { DeveloperToolsRuntime } from '../app/prompt-trail-runtime';
import { DeveloperToolsProvider } from '../developer-tools/DeveloperToolsContext';
import {
  createDeveloperUiStateStore,
  type DeveloperUiStateStore,
} from '../developer-ui-state';
import type { PromptTrailRepository } from '../repository';
import { NewTrailPage } from './NewTrailPage';
function LocationProbe() {
  const location = useLocation();
  return <output>{JSON.stringify([location.pathname, location.state])}</output>;
}
function renderPage(
  repository: PromptTrailRepository,
  uiStateStore?: DeveloperUiStateStore,
) {
  return render(
    <MemoryRouter>
      <PromptTrailRepositoryProvider repository={repository}>
        <DeveloperToolsProvider
          value={
            uiStateStore ? ({ uiStateStore } as DeveloperToolsRuntime) : null
          }
        >
          <NewTrailPage />
          <LocationProbe />
        </DeveloperToolsProvider>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}
describe('NewTrailPage', () => {
  it('applies form overrides without losing input or saving until cleared', async () => {
    const user = userEvent.setup();
    const repository = {
      createDirectRunBundle: vi.fn(async (bundle) => ({
        ...bundle,
        run: { ...bundle.run, id: 'run-after-override' },
      })),
    } as unknown as PromptTrailRepository;
    const store = createTestUiStateStore();
    renderPage(repository, store);

    const input = screen.getByLabelText('Prompt本文');
    await user.type(input, 'keep this prompt');

    act(() =>
      store.setActiveOverride({
        target: 'new-trail-form',
        state: 'submitting',
      }),
    );
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '作成中...' })).toBeDisabled();
    expect(repository.createDirectRunBundle).not.toHaveBeenCalled();

    act(() =>
      store.setActiveOverride({
        target: 'new-trail-form',
        state: 'save-failure',
      }),
    );
    expect(input).toHaveValue('keep this prompt');
    expect(
      screen.getByText(
        '保存に失敗しました。内容を確認して再試行してください。',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    expect(repository.createDirectRunBundle).not.toHaveBeenCalled();

    act(() => store.clearActiveOverride());
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    expect(repository.createDirectRunBundle).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        '["/runs/run-after-override",{"trailCreated":true}]',
      ),
    ).toBeInTheDocument();
  });

  it('explains the Trail flow without exposing internal creation terms', () => {
    const repository = {} as PromptTrailRepository;
    renderPage(repository);

    expect(
      screen.getByText(
        'AIに依頼する内容を入力してください。作業後に関連リンクを追加すると、依頼から成果までをTrailとして残せます。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Promptの最初の行がTrailタイトルになります。'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Default Project|Direct Run|非空行/)).toBeNull();
  });

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
  it('navigates to the created Run Detail path after a successful save', async () => {
    const user = userEvent.setup();
    const repository = {
      createDirectRunBundle: vi.fn(async (bundle) => ({
        ...bundle,
        run: { ...bundle.run, id: 'run-created' },
      })),
    } as unknown as PromptTrailRepository;
    renderPage(repository);
    await user.type(screen.getByLabelText('Prompt本文'), 'create me');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    expect(
      await screen.findByText('["/runs/run-created",{"trailCreated":true}]'),
    ).toBeInTheDocument();
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

function createTestUiStateStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}
