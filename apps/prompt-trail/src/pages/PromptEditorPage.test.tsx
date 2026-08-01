import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  PromptTrailDataRevisionProvider,
  usePromptTrailDataRevision,
} from '../app/PromptTrailDataRevisionContext';
import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { DeveloperToolsRuntime } from '../app/prompt-trail-runtime';
import { DeveloperToolsProvider } from '../developer-tools/DeveloperToolsContext';
import {
  createDeveloperUiStateStore,
  type DeveloperUiStateStore,
} from '../developer-ui-state';
import type { Prompt, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { PromptEditorPage } from './PromptEditorPage';

const timestamp = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;
const prompt: Prompt = {
  id: 'prompt-edit' as Prompt['id'],
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
  scope: 'global',
  title: '既存タイトル',
  body: '既存本文',
  kind: 'other',
  status: 'active',
  tags: ['keep'],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

function RevisionProbe() {
  const { revision } = usePromptTrailDataRevision();
  return <output aria-label="revision">{revision}</output>;
}

function RouteControls() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/prompts/other/edit')}>
        別Promptへ
      </button>
      <button onClick={() => navigate('/dashboard')}>Dashboardへ</button>
    </>
  );
}

function renderEditor(
  repository: PromptTrailRepository,
  {
    initialEntry = '/prompts/new',
    store,
  }: { initialEntry?: string; store?: DeveloperUiStateStore } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PromptTrailRepositoryProvider repository={repository}>
        <PromptTrailDataRevisionProvider>
          <DeveloperToolsProvider
            value={
              store ? ({ uiStateStore: store } as DeveloperToolsRuntime) : null
            }
          >
            <Routes>
              <Route
                path="/prompts/new"
                element={<PromptEditorPage mode="create" />}
              />
              <Route
                path="/prompts/:promptId/edit"
                element={
                  <>
                    <PromptEditorPage mode="edit" />
                    <RouteControls />
                  </>
                }
              />
              <Route
                path="/prompts"
                element={
                  <>
                    <h1>Prompt Library</h1>
                    <RevisionProbe />
                  </>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <>
                    <h1>Dashboard</h1>
                    <RevisionProbe />
                  </>
                }
              />
            </Routes>
          </DeveloperToolsProvider>
        </PromptTrailDataRevisionProvider>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Promptタイトル'), '新規タイトル');
  await user.type(screen.getByLabelText('Prompt本文'), '  Markdown\n  本文');
  await user.selectOptions(
    screen.getByLabelText('Prompt種別'),
    'codex-request',
  );
}

