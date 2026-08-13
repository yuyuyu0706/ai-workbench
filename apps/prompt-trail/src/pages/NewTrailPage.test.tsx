/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { DeveloperToolsRuntime } from '../app/prompt-trail-runtime';
import { DeveloperToolsProvider } from '../developer-tools/DeveloperToolsContext';
import {
  createDeveloperUiStateStore,
  type DeveloperUiStateStore,
} from '../developer-ui-state';
import type { PromptTrailRepository } from '../repository';
import { PromptTrailRepositoryError } from '../repository';
import { DEFAULT_PROJECT_ID } from '../domain';
import { NewTrailPage } from './NewTrailPage';
function LocationProbe() {
  const location = useLocation();
  return <output>{JSON.stringify([location.pathname, location.state])}</output>;
}
function QueryControls() {
  const navigate = useNavigate();
  return (
    <nav aria-label="Test query controls">
      <button onClick={() => navigate('/runs/new?sourceRunId=run-a')}>
        Run A
      </button>
      <button onClick={() => navigate('/runs/new?sourceRunId=run-b')}>
        Run B
      </button>
      <button onClick={() => navigate('/runs/new')}>通常New Trail</button>
      <button onClick={() => navigate('/runs/new?sourcePromptId=prompt-b')}>
        Prompt B
      </button>
    </nav>
  );
}
function renderPage(
  repository: PromptTrailRepository,
  uiStateStore?: DeveloperUiStateStore,
  initialEntry = '/runs/new',
  withQueryControls = false,
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
          {withQueryControls ? <QueryControls /> : null}
          <LocationProbe />
        </DeveloperToolsProvider>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}
