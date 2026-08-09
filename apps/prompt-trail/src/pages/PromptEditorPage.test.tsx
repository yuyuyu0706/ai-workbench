import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  extractPromptVariables,
  resolvePromptVariables,
} from '../prompt-shared/promptVariables';

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
  variableValues: {},
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

function RepositorySwitchingEditor({
  first,
  second,
}: {
  first: PromptTrailRepository;
  second: PromptTrailRepository;
}) {
  const [repository, setRepository] = useState(first);
  return (
    <MemoryRouter initialEntries={['/prompts/prompt-edit/edit']}>
      <PromptTrailRepositoryProvider repository={repository}>
        <PromptTrailDataRevisionProvider>
          <DeveloperToolsProvider value={null}>
            <Routes>
              <Route
                path="/prompts/:promptId/edit"
                element={<PromptEditorPage mode="edit" />}
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
            </Routes>
            <button onClick={() => setRepository(second)}>
              Repository切替
            </button>
            <RevisionProbe />
          </DeveloperToolsProvider>
        </PromptTrailDataRevisionProvider>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('タイトル'), '新規タイトル');
  await user.type(screen.getByLabelText('Prompt本文'), '  Markdown\n  本文');
  await user.selectOptions(screen.getByLabelText('種別'), 'codex-request');
}

describe('promptVariables utilities', () => {
  it('extractPromptVariables returns unique vars in order of first occurrence', () => {
    expect(extractPromptVariables('Hello ${name}, ${age} and ${name}')).toEqual(
      ['name', 'age'],
    );
  });

  it('extractPromptVariables returns empty array when no vars', () => {
    expect(extractPromptVariables('no variables here')).toEqual([]);
  });

  it('resolvePromptVariables substitutes filled values and preserves unfilled', () => {
    const result = resolvePromptVariables('${a} and ${b}', { a: 'hello' });
    expect(result).toBe('hello and ${b}');
  });

  it('resolvePromptVariables treats empty string as unfilled', () => {
    const result = resolvePromptVariables('${x}', { x: '' });
    expect(result).toBe('${x}');
  });
});

