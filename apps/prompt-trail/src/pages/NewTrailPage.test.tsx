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
  initialEntry = '/runs/new',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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

  it('loads a source Run snapshot, allows editing, and creates an independent Trail', async () => {
    const user = userEvent.setup();
    const sourceRun = {
      id: 'run-source',
      promptSnapshot: { title: 'Source prompt', body: 'original snapshot' },
    };
    const createDirectRunBundle = vi.fn(async (bundle: any) => ({
      ...bundle,
      run: { ...bundle.run, id: 'run-reused' },
    }));
    const repository = {
      getRun: vi.fn(async () => sourceRun),
      createDirectRunBundle,
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=run-source');

    const input = await screen.findByDisplayValue('original snapshot');
    expect(screen.getByText(/Source prompt/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: '元のTrailを確認' }),
    ).toHaveAttribute('href', '/runs/run-source');
    await user.clear(input);
    await user.type(input, 'edited snapshot');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));

    expect(createDirectRunBundle).toHaveBeenCalledOnce();
    expect(createDirectRunBundle.mock.calls[0]?.[0].run).toMatchObject({
      promptSnapshot: { body: 'edited snapshot' },
      contextSnapshots: [],
      recipeId: null,
      evaluation: null,
      improvementNote: null,
    });
    expect(sourceRun.promptSnapshot.body).toBe('original snapshot');
  });

  it('does not overwrite user input when a delayed source load completes', async () => {
    const user = userEvent.setup();
    let resolve!: (value: any) => void;
    const repository = {
      getRun: vi.fn(() => new Promise((done) => (resolve = done))),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=slow-run');

    const input = screen.getByLabelText('Prompt本文');
    await user.type(input, 'my draft');
    await act(async () =>
      resolve({
        id: 'slow-run',
        promptSnapshot: { title: 'Slow', body: 'late snapshot' },
      }),
    );
    expect(input).toHaveValue('my draft');
  });

  it('offers safe recovery for missing and failed source Runs', async () => {
    const user = userEvent.setup();
    const repository = {
      getRun: vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValueOnce(null),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=unavailable');

    expect(await screen.findByText(/読み込めませんでした/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '再試行' }));
    expect(await screen.findByText(/見つかりません/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: '空のPromptから始める' }),
    ).toHaveAttribute('href', '/runs/new');
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