describe('NewTrailPage', () => {
  it('never writes for invalid or unavailable Prompt sources', async () => {
    const user = userEvent.setup();
    const repository = {
      getPrompt: vi.fn().mockResolvedValue(null),
      createDirectRunBundle: vi.fn(),
      createDirectRunFromPrompt: vi.fn(),
    } as unknown as PromptTrailRepository;
    const invalid = renderPage(
      repository,
      undefined,
      '/runs/new?sourcePromptId=a&sourceRunId=b',
    );
    expect(screen.getByRole('button', { name: 'Trailを作成' })).toBeDisabled();
    invalid.container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(repository.createDirectRunBundle).not.toHaveBeenCalled();
    invalid.unmount();

    renderPage(repository, undefined, '/runs/new?sourcePromptId=missing');
    await screen.findByText('指定されたPromptが見つかりません。');
    document
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(repository.createDirectRunBundle).not.toHaveBeenCalled();
    expect(repository.createDirectRunFromPrompt).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('link', { name: '空のPromptから始める' }),
    );
  });

  it('ends submission on stale, preserves metadata, focuses and reloads the latest Prompt', async () => {
    const user = userEvent.setup();
    const initial = reusablePrompt('Old body');
    const latest = {
      ...initial,
      title: 'Latest title',
      body: 'Latest body',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    const repository = {
      getPrompt: vi
        .fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(latest),
      createDirectRunFromPrompt: vi
        .fn()
        .mockRejectedValueOnce(new PromptTrailRepositoryError('stale-write')),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourcePromptId=prompt-1');
    await screen.findByDisplayValue('Old body');
    await user.clear(screen.getByLabelText('Trail名'));
    await user.type(screen.getByLabelText('Trail名'), 'My draft');
    await user.selectOptions(screen.getByLabelText('Trail種別'), 'review');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));

    const latestButton = await screen.findByRole('button', {
      name: '最新のPromptを読み込む',
    });
    expect(latestButton).toBeEnabled();
    expect(latestButton).toHaveFocus();
    expect(screen.getByLabelText('Trail名')).toHaveValue('My draft');
    expect(screen.getByLabelText('Trail種別')).toHaveValue('review');
    await user.click(latestButton);
    expect(await screen.findByDisplayValue('Latest body')).toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('Trail名')).toHaveValue('My draft');
    expect(
      screen.getByText('Latest title').closest('.pt-reuse-source'),
    ).toHaveFocus();
  });

  it('prefills the body with variables resolved, leaving unset variables as placeholders', async () => {
    const repository = {
      getPrompt: vi.fn().mockResolvedValue(
        reusablePrompt('Hello ${name}, welcome to ${place}.', 'prompt-1', {
          name: 'Rikki',
        }),
      ),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourcePromptId=prompt-1');
    await screen.findByDisplayValue('Hello Rikki, welcome to ${place}.');
  });

  it('resolves variables again when reloading the latest Prompt', async () => {
    const user = userEvent.setup();
    const initial = reusablePrompt('Hi ${name}', 'prompt-1', {
      name: 'Old',
    });
    const latest = {
      ...initial,
      updatedAt: '2026-01-02T00:00:00.000Z',
      variableValues: { name: 'New' },
    };
    const repository = {
      getPrompt: vi
        .fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(latest),
      createDirectRunFromPrompt: vi
        .fn()
        .mockRejectedValueOnce(new PromptTrailRepositoryError('stale-write')),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourcePromptId=prompt-1');
    await screen.findByDisplayValue('Hi Old');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    const latestButton = await screen.findByRole('button', {
      name: '最新のPromptを読み込む',
    });
    await user.click(latestButton);
    expect(await screen.findByDisplayValue('Hi New')).toHaveAttribute(
      'readonly',
    );
  });

  it('disables source editing and repeated submission while creating from a Prompt', async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    const repository = {
      getPrompt: vi.fn().mockResolvedValue(reusablePrompt('Body')),
      createDirectRunFromPrompt: vi.fn(
        () => new Promise((done) => (resolve = done)),
      ),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourcePromptId=prompt-1');
    const body = await screen.findByDisplayValue('Body');
    expect(body).toHaveAttribute(
      'aria-describedby',
      'prompt-body-help prompt-body-error',
    );
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    expect(screen.queryByRole('link', { name: '元のPromptを編集' })).toBeNull();
    expect(screen.getByText('元のPromptを編集')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '作成中...' }));
    expect(repository.createDirectRunFromPrompt).toHaveBeenCalledOnce();
    resolve({});
  });

  it('discards Prompt A stale completion after Prompt B finishes loading', async () => {
    const user = userEvent.setup();
    let rejectPromptA!: (reason: Error) => void;
    const repository = {
      getPrompt: vi.fn((id: string) =>
        Promise.resolve(
          reusablePrompt(
            id === 'prompt-b' ? 'Prompt B body' : 'Prompt A body',
            id,
          ),
        ),
      ),
      createDirectRunFromPrompt: vi.fn(
        () => new Promise((_done, reject) => (rejectPromptA = reject)),
      ),
    } as unknown as PromptTrailRepository;
    renderPage(
      repository,
      undefined,
      '/runs/new?sourcePromptId=prompt-a',
      true,
    );
    await screen.findByDisplayValue('Prompt A body');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    await user.click(screen.getByRole('button', { name: 'Prompt B' }));
    await screen.findByDisplayValue('Prompt B body');
    await act(async () =>
      rejectPromptA(new PromptTrailRepositoryError('stale-write')),
    );
    expect(screen.getByLabelText('Prompt本文')).toHaveValue('Prompt B body');
    expect(screen.getByRole('button', { name: 'Trailを作成' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: '最新のPromptを読み込む' }),
    ).toBeNull();
  });

  it('discards stale completion after a Repository switch or unmount', async () => {
    const user = userEvent.setup();
    let rejectOld!: (reason: Error) => void;
    const oldRepository = {
      getPrompt: vi.fn().mockResolvedValue(reusablePrompt('Old body')),
      createDirectRunFromPrompt: vi.fn(
        () => new Promise((_done, reject) => (rejectOld = reject)),
      ),
    } as unknown as PromptTrailRepository;
    const newRepository = {
      getPrompt: vi.fn().mockResolvedValue(reusablePrompt('New body')),
    } as unknown as PromptTrailRepository;
    const view = renderSwitchableRepositories(
      oldRepository,
      newRepository,
      '/runs/new?sourcePromptId=prompt-1',
    );
    await screen.findByDisplayValue('Old body');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    await user.click(screen.getByRole('button', { name: 'Switch Repository' }));
    await screen.findByDisplayValue('New body');
    await act(async () =>
      rejectOld(new PromptTrailRepositoryError('stale-write')),
    );
    expect(screen.getByLabelText('Prompt本文')).toHaveValue('New body');
    expect(screen.getByRole('button', { name: 'Trailを作成' })).toBeEnabled();

    let rejectUnmounted!: (reason: Error) => void;
    const unmountedRepository = {
      getPrompt: vi.fn().mockResolvedValue(reusablePrompt('Unmount body')),
      createDirectRunFromPrompt: vi.fn(
        () => new Promise((_done, reject) => (rejectUnmounted = reject)),
      ),
    } as unknown as PromptTrailRepository;
    view.unmount();
    const unmounted = renderPage(
      unmountedRepository,
      undefined,
      '/runs/new?sourcePromptId=prompt-1',
    );
    await screen.findByDisplayValue('Unmount body');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    unmounted.unmount();
    await act(async () =>
      rejectUnmounted(new PromptTrailRepositoryError('stale-write')),
    );
  });
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
        '保存に失敗しました。入力内容を保持しています。再試行してください。',
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
        'Trailの名前と用途、AIに依頼する内容を設定してください。作業後に関連リンクを追加すると、依頼から成果までをTrailとして残せます。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Trail名は個別の作業名です。Prompt資産のタイトルはPrompt本文から別に生成されます。',
      ),
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
    await user.click(button);
    expect(screen.getByLabelText('Trail名')).toHaveFocus();
    expect(screen.getByLabelText('Trail名')).toHaveAttribute(
      'aria-describedby',
      'trail-title-help trail-title-error',
    );
    expect(screen.getByLabelText('Prompt本文')).toHaveAttribute(
      'aria-describedby',
      'prompt-body-error',
    );
    const input = screen.getByLabelText('Prompt本文');
    await user.type(input, 'keep this');
    await user.click(button);
    expect(
      await screen.findByText(
        '保存に失敗しました。入力内容を保持しています。再試行してください。',
      ),
    ).toHaveAttribute('role', 'alert');
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
      trailId: 'trail-source',
      deletedAt: null,
      promptSnapshot: { title: 'Source prompt', body: 'original snapshot' },
    };
    const sourceTrail = { title: 'Source Trail', kind: 'research' };
    const createDirectRunBundle = vi.fn(async (bundle: any) => ({
      ...bundle,
      run: { ...bundle.run, id: 'run-reused' },
    }));
    const repository = {
      getRun: vi.fn(async () => sourceRun),
      getTrail: vi.fn(async () => sourceTrail),
      createDirectRunBundle,
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=run-source');

    const input = await screen.findByDisplayValue('original snapshot');
    expect(screen.getByText(/Source Trail/)).toBeVisible();
    expect(screen.queryByText(/Source prompt/)).toBeNull();
    expect(screen.getByLabelText('Trail名')).toHaveValue('Source Trail');
    expect(screen.getByLabelText('Trail種別')).toHaveValue('research');
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

  it('generates a Blank title candidate, preserves manual metadata, and saves custom values', async () => {
    const user = userEvent.setup();
    const createDirectRunBundle = vi.fn(async (bundle: any) => bundle);
    renderPage({ createDirectRunBundle } as unknown as PromptTrailRepository);

    const body = screen.getByLabelText('Prompt本文');
    const title = screen.getByLabelText('Trail名');
    await user.type(body, 'Generated title\nbody');
    expect(title).toHaveValue('Generated title');
    await user.clear(title);
    await user.type(title, '  Manual Trail  ');
    await user.selectOptions(screen.getByLabelText('Trail種別'), 'review');
    await user.type(body, ' changed');
    expect(title).toHaveValue('  Manual Trail  ');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));

    expect(createDirectRunBundle.mock.calls[0]?.[0]).toMatchObject({
      prompt: { title: 'Generated title' },
      trail: { title: 'Manual Trail', kind: 'review' },
    });
  });

  it('protects each field edited before a delayed source response', async () => {
    const user = userEvent.setup();
    let resolve!: (value: any) => void;
    const repository = {
      getRun: vi.fn(() => new Promise((done) => (resolve = done))),
      getTrail: vi.fn(async () => ({ title: 'Source Trail', kind: 'research' })),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=slow-run');

    await user.type(screen.getByLabelText('Trail名'), 'My Trail');
    await user.selectOptions(screen.getByLabelText('Trail種別'), 'development');
    await user.type(screen.getByLabelText('Prompt本文'), 'My body');
    await act(async () =>
      resolve({
        id: 'slow-run',
        trailId: 'trail-slow',
        deletedAt: null,
        promptSnapshot: { title: 'Source Prompt', body: 'Source body' },
      }),
    );
    expect(screen.getByLabelText('Trail名')).toHaveValue('My Trail');
    expect(screen.getByLabelText('Trail種別')).toHaveValue('development');
    expect(screen.getByLabelText('Prompt本文')).toHaveValue('My body');
  });

  it('discards old success and failure results after a Repository switch', async () => {
    const user = userEvent.setup();
    let resolve!: (value: any) => void;
    const oldRepository = {
      createDirectRunBundle: vi.fn(
        () => new Promise((done) => (resolve = done)),
      ),
    } as unknown as PromptTrailRepository;
    const newRepository = {} as PromptTrailRepository;
    const successView = renderSwitchableRepositories(
      oldRepository,
      newRepository,
    );
    await user.type(screen.getByLabelText('Prompt本文'), 'Old request');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    await user.click(screen.getByRole('button', { name: 'Switch Repository' }));
    await act(async () => resolve({ run: { id: 'old-run' } }));
    expect(screen.getByText('["/runs/new",null]')).toBeInTheDocument();
    successView.unmount();

    let reject!: (reason: Error) => void;
    const failingRepository = {
      createDirectRunBundle: vi.fn(
        () => new Promise((_done, fail) => (reject = fail)),
      ),
    } as unknown as PromptTrailRepository;
    const view = renderSwitchableRepositories(failingRepository, newRepository);
    await user.type(screen.getByLabelText('Prompt本文'), 'Failing request');
    await user.click(screen.getByRole('button', { name: 'Trailを作成' }));
    await user.click(screen.getByRole('button', { name: 'Switch Repository' }));
    await act(async () => reject(new Error('old failure')));
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not overwrite user input when a delayed source load completes', async () => {
    const user = userEvent.setup();
    let resolve!: (value: any) => void;
    const repository = {
      getRun: vi.fn(() => new Promise((done) => (resolve = done))),
      getTrail: vi.fn(async () => ({ title: 'Slow Trail', kind: 'review' })),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=slow-run');

    const input = screen.getByLabelText('Prompt本文');
    await user.type(input, 'my draft');
    await act(async () =>
      resolve({
        id: 'slow-run',
        trailId: 'trail-slow',
        deletedAt: null,
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
    await user.type(screen.getByLabelText('Prompt本文'), 'discard this');
    await user.click(
      screen.getByRole('link', { name: '空のPromptから始める' }),
    );
    expect(screen.getByLabelText('Prompt本文')).toHaveValue('');
  });

  it('clears Run A while Run B loads and binds the form to Run B', async () => {
    const user = userEvent.setup();
    let resolveRunB!: (value: any) => void;
    const repository = {
      getRun: vi.fn((id: string) =>
        id === 'run-a'
          ? Promise.resolve(reusableRun('run-a', 'Run A body'))
          : new Promise((resolve) => (resolveRunB = resolve)),
      ),
      getTrail: vi.fn(async (id: string) =>
        reusableTrail(id.replace(/^trail-/, '')),
      ),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=run-a', true);
    const input = await screen.findByDisplayValue('Run A body');

    await user.click(screen.getByRole('button', { name: 'Run B' }));
    expect(input).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Trailを作成' })).toBeDisabled();
    await act(async () => resolveRunB(reusableRun('run-b', 'Run B body')));
    expect(input).toHaveValue('Run B body');
  });

  it('clears the reuse form when navigating to the normal New Trail URL', async () => {
    const user = userEvent.setup();
    const repository = {
      getRun: vi.fn(async () => reusableRun('run-a', 'Run A body')),
      getTrail: vi.fn(async () => reusableTrail('run-a')),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=run-a', true);
    const input = await screen.findByDisplayValue('Run A body');

    await user.click(screen.getByRole('button', { name: '通常New Trail' }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('heading', { name: '再利用元' })).toBeNull();
  });

  it('keeps session edits when retry succeeds after a load failure', async () => {
    const user = userEvent.setup();
    const repository = {
      getRun: vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValueOnce(reusableRun('run-a', 'Snapshot body')),
      getTrail: vi.fn(async () => reusableTrail('run-a')),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=run-a');
    await screen.findByText(/読み込めませんでした/);
    const input = screen.getByLabelText('Prompt本文');
    await user.type(input, 'User draft');

    await user.click(screen.getByRole('button', { name: '再試行' }));
    await screen.findByText(/Prompt本文を引き継ぎました/);
    expect(input).toHaveValue('User draft');
  });

  it('ignores a delayed response from the previous query session', async () => {
    const user = userEvent.setup();
    let resolveRunA!: (value: any) => void;
    const repository = {
      getRun: vi.fn((id: string) =>
        id === 'run-a'
          ? new Promise((resolve) => (resolveRunA = resolve))
          : Promise.resolve(reusableRun('run-b', 'Current Run B body')),
      ),
      getTrail: vi.fn(async (id: string) =>
        reusableTrail(id.replace(/^trail-/, '')),
      ),
    } as unknown as PromptTrailRepository;
    renderPage(repository, undefined, '/runs/new?sourceRunId=run-a', true);

    await user.click(screen.getByRole('button', { name: 'Run B' }));
    const input = await screen.findByDisplayValue('Current Run B body');
    await act(async () =>
      resolveRunA(reusableRun('run-a', 'Stale Run A body')),
    );
    expect(input).toHaveValue('Current Run B body');
  });
});

function reusableRun(id: string, body: string) {
  return {
    id,
    trailId: `trail-${id}`,
    deletedAt: null,
    promptSnapshot: { title: `${id} title`, body },
  };
}

function reusableTrail(id: string) {
  return { id: `trail-${id}`, title: `${id} Trail`, kind: 'other' };
}

function reusablePrompt(
  body: string,
  id = 'prompt-1',
  variableValues: Record<string, string> = {},
) {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    scope: 'project' as const,
    projectId: DEFAULT_PROJECT_ID,
    title: 'Prompt title',
    body,
    status: 'active' as const,
    tags: [],
    variableValues,
  };
}

function renderSwitchableRepositories(
  initialRepository: PromptTrailRepository,
  nextRepository: PromptTrailRepository,
  initialEntry = '/runs/new',
) {
  function Harness() {
    const [repository, setRepository] = useState(initialRepository);
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <PromptTrailRepositoryProvider repository={repository}>
          <DeveloperToolsProvider value={null}>
            <NewTrailPage />
            <button onClick={() => setRepository(nextRepository)}>
              Switch Repository
            </button>
            <LocationProbe />
          </DeveloperToolsProvider>
        </PromptTrailRepositoryProvider>
      </MemoryRouter>
    );
  }
  return render(<Harness />);
}

function createTestUiStateStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}