describe('PromptEditorPage', () => {
  it('uses one form for header and footer saves and orders kind, title, then body', () => {
    renderEditor({} as PromptTrailRepository);

    expect(
      screen.queryByText(
        '再利用するPromptのタイトル、本文、種別を設定します。',
      ),
    ).not.toBeInTheDocument();
    const kind = screen.getByLabelText('種別');
    const title = screen.getByLabelText('タイトル');
    const body = screen.getByLabelText('Prompt本文');
    expect(
      kind.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      title.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(2);
    const [headerSave, footerSave] = screen.getAllByRole('button', {
      name: '保存',
    });
    expect(headerSave).toHaveAttribute('type', 'submit');
    expect(headerSave).toHaveAttribute('form', 'prompt-editor-form');
    expect(footerSave).toHaveAttribute('type', 'submit');
    expect(footerSave.closest('form')).toHaveAttribute(
      'id',
      'prompt-editor-form',
    );
  });
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

  it('retains edits after delete failure, prevents duplicate deletion, and retries', async () => {
    const deleting = deferred<Prompt>();
    const softDeletePrompt = vi
      .fn()
      .mockImplementationOnce(() => deleting.promise)
      .mockImplementationOnce(async () => ({
        ...prompt,
        deletedAt: timestamp,
      }));
    const user = userEvent.setup();
    renderEditor(
      {
        getPrompt: vi.fn(async () => prompt),
        softDeletePrompt,
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    await screen.findByDisplayValue('既存タイトル');
    await user.clear(screen.getByLabelText('Prompt本文'));
    await user.type(screen.getByLabelText('Prompt本文'), '保持する編集値');
    await user.click(screen.getByRole('button', { name: 'Promptを削除' }));
    await user.dblClick(screen.getByRole('button', { name: '削除する' }));
    expect(softDeletePrompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '削除中...' })).toBeDisabled();
    expect(screen.getByLabelText('Prompt本文')).toBeDisabled();
    expect(screen.getAllByRole('button', { name: '保存' })).toEqual(
      expect.arrayContaining([expect.toBeDisabled(), expect.toBeDisabled()]),
    );
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Prompt Libraryへ戻る' }),
    ).toBeDisabled();

    await act(() => deleting.reject(new Error('private repository error')));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '削除に失敗しました。',
    );
    expect(screen.queryByText('private repository error')).toBeNull();
    expect(screen.getByLabelText('Prompt本文')).toHaveValue('保持する編集値');
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(
      await screen.findByRole('heading', { name: 'Prompt Library' }),
    ).toBeVisible();
    expect(softDeletePrompt).toHaveBeenCalledTimes(2);
  });

  it.each([
    [null, 'Promptが見つかりません。'],
    [{ ...prompt, deletedAt: timestamp }, 'このPromptは編集できません。'],
  ] as const)(
    'maps a stale delete target to page state',
    async (latest, message) => {
      const getPrompt = vi
        .fn()
        .mockResolvedValueOnce(prompt)
        .mockResolvedValueOnce(latest);
      const user = userEvent.setup();
      renderEditor(
        {
          getPrompt,
          softDeletePrompt: vi.fn(),
        } as unknown as PromptTrailRepository,
        { initialEntry: '/prompts/prompt-edit/edit' },
      );
      await user.click(
        await screen.findByRole('button', { name: 'Promptを削除' }),
      );
      await user.click(screen.getByRole('button', { name: '削除する' }));
      expect(await screen.findByText(message)).toBeVisible();
    },
  );

  it('ignores deletion completion after route switching and unmount', async () => {
    for (const destination of ['別Promptへ', 'Dashboardへ'] as const) {
      const deleting = deferred<Prompt>();
      const user = userEvent.setup();
      const view = renderEditor(
        {
          getPrompt: vi.fn(async (id) => ({ ...prompt, id })),
          softDeletePrompt: vi.fn(() => deleting.promise),
        } as unknown as PromptTrailRepository,
        { initialEntry: '/prompts/prompt-edit/edit' },
      );
      await user.click(
        await screen.findByRole('button', { name: 'Promptを削除' }),
      );
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await user.click(screen.getByRole('button', { name: destination }));
      await act(() => deleting.resolve({ ...prompt, deletedAt: timestamp }));
      expect(
        screen.queryByRole('heading', { name: 'Prompt Library' }),
      ).toBeNull();
      view.unmount();
    }
  });

  it('ignores deletion completion after repository switching', async () => {
    const deleting = deferred<Prompt>();
    const first = {
      getPrompt: vi.fn(async () => prompt),
      softDeletePrompt: vi.fn(() => deleting.promise),
    } as unknown as PromptTrailRepository;
    const second = {
      getPrompt: vi.fn(async () => ({ ...prompt, title: '切替後Prompt' })),
    } as unknown as PromptTrailRepository;
    const user = userEvent.setup();
    render(<RepositorySwitchingEditor first={first} second={second} />);
    await user.click(
      await screen.findByRole('button', { name: 'Promptを削除' }),
    );
    await user.click(screen.getByRole('button', { name: '削除する' }));
    await user.click(screen.getByRole('button', { name: 'Repository切替' }));
    expect(await screen.findByDisplayValue('切替後Prompt')).toBeVisible();
    await act(() => deleting.resolve({ ...prompt, deletedAt: timestamp }));
    expect(
      screen.queryByRole('heading', { name: 'Prompt Library' }),
    ).toBeNull();
    expect(screen.getAllByLabelText('revision')[0]).toHaveTextContent('0');
  });

  it('renders delete overrides without repository deletion, revision, or navigation', async () => {
    const store = createStore();
    const softDeletePrompt = vi.fn();
    renderEditor(
      {
        getPrompt: vi.fn(async () => prompt),
        softDeletePrompt,
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit', store },
    );
    await screen.findByDisplayValue('既存タイトル');
    for (const [state, button] of [
      ['confirming', '削除する'],
      ['deleting', '削除中...'],
      ['delete-failure', '削除する'],
    ] as const) {
      act(() =>
        store.setActiveOverride({ target: 'prompt-editor-delete', state }),
      );
      expect(screen.getByRole('button', { name: button })).toBeVisible();
    }
    await userEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(softDeletePrompt).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: 'Prompt Library' }),
    ).toBeNull();
  });

  it('renders create mode and validates while retaining entered values', async () => {
    const user = userEvent.setup();
    renderEditor({} as PromptTrailRepository);
    expect(
      screen.getByRole('heading', { name: 'Promptを新規登録' }),
    ).toBeVisible();
    await user.type(screen.getByLabelText('タイトル'), '入力値');
    await user.click(screen.getAllByRole('button', { name: '保存' })[0]);
    expect(screen.getByText('Prompt本文を入力してください。')).toBeVisible();
    expect(screen.getByText('Prompt種別を選択してください。')).toBeVisible();
    expect(screen.getByLabelText('タイトル')).toHaveValue('入力値');
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
    await user.dblClick(screen.getAllByRole('button', { name: '保存' })[0]);
    expect(savePrompt).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: '保存中...' })).toEqual(
      expect.arrayContaining([expect.toBeDisabled(), expect.toBeDisabled()]),
    );
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
    await user.click(screen.getAllByRole('button', { name: '保存' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '保存に失敗しました。',
    );
    expect(screen.getByLabelText('Prompt本文')).toHaveValue(
      '  Markdown\n  本文',
    );
    await user.click(screen.getAllByRole('button', { name: '保存' })[1]);
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
    await user.clear(screen.getByLabelText('タイトル'));
    await user.type(screen.getByLabelText('タイトル'), '更新');
    await user.click(screen.getAllByRole('button', { name: '保存' })[0]);
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
    await user.click(screen.getAllByRole('button', { name: '保存' })[0]);
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

  it('shows copy button with correct aria-label, copies draft body text, and shows check icon on success', async () => {
    const user = userEvent.setup();
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async (text: string) => {
          written = text;
        }),
      },
      configurable: true,
    });
    renderEditor({} as PromptTrailRepository);
    const copyBtn = screen.getByRole('button', { name: 'Prompt本文をコピー' });
    expect(copyBtn).toBeInTheDocument();
    await user.type(screen.getByLabelText('Prompt本文'), 'コピー対象テキスト');
    await user.click(copyBtn);
    expect(written).toBe('コピー対象テキスト');
    expect(copyBtn).toHaveClass('pt-prompt-editor__copy--copied');
    expect(
      copyBtn.querySelector('.pt-prompt-editor__copy-icon--check'),
    ).toBeInTheDocument();
    expect(screen.getByText('コピーしました')).toBeInTheDocument();
  });

  it('notifies copy failure via aria-live for screen readers', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
      configurable: true,
    });
    renderEditor({} as PromptTrailRepository);
    await user.click(
      screen.getByRole('button', { name: 'Prompt本文をコピー' }),
    );
    expect(screen.getByText('コピーできませんでした')).toBeInTheDocument();
  });

  it('copy button is usable while submitting', async () => {
    const store = createStore();
    renderEditor({} as PromptTrailRepository, { store });
    act(() =>
      store.setActiveOverride({
        target: 'prompt-editor-page',
        state: 'submitting',
      }),
    );
    const copyBtn = screen.getByRole('button', { name: 'Prompt本文をコピー' });
    expect(copyBtn).toBeInTheDocument();
    expect(copyBtn).not.toBeDisabled();
  });

  it('shows the variable panel as soon as ${var} patterns are detected', async () => {
    renderEditor({} as PromptTrailRepository);
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: 'Hello ${name} and ${age}' },
    });
    expect(
      screen.getByRole('dialog', { name: '変数に値を入力してコピー' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('${name}')).toBeInTheDocument();
    expect(screen.getByLabelText('${age}')).toBeInTheDocument();
  });

  it('hides the variable panel when no vars are detected', async () => {
    renderEditor({} as PromptTrailRepository);
    expect(
      screen.queryByRole('dialog', { name: '変数に値を入力してコピー' }),
    ).not.toBeInTheDocument();
  });

  it('does not steal focus from the textarea when the panel appears', async () => {
    const user = userEvent.setup();
    renderEditor({} as PromptTrailRepository);
    const textarea = screen.getByLabelText('Prompt本文');
    await user.click(textarea);
    await user.type(textarea, 'Hi ${name}');
    expect(textarea).toHaveFocus();
  });

  it('copies resolved text from the always-visible variable panel', async () => {
    const user = userEvent.setup();
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async (t: string) => {
          written = t;
        }),
      },
      configurable: true,
    });
    renderEditor({} as PromptTrailRepository);
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: 'Hi ${name}' },
    });
    fireEvent.change(screen.getByLabelText('${name}'), {
      target: { value: 'World' },
    });
    await user.click(screen.getByRole('button', { name: 'Prompt本文をコピー' }));
    expect(written).toBe('Hi World');
  });

  it('keeps unfilled variables as ${var} in copied text', async () => {
    const user = userEvent.setup();
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async (t: string) => {
          written = t;
        }),
      },
      configurable: true,
    });
    renderEditor({} as PromptTrailRepository);
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: '${a} and ${b}' },
    });
    fireEvent.change(screen.getByLabelText('${a}'), {
      target: { value: 'filled' },
    });
    await user.click(screen.getByRole('button', { name: 'Prompt本文をコピー' }));
    expect(written).toBe('filled and ${b}');
  });

  it('clicking the copy icon replaces and copies using the panel current values', async () => {
    const user = userEvent.setup();
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async (t: string) => {
          written = t;
        }),
      },
      configurable: true,
    });
    renderEditor({} as PromptTrailRepository);
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: 'Hi ${name}' },
    });
    fireEvent.change(screen.getByLabelText('${name}'), {
      target: { value: 'World' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Prompt本文をコピー' }),
    );
    expect(written).toBe('Hi World');
  });

  it('returns focus to the copy icon when the panel disappears while focus was inside it', async () => {
    const user = userEvent.setup();
    renderEditor({} as PromptTrailRepository);
    const textarea = screen.getByLabelText('Prompt本文');
    fireEvent.change(textarea, { target: { value: '${x}' } });
    await user.click(screen.getByLabelText('${x}'));
    fireEvent.change(textarea, { target: { value: 'no vars anymore' } });
    expect(
      screen.getByRole('button', { name: 'Prompt本文をコピー' }),
    ).toHaveFocus();
  });

  it('copies body directly without panel when no vars present', async () => {
    const user = userEvent.setup();
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async (t: string) => {
          written = t;
        }),
      },
      configurable: true,
    });
    renderEditor({} as PromptTrailRepository);
    await user.type(screen.getByLabelText('Prompt本文'), 'no vars here');
    await user.click(
      screen.getByRole('button', { name: 'Prompt本文をコピー' }),
    );
    expect(written).toBe('no vars here');
    expect(
      screen.queryByRole('dialog', { name: '変数に値を入力してコピー' }),
    ).not.toBeInTheDocument();
  });

  it('restores panel input values from prompt.variableValues when editing', async () => {
    renderEditor(
      {
        getPrompt: vi.fn(async () => ({
          ...prompt,
          body: 'Hi ${name}',
          variableValues: { name: 'Alice' },
        })),
      } as unknown as PromptTrailRepository,
      { initialEntry: '/prompts/prompt-edit/edit' },
    );
    expect(await screen.findByLabelText('${name}')).toHaveValue('Alice');
  });

  it('starts with empty panel input values when creating a new Prompt', () => {
    renderEditor({} as PromptTrailRepository);
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: 'Hi ${name}' },
    });
    expect(screen.getByLabelText('${name}')).toHaveValue('');
  });

  it('saves only variable values whose keys still appear in the body', async () => {
    const savePrompt = vi.fn(async (p: Prompt) => p);
    const user = userEvent.setup();
    renderEditor({
      getProject: vi.fn(async () => ({ id: 'exists' })),
      savePrompt,
    } as unknown as PromptTrailRepository);
    await fillValidForm(user);
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: 'Hi ${name}' },
    });
    fireEvent.change(screen.getByLabelText('${name}'), {
      target: { value: 'Alice' },
    });
    fireEvent.change(screen.getByLabelText('Prompt本文'), {
      target: { value: 'no vars anymore' },
    });
    await user.click(screen.getAllByRole('button', { name: '保存' })[0]);
    await waitFor(() => expect(savePrompt).toHaveBeenCalled());
    expect(savePrompt.mock.calls[0][0]).toMatchObject({ variableValues: {} });
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
    expect(screen.getAllByRole('button', { name: '保存中...' })).toEqual(
      expect.arrayContaining([expect.toBeDisabled(), expect.toBeDisabled()]),
    );
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
