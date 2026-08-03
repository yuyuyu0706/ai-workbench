import { act, render, screen, waitFor, within } from '@testing-library/react';
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
  createPrompt(
    'alpha',
    'Alpha CODEX依頼',
    '日本語の本文\nhttps://example.com/very-long-prompt-body-value',
    'global',
    'codex-request',
  ),
  createPrompt(
    'beta',
    'Beta設計レビュー'.repeat(6),
    '別の検索対象\n2行目\n3行目\n4行目',
    'project',
    'design-review',
  ),
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
      await screen.findByRole('heading', { level: 1, name: 'Prompt Library' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        '保存済みPromptを検索・改善し、新しいTrailへ再利用できます。',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Promptを新規登録' }),
    ).toHaveAttribute('href', '/prompts/new');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Prompt一覧' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: '保存済みPrompt' }),
    ).toBeNull();
    expect(
      screen.queryByText('利用するPromptをタイトルまたは本文から探せます。'),
    ).toBeNull();
    const table = screen.getByRole('table', { name: 'Prompt一覧' });
    expect(table).toBeVisible();
    expect(
      screen.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual([
      'タイトル',
      'プロジェクト',
      '種別',
      '更新日時',
      'Prompt',
      '操作',
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText(prompts[0].title)).toBeVisible();
    expect(screen.getByText(prompts[1].title)).toBeVisible();
    expect(within(table).getByText('Global')).toBeVisible();
    expect(within(table).getByText('Default Project')).toBeVisible();
    expect(screen.getByText('全2件を表示')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'プロジェクト' })).toHaveValue(
      'all',
    );
    expect(screen.queryByRole('button', { name: '条件をクリア' })).toBeNull();
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
    expect(screen.queryByText(prompts[0].body)).toBeNull();
  });

  it('combines Project filtering and search, shows counts, and clears both conditions', async () => {
    const user = userEvent.setup();
    const repository = createRepository(prompts);
    renderPromptLibraryPage(repository);
    const search = await screen.findByRole('searchbox', {
      name: 'Promptを検索',
    });
    const projectFilter = screen.getByRole('combobox', {
      name: 'プロジェクト',
    });

    await user.selectOptions(projectFilter, 'global');
    expect(screen.getByText('全2件中 1件を表示')).toBeVisible();
    expect(screen.getByText(prompts[0].title)).toBeVisible();
    expect(screen.queryByText(prompts[1].title)).toBeNull();
    expect(repository.listActivePrompts).toHaveBeenCalledOnce();

    await user.type(search, '  日本語  ');
    expect(screen.getByText('全2件中 1件を表示')).toBeVisible();
    await user.clear(search);
    await user.type(search, '別の検索対象');
    expect(screen.getByText('全2件中 0件を表示')).toBeVisible();
    expect(
      screen.getByText('条件に一致するPromptがありません。'),
    ).toBeVisible();
    expect(
      screen.getByText('プロジェクトまたは検索条件を変更してください。'),
    ).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Prompt一覧' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '条件をクリア' }));
    expect(search).toHaveValue('');
    expect(projectFilter).toHaveValue('all');
    expect(screen.getByText('全2件を表示')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(repository.listActivePrompts).toHaveBeenCalledOnce();
  });

  it('opens one Prompt body popover and supports toggle, switch, Escape, outside click, and close focus', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const alphaTrigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のプロンプトを表示`,
    });
    const betaTrigger = screen.getByRole('button', {
      name: `「${prompts[1].title}」のプロンプトを表示`,
    });
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(alphaTrigger);
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }).textContent,
    ).toContain(prompts[0].body);
    await user.click(alphaTrigger);
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(alphaTrigger);
    await user.click(betaTrigger);
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(betaTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }).textContent,
    ).toContain(prompts[1].body);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    expect(betaTrigger).toHaveFocus();
    await user.click(betaTrigger);
    await user.pointer({ keys: '[MouseLeft]', target: document.body });
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    await user.click(betaTrigger);
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(betaTrigger).toHaveFocus();
  });

  it('closes an open Prompt body when filtering hides its row', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    await user.click(
      await screen.findByRole('button', {
        name: `「${prompts[0].title}」のプロンプトを表示`,
      }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'プロジェクト' }),
      'project',
    );
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
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
    expect(await screen.findByText(prompts[0].title)).toBeVisible();
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

function createPrompt(
  id: string,
  title: string,
  body: string,
  scope: Prompt['scope'] = 'global',
  kind: Prompt['kind'] = 'other',
): Prompt {
  const common = {
    id: id as Prompt['id'],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    title,
    body,
    kind,
    status: 'active' as const,
    tags: [],
  };
  return scope === 'project'
    ? {
        ...common,
        scope: 'project',
        projectId: 'project-default' as Extract<
          Prompt,
          { scope: 'project' }
        >['projectId'],
      }
    : { ...common, scope: 'global' };
}

function createTestUiStateStore() {
  const values = new Map<string, string>();
  return createDeveloperUiStateStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}
