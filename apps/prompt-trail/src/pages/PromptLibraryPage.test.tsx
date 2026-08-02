import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemoryRouter, type InitialEntry } from 'react-router-dom';

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
import { PromptLibraryPage } from './PromptLibraryPage';

const timestamp = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;
const prompts: readonly Prompt[] = [
  createPrompt('alpha', 'Alpha CODEX依頼', '日本語の本文'),
  createPrompt('beta', 'Beta設計レビュー', '別の検索対象'),
];

describe('PromptLibraryPage', () => {
  it('shows loading while the repository read is pending', () => {
    const repository = {
      listActivePrompts: vi.fn(() => new Promise<readonly Prompt[]>(() => {})),
    } as unknown as PromptTrailRepository;

    renderPromptLibraryPage(repository);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Promptを読み込んでいます...',
    );
  });

  it('shows empty after a successful read without Prompts', async () => {
    renderPromptLibraryPage(createRepository([]));

    expect(
      await screen.findByText('Repositoryに表示できるPromptがまだありません。'),
    ).toBeVisible();
  });

  it('shows failure without exposing the repository error', async () => {
    const repository = {
      listActivePrompts: vi.fn(async () => {
        throw new Error('internal database detail');
      }),
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository);

    expect(
      await screen.findByText('Promptの読み込みに失敗しました。'),
    ).toBeVisible();
    expect(screen.queryByText('internal database detail')).toBeNull();
  });

  it('renders repository Prompt data', async () => {
    renderPromptLibraryPage(createRepository(prompts));

    expect(
      await screen.findByRole('heading', { name: prompts[0].title }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: prompts[1].title }),
    ).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('全2件を表示')).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: `「${prompts[0].title}」からTrailを作成`,
      }),
    ).toHaveAttribute('href', '/runs/new?sourcePromptId=alpha');
    expect(
      screen.getByRole('link', { name: `「${prompts[0].title}」を編集` }),
    ).toHaveAttribute('href', '/prompts/alpha/edit');
    expect(screen.getAllByRole('time')[0]).toHaveAttribute(
      'datetime',
      timestamp,
    );
  });

  it('filters matching Prompts, distinguishes no-match, and restores all data when cleared', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const search = await screen.findByRole('searchbox', {
      name: 'Promptを検索',
    });

    await user.type(search, '  codex  ');
    expect(screen.getByText('全2件中 1件を表示')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: prompts[0].title }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: prompts[1].title }),
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: '検索をクリア' }));
    expect(search).toHaveValue('');
    await user.type(search, '一致なし');
    expect(screen.getByText('全2件中 0件を表示')).toBeVisible();
    expect(
      screen.getByText('検索条件に一致するPromptがありません。'),
    ).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Prompt一覧' })).toBeNull();

    await user.clear(search);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('applies loading, empty, and failure Developer Tools overrides and restores data', async () => {
    const store = createTestUiStateStore();
    const repository = createRepository(prompts);
    store.setActiveOverride({
      target: 'prompt-library-page',
      state: 'loading',
    });
    renderPromptLibraryPage(repository, store);
    expect(screen.getByText('Promptを読み込んでいます...')).toBeVisible();
    await waitFor(() =>
      expect(repository.listActivePrompts).toHaveBeenCalledOnce(),
    );

    act(() =>
      store.setActiveOverride({
        target: 'prompt-library-page',
        state: 'empty',
      }),
    );
    expect(
      screen.getByText('Repositoryに表示できるPromptがまだありません。'),
    ).toBeVisible();

    act(() =>
      store.setActiveOverride({
        target: 'prompt-library-page',
        state: 'failure',
      }),
    );
    expect(screen.getByText('Promptの読み込みに失敗しました。')).toBeVisible();

    act(() => store.clearActiveOverride());
    expect(
      await screen.findByRole('heading', { name: prompts[0].title }),
    ).toBeVisible();
  });

  it('reads the Prompt list again when data revision changes', async () => {
    const repository = createRepository([]);
    renderPromptLibraryPage(repository, undefined, true);
    await screen.findByText('Repositoryに表示できるPromptがまだありません。');
    expect(repository.listActivePrompts).toHaveBeenCalledOnce();

    await userEvent.click(
      screen.getByRole('button', { name: 'Notify data changed' }),
    );
    await waitFor(() =>
      expect(repository.listActivePrompts).toHaveBeenCalledTimes(2),
    );
  });

  it('shows a delete notice once and clears navigation state for reload', async () => {
    const repository = createRepository(prompts);
    const view = renderPromptLibraryPage(repository, undefined, false, {
      pathname: '/prompts',
      state: { promptDeleted: true },
    });
    expect(await screen.findByText('Promptを削除しました。')).toBeVisible();
    view.unmount();
    renderPromptLibraryPage(repository);
    expect(screen.queryByText('Promptを削除しました。')).toBeNull();
  });
});

function renderPromptLibraryPage(
  repository: PromptTrailRepository,
  store?: DeveloperUiStateStore,
  withTrigger = false,
  initialEntry: InitialEntry = '/prompts',
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
            <PromptLibraryPage />
            {withTrigger ? <DataRevisionTrigger /> : null}
          </DeveloperToolsProvider>
        </PromptTrailDataRevisionProvider>
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}

function DataRevisionTrigger() {
  const { notifyDataChanged } = usePromptTrailDataRevision();
  return <button onClick={notifyDataChanged}>Notify data changed</button>;
}

function createRepository(values: readonly Prompt[]): PromptTrailRepository {
  return {
    listActivePrompts: vi.fn(async () => values),
  } as unknown as PromptTrailRepository;
}

function createPrompt(id: string, title: string, body: string): Prompt {
  return {
    id: id as Prompt['id'],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    scope: 'global',
    title,
    body,
    kind: 'other',
    status: 'active',
    tags: [],
  };
}

function createTestUiStateStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}