describe('PromptEditorPage', () => {
  it('shows deletion only in edit mode and supports confirmation, cancellation, and deletion', async () => {
    const user = userEvent.setup();
    const createView = renderEditor({} as PromptTrailRepository);
    expect(
      screen.queryByRole('button', { name: 'Promptを削除' }),
    ).not.toBeInTheDocument();
    createView.unmount();

    const softDeletePrompt = vi.fn(async () => ({
      ...prompt,
      deletedAt: timestamp,
    }));
    renderEditor(
      {
        getPrompt: vi.fn(async () => prompt),
        softDeletePrompt,
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    const start = await screen.findByRole('button', { name: 'Promptを削除' });
    await user.click(start);
    const confirm = screen.getByRole('button', { name: '削除する' });
    expect(confirm).toHaveFocus();
    expect(screen.getByText(/既存タイトル/)).toBeVisible();
    expect(screen.getByText(/過去Run、関連Link/)).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Promptを削除' }),
      ).toHaveFocus(),
    );
    expect(softDeletePrompt).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Promptを削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(
      await screen.findByRole('heading', { name: 'Prompt Library' }),
    ).toBeVisible();
    expect(softDeletePrompt).toHaveBeenCalledWith(
      prompt.id,
      expect.any(String),
    );
    expect(screen.getByLabelText('revision')).toHaveTextContent('1');
  });

  it('renders create mode and validates while retaining entered values', async () => {
    const user = userEvent.setup();
    renderEditor({} as PromptTrailRepository);
    expect(
      screen.getByRole('heading', { name: 'Promptを新規登録' }),
    ).toBeVisible();
    await user.type(screen.getByLabelText('Promptタイトル'), '入力値');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText('Prompt本文を入力してください。')).toBeVisible();
    expect(screen.getByText('Prompt種別を選択してください。')).toBeVisible();
    expect(screen.getByLabelText('Promptタイトル')).toHaveValue('入力値');
  });

  it('loads edit values and maps missing, unavailable, and read failure states', async () => {
    const cases = [
      [null, 'Promptが見つかりません。'],
      [{ ...prompt, status: 'deprecated' }, 'このPromptは編集できません。'],
    ] as const;
    for (const [value, message] of cases) {
      const view = renderEditor(
        {
          getPrompt: vi.fn(async () => value),
        } as unknown as PromptTrailRepository,
        { initialEntry: '/prompts/prompt-edit/edit' },
      );
      expect(await screen.findByText(message)).toBeVisible();
      view.unmount();
    }
    const loaded = renderEditor(
      {
        getPrompt: vi.fn(async () => prompt),
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    expect(await screen.findByDisplayValue('既存タイトル')).toBeVisible();
    loaded.unmount();
    renderEditor(
      {
        getPrompt: vi.fn(async () => {
          throw new Error('internal');
        }),
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    expect(
      await screen.findByText('Promptの読み込みに失敗しました。'),
    ).toBeVisible();
  });

  it('shows loading and ignores an old edit read after route switching', async () => {
    const first = deferred<Prompt | null>();
    const getPrompt = vi.fn((id: Prompt['id']) =>
      id === prompt.id
        ? first.promise
        : Promise.resolve({ ...prompt, id, title: '別Prompt' }),
    );
    const user = userEvent.setup();
    renderEditor({ getPrompt } as unknown as PromptTrailRepository, {
      initialEntry: '/prompts/prompt-edit/edit',
    });
    expect(screen.getByText('Promptを読み込んでいます...')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '別Promptへ' }));
    expect(await screen.findByDisplayValue('別Prompt')).toBeVisible();
    await act(() => first.resolve(prompt));
    expect(screen.queryByDisplayValue('既存タイトル')).toBeNull();
  });

  it('disables controls and prevents duplicate submits while saving', async () => {
    const saving = deferred<Prompt>();
    const savePrompt = vi.fn(() => saving.promise);
    const user = userEvent.setup();
    renderEditor({
      getProject: vi.fn(async () => ({ id: 'exists' })),
      savePrompt,
    } as unknown as PromptTrailRepository);
    await fillValidForm(user);
    await user.dblClick(screen.getByRole('button', { name: '保存' }));
    expect(savePrompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Prompt Libraryへ戻る' }),
    ).toBeDisabled();
  });

  it('retains input after save failure and retries successfully with revision and navigation', async () => {
    const savePrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('secret'))
      .mockImplementation(async (value) => value);
    const repository = {
      getProject: vi.fn(async () => ({ id: 'exists' })),
      savePrompt,
    } as unknown as PromptTrailRepository;
    const user = userEvent.setup();
    renderEditor(repository);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '保存に失敗しました。',
    );
    expect(screen.getByLabelText('Prompt本文')).toHaveValue(
      '  Markdown\n  本文',
    );
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(
      await screen.findByRole('heading', { name: 'Prompt Library' }),
    ).toBeVisible();
    expect(screen.getByLabelText('revision')).toHaveTextContent('1');
    expect(savePrompt).toHaveBeenCalledTimes(2);
  });

  it('does not notify or navigate when an old save completes after route switching', async () => {
    const saving = deferred<Prompt>();
    const user = userEvent.setup();
    renderEditor(
      {
        getPrompt: vi.fn(async () => prompt),
        savePrompt: vi.fn(() => saving.promise),
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    await screen.findByDisplayValue('既存タイトル');
    await user.clear(screen.getByLabelText('Promptタイトル'));
    await user.type(screen.getByLabelText('Promptタイトル'), '更新');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('button', { name: '別Promptへ' }));
    await act(() => saving.resolve(prompt));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Prompt Library' }),
      ).toBeNull(),
    );
    expect(screen.getByRole('heading', { name: 'Promptを編集' })).toBeVisible();
  });

  it('keeps the destination and revision after a save completes following Editor unmount', async () => {
    const saving = deferred<Prompt>();
    const user = userEvent.setup();
    renderEditor(
      {
        getPrompt: vi.fn(async () => prompt),
        savePrompt: vi.fn(() => saving.promise),
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    await screen.findByDisplayValue('既存タイトル');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('button', { name: 'Dashboardへ' }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByLabelText('revision')).toHaveTextContent('0');

    await act(() => saving.resolve(prompt));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible(),
    );
    expect(
      screen.queryByRole('heading', { name: 'Prompt Library' }),
    ).toBeNull();
    expect(screen.getByLabelText('revision')).toHaveTextContent('0');
  });

  it('applies every Developer Tools override without performing a real save', async () => {
    const store = createStore();
    const savePrompt = vi.fn();
    const repository = {
      getProject: vi.fn(),
      savePrompt,
    } as unknown as PromptTrailRepository;
    renderEditor(repository, { store });
    for (const [state, text] of [
      ['loading', 'Promptを読み込んでいます...'],
      ['not-found', 'Promptが見つかりません。'],
      ['failure', 'Promptの読み込みに失敗しました。'],
    ] as const) {
      act(() =>
        store.setActiveOverride({ target: 'prompt-editor-page', state }),
      );
      expect(screen.getByText(text)).toBeVisible();
    }
    act(() =>
      store.setActiveOverride({
        target: 'prompt-editor-page',
        state: 'submitting',
      }),
    );
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
    act(() =>
      store.setActiveOverride({
        target: 'prompt-editor-page',
        state: 'save-failure',
      }),
    );
    expect(screen.getByRole('alert')).toBeVisible();
    expect(savePrompt).not.toHaveBeenCalled();
  });
});
