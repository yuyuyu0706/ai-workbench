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
const longBody = [
  '日本語の本文',
  ...Array.from({ length: 50 }, (_, index) => `本文 ${index + 1}`),
  'https://example.com/very-long-prompt-body-value',
  'PROMPT_BODY_END_MARKER',
].join('\n');
const prompts: readonly Prompt[] = [
  createPrompt('alpha', 'Alpha CODEX依頼', longBody, 'global', 'codex-request'),
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
      'Prompt名',
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
      screen.getByPlaceholderText('Prompt名または本文を検索'),
    ).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'タイトル' })).toBeNull();
    expect(table).toHaveClass('pt-prompt-table--compact');
    expect(
      screen.getByRole('link', {
        name: `「${prompts[0].title}」からTrailを作成`,
      }),
    ).toHaveAttribute('href', '/runs/new?sourcePromptId=alpha');
    const titleLink = screen.getByRole('link', {
      name: `「${prompts[0].title}」を編集`,
    });
    expect(titleLink).toHaveAttribute('href', '/prompts/alpha/edit');
    expect(titleLink).toHaveClass('pt-prompt-table__title-link');
    expect(
      screen.getByRole('link', {
        name: `「${prompts[0].title}」からTrailを作成`,
      }),
    ).toHaveClass('pt-prompt-trail-action');
    expect(
      screen.getAllByRole('tooltip', { name: 'Trailを作成' }),
    ).toHaveLength(2);
    expect(
      within(table).queryByRole('link', { name: 'Trailを作成' }),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: '編集' })).toBeNull();
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
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    const betaTrigger = screen.getByRole('button', {
      name: `「${prompts[1].title}」のPrompt本文を表示`,
    });
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(alphaTrigger).toHaveAttribute('aria-controls');
    expect(
      screen.getAllByRole('tooltip', { name: 'Prompt本文を表示' }),
    ).toHaveLength(2);
    expect(screen.queryByText('プロンプト')).toBeNull();
    const alphaTooltip = document.getElementById(
      alphaTrigger.getAttribute('aria-describedby')!,
    );
    expect(alphaTooltip).toHaveAttribute('data-visible', 'false');
    act(() => alphaTrigger.focus());
    expect(alphaTooltip).toHaveAttribute('data-visible', 'true');

    await user.keyboard('{Enter}');
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(alphaTooltip).toHaveAttribute('data-visible', 'false');
    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }).textContent,
    ).toContain(prompts[0].body);
    const dialog = screen.getByRole('dialog', { name: 'Prompt本文' });
    const editLink = within(dialog).getByRole('link', {
      name: `「${prompts[0].title}」を編集`,
    });
    const copyButton = within(dialog).getByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文をコピー`,
    });
    const closeButton = within(dialog).getByRole('button', {
      name: 'Prompt本文を閉じる',
    });
    expect(editLink).toHaveTextContent('Promptを編集する');
    expect(editLink).toHaveAttribute('href', '/prompts/alpha/edit');
    expect(
      Boolean(
        editLink.compareDocumentPosition(copyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        copyButton.compareDocumentPosition(closeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      within(dialog).getByRole('tooltip', { name: '閉じる' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText('閉じる', { selector: 'button' }),
    ).toBeNull();
    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }),
    ).toHaveTextContent('PROMPT_BODY_END_MARKER');
    expect(screen.getByRole('dialog', { name: 'Prompt本文' })).toHaveAttribute(
      'data-placement',
    );
    const content = document.querySelector('.pt-prompt-body-popover__content');
    expect(content).not.toBeNull();
    await user.click(content!);
    expect(screen.getByRole('dialog', { name: 'Prompt本文' })).toBeVisible();
    content!.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    expect(screen.getByRole('dialog', { name: 'Prompt本文' })).toBeVisible();
    await user.unhover(alphaTrigger);
    await user.click(alphaTrigger);
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(alphaTrigger).toHaveFocus();
    act(() => {
      betaTrigger.focus();
      alphaTrigger.focus();
    });
    expect(alphaTooltip).toHaveAttribute('data-visible', 'true');
    await user.click(alphaTrigger);
    await user.click(betaTrigger);
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(betaTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }).textContent,
    ).toContain(prompts[1].body);

    await user.unhover(betaTrigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    expect(betaTrigger).toHaveFocus();
    const betaTooltip = document.getElementById(
      betaTrigger.getAttribute('aria-describedby')!,
    );
    expect(betaTooltip).toHaveAttribute('data-visible', 'false');
    await user.click(betaTrigger);
    await user.pointer({ keys: '[MouseLeft]', target: document.body });
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    await user.click(betaTrigger);
    await user.click(
      screen.getByRole('button', { name: 'Prompt本文を閉じる' }),
    );
    await waitFor(() => expect(betaTrigger).toHaveFocus());
  });

  it('copies the exact Prompt body, reports success or failure, and resets copy status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      renderPromptLibraryPage(createRepository(prompts));
      const alphaTrigger = await screen.findByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を表示`,
      });
      await user.click(alphaTrigger);
      const copyButton = screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文をコピー`,
      });
      expect(
        screen.getByRole('tooltip', { name: 'Prompt本文をコピー' }),
      ).toBeInTheDocument();
      await user.click(copyButton);
      expect(writeText).toHaveBeenCalledWith(prompts[0].body);
      expect(screen.getByText('コピーしました')).toBeVisible();
      expect(screen.getByRole('dialog', { name: 'Prompt本文' })).toBeVisible();

      await user.click(
        screen.getByRole('button', {
          name: `「${prompts[1].title}」のPrompt本文を表示`,
        }),
      );
      expect(screen.queryByText('コピーしました')).toBeNull();
      writeText.mockRejectedValueOnce(new Error('clipboard denied detail'));
      await user.click(
        screen.getByRole('button', {
          name: `「${prompts[1].title}」のPrompt本文をコピー`,
        }),
      );
      expect(screen.getByText('コピーできませんでした')).toBeVisible();
      expect(screen.queryByText('clipboard denied detail')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Prompt本文' })).toBeVisible();

      await user.click(
        screen.getByRole('button', { name: 'Prompt本文を閉じる' }),
      );
      await user.click(
        screen.getByRole('button', {
          name: `「${prompts[1].title}」のPrompt本文を表示`,
        }),
      );
      expect(screen.queryByText('コピーできませんでした')).toBeNull();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('closes an open Prompt body when filtering hides its row', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    await user.click(
      await screen.findByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を表示`,
      }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'プロジェクト' }),
      'project',
    );
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
  });

  it('cycles Prompt name sorting after filters and closes an open popover', async () => {
    const user = userEvent.setup();
    const values = [
      createPrompt('ten', 'Prompt 10', 'match', 'global'),
      createPrompt('two', 'Prompt 2', 'match', 'global'),
      createPrompt('ja', 'あいう', 'other', 'project'),
    ];
    renderPromptLibraryPage(createRepository(values));
    const table = await screen.findByRole('table', { name: 'Prompt一覧' });
    const nameHeader = within(table).getByRole('columnheader', {
      name: /Prompt名/,
    });
    const updatedHeader = within(table).getByRole('columnheader', {
      name: '更新日時',
    });
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(updatedHeader).toHaveAttribute('aria-sort', 'descending');
    await user.type(
      screen.getByRole('searchbox', { name: 'Promptを検索' }),
      'match',
    );
    await user.click(
      screen.getByRole('button', { name: '「Prompt 10」のPrompt本文を表示' }),
    );
    await user.click(
      within(nameHeader).getByRole('button', {
        name: 'Prompt名を昇順に並べ替え',
      }),
    );
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent),
    ).toEqual(['Prompt 2', 'Prompt 10']);
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await user.click(
      within(nameHeader).getByRole('button', {
        name: 'Prompt名を降順に並べ替え',
      }),
    );
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await user.click(
      within(nameHeader).getByRole('button', { name: '更新日時降順へ戻す' }),
    );
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(updatedHeader).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText('全3件中 2件を表示')).toBeVisible();
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
