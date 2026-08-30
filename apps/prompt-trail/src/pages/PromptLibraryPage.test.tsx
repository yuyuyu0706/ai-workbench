import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemoryRouter, type InitialEntry, useLocation } from 'react-router-dom';

import { GlobalNavigation } from '../app/GlobalNavigation';
import { NavigationGuardProvider } from '../app/NavigationGuardContext';
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
import type { Prompt, Run, Trail, UtcDateTimeString } from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';
import { PromptLibraryPage } from './PromptLibraryPage';

const timestamp = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;
const longBody = [
  '日本語の本文',
  ...Array.from({ length: 50 }, (_, index) => `本文 ${index + 1}`),
  'https://example.com/very-long-prompt-body-value',
  'PROMPT_BODY_END_MARKER',
].join('\n');
const prompts: readonly Prompt[] = [
  createPrompt('alpha', 'Alpha CODEX依頼', longBody, 'global'),
  createPrompt(
    'beta',
    'Beta設計レビュー'.repeat(6),
    '別の検索対象\n2行目\n3行目\n4行目',
    'project',
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
      'タグ',
      '更新日時',
      'Prompt',
      '操作',
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText(prompts[0].title)).toBeVisible();
    expect(screen.getByText(prompts[1].title)).toBeVisible();
    expect(within(table).getByText('Global')).toBeVisible();
    expect(within(table).getByText('Default Project')).toBeVisible();
    expect(screen.getByText('全2件')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'プロジェクト' })).toHaveValue(
      'all',
    );
    expect(screen.queryByRole('button', { name: '条件をクリア' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'タグ' })).toHaveValue('all');
    expect(
      screen.getByPlaceholderText('Prompt名または本文を検索'),
    ).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'タイトル' })).toBeNull();
    expect(table).toHaveClass('pt-prompt-table--compact');
    expect(
      screen.getByRole('link', {
        name: `「${prompts[0].title}」からTrailを作成`,
      }),
    ).toHaveAttribute('href', '/trails/new?sourcePromptId=alpha');
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
    const trailAction = screen.getByRole('link', {
      name: `「${prompts[0].title}」からTrailを作成`,
    });
    expect(trailAction.nextElementSibling).toHaveAttribute('role', 'tooltip');
    expect(trailAction.nextElementSibling).toHaveTextContent('Trailを作成');
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
    expect(screen.getByText('全2件中 1件')).toBeVisible();
    expect(screen.getByText(prompts[0].title)).toBeVisible();
    expect(screen.queryByText(prompts[1].title)).toBeNull();
    expect(repository.listActivePrompts).toHaveBeenCalledOnce();

    await user.type(search, '  日本語  ');
    expect(screen.getByText('全2件中 1件')).toBeVisible();
    await user.clear(search);
    await user.type(search, '別の検索対象');
    expect(screen.getByText('全2件中 0件')).toBeVisible();
    expect(
      screen.getByText('条件に一致するPromptがありません。'),
    ).toBeVisible();
    expect(
      screen.getByText('プロジェクト・タグまたは検索条件を変更してください。'),
    ).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Prompt一覧' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '条件をクリア' }));
    expect(search).toHaveValue('');
    expect(projectFilter).toHaveValue('all');
    expect(screen.getByText('全2件')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(repository.listActivePrompts).toHaveBeenCalledOnce();
  });

  it('shows tag chips per row, filters by tag, and combines it with Project and keyword conditions', async () => {
    const user = userEvent.setup();
    const tagged = [
      { ...prompts[0], tags: ['チャット相談', 'note', 'extra', 'more'] },
      { ...prompts[1], tags: ['note'] },
      createPrompt('gamma', 'Gamma', 'no tags here', 'global'),
    ];
    const repository = createRepository(tagged);
    renderPromptLibraryPage(repository);
    await screen.findByRole('heading', { level: 2, name: 'Prompt一覧' });

    const table = screen.getByRole('table', { name: 'Prompt一覧' });
    const tagFilter = screen.getByRole('combobox', { name: 'タグ' });
    expect(tagFilter).toHaveValue('all');
    // "note" appears on 2 prompts, so it is ordered before the single-use tags.
    expect(
      within(tagFilter)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['すべてのタグ', 'note', 'extra', 'more', 'チャット相談']);

    const alphaRow = within(table).getByText(tagged[0].title).closest('tr')!;
    expect(within(alphaRow).getByText('チャット相談')).toBeVisible();
    expect(within(alphaRow).getByText('note')).toBeVisible();
    expect(within(alphaRow).getByText('+2')).toBeVisible();
    const gammaRow = within(table).getByText('Gamma').closest('tr')!;
    expect(within(gammaRow).queryByText('+')).toBeNull();

    await user.selectOptions(tagFilter, 'note');
    expect(screen.getByText('全3件中 2件')).toBeVisible();
    expect(screen.getByText(tagged[0].title)).toBeVisible();
    expect(screen.getByText(tagged[1].title)).toBeVisible();
    expect(screen.queryByText('Gamma')).toBeNull();

    const projectFilter = screen.getByRole('combobox', {
      name: 'プロジェクト',
    });
    await user.selectOptions(projectFilter, 'project');
    expect(screen.getByText('全3件中 1件')).toBeVisible();
    expect(screen.getByText(tagged[1].title)).toBeVisible();
    expect(screen.queryByText(tagged[0].title)).toBeNull();

    const search = screen.getByRole('searchbox', { name: 'Promptを検索' });
    await user.type(search, 'チャット相談');
    expect(screen.getByText('全3件中 0件')).toBeVisible();
    expect(
      screen.getByText('プロジェクト・タグまたは検索条件を変更してください。'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: '条件をクリア' }));
    expect(tagFilter).toHaveValue('all');
    expect(projectFilter).toHaveValue('all');
    expect(search).toHaveValue('');
    expect(screen.getByText('全3件')).toBeVisible();
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
    const quickEditButton = within(dialog).getByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を編集`,
    });
    const editLink = within(dialog).getByRole('link', {
      name: `「${prompts[0].title}」を編集`,
    });
    const copyButton = within(dialog).getByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文をコピー`,
    });
    const closeButton = within(dialog).getByRole('button', {
      name: 'Prompt本文を閉じる',
    });
    expect(quickEditButton.nextElementSibling).toHaveAttribute(
      'role',
      'tooltip',
    );
    expect(quickEditButton.nextElementSibling).toHaveTextContent(
      'Prompt本文を編集',
    );
    expect(editLink).toHaveTextContent('');
    expect(editLink).toHaveAttribute('href', '/prompts/alpha/edit');
    expect(editLink.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(editLink.nextElementSibling).toHaveAttribute('role', 'tooltip');
    expect(editLink.nextElementSibling).toHaveTextContent('Promptを編集する');
    expect(
      within(dialog).getByRole('tooltip', { name: 'Promptを編集する' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText('Promptを編集する', { selector: 'a' }),
    ).toBeNull();
    expect(copyButton.nextElementSibling).toHaveAttribute('role', 'tooltip');
    expect(copyButton.nextElementSibling).toHaveTextContent(
      'Prompt本文をコピー',
    );
    expect(closeButton.nextElementSibling).toHaveAttribute('role', 'tooltip');
    expect(closeButton.nextElementSibling).toHaveTextContent('閉じる');
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
      expect(copyButton).toHaveAttribute('data-copied', 'true');
      expect(screen.getByText('コピーしました')).toBeInTheDocument();
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
      expect(screen.getByText('コピーできませんでした')).toBeInTheDocument();
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

  it('shows no variable badge and keeps the original copy behavior for Prompts without variables', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      renderPromptLibraryPage(createRepository(prompts));
      await user.click(
        await screen.findByRole('button', {
          name: `「${prompts[0].title}」のPrompt本文を表示`,
        }),
      );
      expect(
        screen.queryByRole('dialog', { name: '変数に値を入力してコピー' }),
      ).toBeNull();
      await user.click(
        screen.getByRole('button', {
          name: `「${prompts[0].title}」のPrompt本文をコピー`,
        }),
      );
      expect(writeText).toHaveBeenCalledWith(prompts[0].body);
      expect(
        screen.queryByRole('dialog', { name: '変数に値を入力してコピー' }),
      ).toBeNull();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('shows the variable panel immediately, saves and resolves values on copy, and reuses saved values on immediate re-copy', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const varPrompt = createPrompt(
      'gamma',
      'Gammaテンプレート',
      'こんにちは ${name}、今日は${topic}について話しましょう。',
    );
    const updatePromptBody = vi.fn(async (update) => ({
      ...varPrompt,
      body: update.body,
      variableValues: update.variableValues,
      updatedAt: '2026-08-02T00:00:00.000Z' as UtcDateTimeString,
    }));
    const repository = {
      listActivePrompts: vi.fn(async () => [varPrompt]),
      updatePromptBody,
    } as unknown as PromptTrailRepository;
    try {
      renderPromptLibraryPage(repository);
      const trigger = await screen.findByRole('button', {
        name: `「${varPrompt.title}」のPrompt本文を表示`,
      });
      await user.click(trigger);
      const panel = screen.getByRole('dialog', {
        name: '変数に値を入力してコピー',
      });
      expect(within(panel).getByLabelText('${name}')).toBeInTheDocument();
      expect(within(panel).getByLabelText('${topic}')).toBeInTheDocument();

      const copyButton = screen.getByRole('button', {
        name: `「${varPrompt.title}」のPrompt本文をコピー`,
      });

      await user.type(within(panel).getByLabelText('${name}'), 'Alice');
      await user.click(copyButton);
      expect(updatePromptBody).toHaveBeenCalledWith(
        expect.objectContaining({
          promptId: varPrompt.id,
          expectedUpdatedAt: varPrompt.updatedAt,
          body: varPrompt.body,
          variableValues: { name: 'Alice' },
        }),
      );
      expect(writeText).toHaveBeenCalledWith(
        'こんにちは Alice、今日は${topic}について話しましょう。',
      );
      expect(screen.getByText('コピーしました')).toBeInTheDocument();

      updatePromptBody.mockClear();
      await user.click(copyButton);
      expect(updatePromptBody).not.toHaveBeenCalled();
      expect(writeText).toHaveBeenLastCalledWith(
        'こんにちは Alice、今日は${topic}について話しましょう。',
      );
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('skips saving when the current variable values already match the saved values', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const varPrompt = {
      ...createPrompt('eta', 'Etaテンプレート', 'こんにちは ${name}'),
      variableValues: { name: 'Bob' },
    };
    const updatePromptBody = vi.fn();
    const repository = {
      listActivePrompts: vi.fn(async () => [varPrompt]),
      updatePromptBody,
    } as unknown as PromptTrailRepository;
    try {
      renderPromptLibraryPage(repository);
      await user.click(
        await screen.findByRole('button', {
          name: `「${varPrompt.title}」のPrompt本文を表示`,
        }),
      );
      await user.click(
        screen.getByRole('button', {
          name: `「${varPrompt.title}」のPrompt本文をコピー`,
        }),
      );
      expect(updatePromptBody).not.toHaveBeenCalled();
      expect(writeText).toHaveBeenCalledWith('こんにちは Bob');
      expect(screen.getByText('コピーしました')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('does not copy when saving the variable values fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const varPrompt = createPrompt(
      'theta',
      'Thetaテンプレート',
      'こんにちは ${name}',
    );
    const updatePromptBody = vi.fn(async () => {
      throw new PromptTrailRepositoryError('stale-write');
    });
    const repository = {
      listActivePrompts: vi.fn(async () => [varPrompt]),
      updatePromptBody,
    } as unknown as PromptTrailRepository;
    try {
      renderPromptLibraryPage(repository);
      await user.click(
        await screen.findByRole('button', {
          name: `「${varPrompt.title}」のPrompt本文を表示`,
        }),
      );
      await user.type(screen.getByLabelText('${name}'), 'Alice');
      await user.click(
        screen.getByRole('button', {
          name: `「${varPrompt.title}」のPrompt本文をコピー`,
        }),
      );
      expect(writeText).not.toHaveBeenCalled();
      expect(screen.getByText('コピーできませんでした')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('does not auto-focus the variable panel when it appears', async () => {
    const user = userEvent.setup();
    const varPrompt = createPrompt(
      'delta',
      'Deltaテンプレート',
      '${greeting}さん',
    );
    renderPromptLibraryPage(createRepository([varPrompt]));
    const trigger = await screen.findByRole('button', {
      name: `「${varPrompt.title}」のPrompt本文を表示`,
    });
    await user.click(trigger);
    expect(screen.getByLabelText('${greeting}')).toBeInTheDocument();
    expect(screen.getByLabelText('${greeting}')).not.toHaveFocus();
  });

  it('restores saved variable values on open, keeps them after re-opening, and uses a badge label', async () => {
    const user = userEvent.setup();
    const varPrompt = {
      ...createPrompt(
        'epsilon',
        'Epsilonテンプレート',
        'こんにちは ${name}、今日は${topic}について話しましょう。',
      ),
      variableValues: { name: 'Bob' },
    };
    const repository = {
      listActivePrompts: vi.fn(async () => [varPrompt]),
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository);

    const trigger = await screen.findByRole('button', {
      name: `「${varPrompt.title}」のPrompt本文を表示`,
    });
    await user.click(trigger);
    const nameInput = screen.getByLabelText('${name}');
    expect(nameInput).toHaveValue('Bob');
    expect(nameInput.closest('div')?.querySelector('label')).toHaveClass(
      'pt-prompt-body-popover__var-badge',
    );
    expect(screen.queryByRole('button', { name: 'コピー' })).toBeNull();

    await user.clear(nameInput);
    await user.type(nameInput, 'Carol');
    expect(screen.getByLabelText('${name}')).toHaveValue('Carol');
    await user.click(
      screen.getByRole('button', { name: 'Prompt本文を閉じる' }),
    );
    await user.click(trigger);
    expect(screen.getByLabelText('${name}')).toHaveValue('Bob');
  });

  it('persists only the values for variables that remain in the saved body', async () => {
    const user = userEvent.setup();
    const varPrompt = {
      ...createPrompt(
        'zeta',
        'Zetaテンプレート',
        'こんにちは ${name}、今日は${topic}について話しましょう。',
      ),
      variableValues: { name: 'Bob', topic: '天気' },
    };
    const updatePromptBody = vi.fn(async (update) => ({
      ...varPrompt,
      body: update.body,
      variableValues: update.variableValues,
      updatedAt: '2026-08-02T00:00:00.000Z' as UtcDateTimeString,
    }));
    const repository = {
      listActivePrompts: vi.fn(async () => [varPrompt]),
      updatePromptBody,
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository);

    await user.click(
      await screen.findByRole('button', {
        name: `「${varPrompt.title}」のPrompt本文を表示`,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: `「${varPrompt.title}」のPrompt本文を編集`,
      }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Prompt本文' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt本文' }),
      'こんにちは ${{name}}',
    );
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(updatePromptBody).toHaveBeenCalledWith(
      expect.objectContaining({ variableValues: { name: 'Bob' } }),
    );
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
    expect(screen.getByText('全3件中 2件')).toBeVisible();
  });

  it('uses dedicated alignment classes only for Prompt and action columns', async () => {
    renderPromptLibraryPage(createRepository(prompts));
    const table = await screen.findByRole('table', { name: 'Prompt一覧' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[4]).toHaveClass('pt-prompt-table__prompt-heading');
    expect(headers[5]).toHaveClass('pt-prompt-table__action-heading');
    headers.slice(0, 4).forEach((header) => {
      expect(header).not.toHaveClass(
        'pt-prompt-table__prompt-heading',
        'pt-prompt-table__action-heading',
      );
    });
    const cells = within(within(table).getAllByRole('row')[1]).getAllByRole(
      'cell',
    );
    expect(cells[4]).toHaveClass('pt-prompt-table__prompt-cell');
    expect(cells[5]).toHaveClass('pt-prompt-table__action-cell');
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

  it('keeps the popover arrow connected to the trigger when clamped, resized, and scrolled', async () => {
    const user = userEvent.setup();
    const restoreViewport = setViewport(800, 600);
    const restoreLayout = mockPromptBodyPopoverLayout({
      trigger: { left: 700, top: 540, width: 24, height: 24 },
      panel: { width: 384, height: 512 },
      editorPanel: { width: 384, height: 300 },
    });
    try {
      renderPromptLibraryPage(createRepository(prompts));
      await user.click(
        await screen.findByRole('button', {
          name: `「${prompts[0].title}」のPrompt本文を表示`,
        }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Prompt本文' });

      await waitFor(() => {
        expect(dialog).toHaveAttribute('data-placement', 'left-start');
        expect(dialog.style.top).toBe('72px');
        expect(dialog.style.left).toBe('304px');
        expect(dialog.style.getPropertyValue('--pt-prompt-body-arrow-y')).toBe(
          '480px',
        );
      });

      await user.click(
        within(dialog).getByRole('button', {
          name: `「${prompts[0].title}」のPrompt本文を編集`,
        }),
      );

      await waitFor(() => {
        expect(dialog.style.top).toBe('284px');
        expect(dialog.style.getPropertyValue('--pt-prompt-body-arrow-y')).toBe(
          '268px',
        );
      });

      window.dispatchEvent(new Event('scroll'));
      await waitFor(() => {
        expect(dialog.style.getPropertyValue('--pt-prompt-body-arrow-y')).toBe(
          '268px',
        );
      });
    } finally {
      restoreLayout();
      restoreViewport();
    }
  });

  it('uses a horizontal arrow offset for the 320px bottom fallback', async () => {
    const user = userEvent.setup();
    const restoreViewport = setViewport(320, 600);
    const restoreLayout = mockPromptBodyPopoverLayout({
      trigger: { left: 20, top: 40, width: 24, height: 24 },
      panel: { width: 288, height: 240 },
    });
    try {
      renderPromptLibraryPage(createRepository(prompts));
      await user.click(
        await screen.findByRole('button', {
          name: `「${prompts[0].title}」のPrompt本文を表示`,
        }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Prompt本文' });

      await waitFor(() => {
        expect(dialog).toHaveAttribute('data-placement', 'bottom-start');
        expect(dialog.style.left).toBe('16px');
        expect(dialog.style.getPropertyValue('--pt-prompt-body-arrow-x')).toBe(
          '16px',
        );
      });
    } finally {
      restoreLayout();
      restoreViewport();
    }
  });

  it('saves a body edit once, reloads the list once, updates row content, keeps sort, and returns focus', async () => {
    const user = userEvent.setup();
    let values = [...prompts];
    let resolveSave: (prompt: Prompt) => void = () => {};
    const repository = {
      listActivePrompts: vi.fn(async () => values),
      updatePromptBody: vi.fn(
        (update) =>
          new Promise<Prompt>((resolve) => {
            const updated = {
              ...values[0],
              body: update.body,
              updatedAt: '2026-08-02T00:00:00.000Z' as UtcDateTimeString,
            };
            values = [updated, values[1]];
            resolveSave = resolve;
          }),
      ),
      getPrompt: vi.fn(),
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository);

    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    await user.click(
      screen.getByRole('button', { name: 'Prompt名を昇順に並べ替え' }),
    );
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Prompt本文' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt本文' }),
      '更新本文',
    );
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('button', { name: '保存中...' }));

    expect(repository.updatePromptBody).toHaveBeenCalledOnce();
    resolveSave(values[0]);
    expect(await screen.findByText('Prompt本文を更新しました。')).toBeVisible();
    expect(repository.listActivePrompts).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'Prompt本文' }),
      ).toHaveTextContent('更新本文'),
    );
    expect(
      screen.getByRole('button', { name: 'Prompt名を降順に並べ替え' }),
    ).toBeInTheDocument();
  });

  it('guards dirty drafts for controls, trigger toggles, prompt switches, and links', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const alphaTrigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    const betaTrigger = screen.getByRole('button', {
      name: `「${prompts[1].title}」のPrompt本文を表示`,
    });
    await user.click(alphaTrigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt本文' }),
      ' dirty',
    );

    expect(
      screen.getByRole('combobox', { name: 'プロジェクト' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('searchbox', { name: 'Promptを検索' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Prompt名を昇順に並べ替え' }),
    ).toBeDisabled();

    await user.click(betaTrigger);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '編集中のPrompt本文を破棄しますか？',
    );
    expect(alphaTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('textbox', { name: 'Prompt本文' })).toHaveValue(
      `${prompts[0].body} dirty`,
    );
    await user.click(screen.getByRole('button', { name: '編集を続ける' }));
    await user.click(alphaTrigger);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '編集中のPrompt本文を破棄しますか？',
    );
    await user.click(screen.getByRole('button', { name: '編集を続ける' }));
    await user.click(
      screen.getAllByRole('link', { name: `「${prompts[0].title}」を編集` })[0],
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '編集中のPrompt本文を破棄しますか？',
    );
    await user.click(screen.getByRole('button', { name: '破棄する' }));
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
  });

  it('runs the Prompt body popover edit link only after confirming discard', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts), undefined, false, {
      pathname: '/prompts',
    });
    const alphaTrigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    await user.click(alphaTrigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    const textarea = screen.getByRole('textbox', { name: 'Prompt本文' });
    await user.type(textarea, ' dirty');
    const popover = screen.getByRole('dialog', { name: 'Prompt本文' });
    const popoverEditLink = within(popover).getByRole('link', {
      name: `「${prompts[0].title}」を編集`,
    });

    await user.click(popoverEditLink);
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '編集を続ける' }),
      ).toHaveFocus(),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(textarea).toHaveFocus();
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');

    await user.click(popoverEditLink);
    await user.click(screen.getByRole('button', { name: '編集を続ける' }));
    expect(textarea).toHaveFocus();
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');

    await user.click(popoverEditLink);
    await user.click(screen.getByRole('button', { name: '破棄する' }));
    expect(screen.getByLabelText('Current path')).toHaveTextContent(
      '/prompts/alpha/edit',
    );
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
  });

  it('resets a clean edit session when the trigger closes the popover', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });

    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    expect(screen.getByRole('textbox', { name: 'Prompt本文' })).toBeVisible();

    await user.click(trigger);
    expect(screen.queryByRole('dialog', { name: 'Prompt本文' })).toBeNull();
    await user.click(trigger);
    expect(
      screen.queryByRole('textbox', { name: 'Prompt本文' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文をコピー`,
      }),
    ).toBeVisible();
  });

  it('does not expose the quick edit action again while editing a dirty draft', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });

    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    const textarea = screen.getByRole('textbox', { name: 'Prompt本文' });
    await user.type(textarea, ' dirty');

    expect(
      screen.queryByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    ).toBeNull();
    expect(textarea).toHaveValue(`${prompts[0].body} dirty`);
  });

  it('returns to view mode on cancel without closing the popover when not dirty', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    const popover = screen.getByRole('dialog', { name: 'Prompt本文' });
    expect(
      within(popover).getByRole('textbox', { name: 'Prompt本文' }),
    ).toBeInTheDocument();

    await user.click(
      within(popover).getByRole('button', { name: 'キャンセル' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }),
    ).toBeInTheDocument();
    expect(
      within(popover).queryByRole('textbox', { name: 'Prompt本文' }),
    ).toBeNull();
    expect(
      within(popover).getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    ).toBeInTheDocument();
  });

  it('shows discard confirm on cancel when dirty and returns to view mode after confirm without closing the popover', async () => {
    const user = userEvent.setup();
    renderPromptLibraryPage(createRepository(prompts));
    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    const popover = screen.getByRole('dialog', { name: 'Prompt本文' });
    const textarea = within(popover).getByRole('textbox', {
      name: 'Prompt本文',
    });
    await user.type(textarea, ' dirty');

    await user.click(
      within(popover).getByRole('button', { name: 'キャンセル' }),
    );
    expect(within(popover).getByRole('alert')).toHaveTextContent(
      '編集中のPrompt本文を破棄しますか？',
    );
    expect(
      within(popover).getByRole('textbox', { name: 'Prompt本文' }),
    ).toBeInTheDocument();

    await user.click(within(popover).getByRole('button', { name: '破棄する' }));

    expect(
      screen.getByRole('dialog', { name: 'Prompt本文' }),
    ).toBeInTheDocument();
    expect(
      within(popover).queryByRole('textbox', { name: 'Prompt本文' }),
    ).toBeNull();
    expect(
      within(popover).getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    ).toBeInTheDocument();
  });

  it('guards global navigation while dirty or saving', async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: Prompt) => void;
    const repository = {
      listActivePrompts: vi.fn(async () => prompts),
      updatePromptBody: vi.fn(
        () =>
          new Promise<Prompt>((resolve) => {
            resolveSave = resolve;
          }),
      ),
      getPrompt: vi.fn(),
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository, undefined, false, '/prompts', true);
    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    const textarea = screen.getByRole('textbox', { name: 'Prompt本文' });
    await user.type(textarea, ' dirty');

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '編集中のPrompt本文を破棄しますか？',
    );
    await user.click(screen.getByRole('button', { name: '編集を続ける' }));
    await user.click(screen.getByRole('link', { name: 'はじめに' }));
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');
    await user.click(screen.getByRole('button', { name: '破棄する' }));
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/');

    await user.click(screen.getByRole('link', { name: 'Prompt Library' }));
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Prompt本文' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt本文' }),
      'saving draft',
    );
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');

    resolveSave({
      ...prompts[0],
      body: 'saving draft',
      updatedAt: '2026-08-02T00:00:00.000Z' as UtcDateTimeString,
    });
    expect(await screen.findByText('Prompt本文を更新しました。')).toBeVisible();
  });

  it('keeps saving operations modal and marks only validation errors as invalid', async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: Prompt) => void;
    const repository = {
      listActivePrompts: vi.fn(async () => prompts),
      updatePromptBody: vi.fn(
        () =>
          new Promise<Prompt>((resolve) => {
            resolveSave = resolve;
          }),
      ),
      getPrompt: vi.fn(),
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository, undefined, false, {
      pathname: '/prompts',
    });
    const trigger = await screen.findByRole('button', {
      name: `「${prompts[0].title}」のPrompt本文を表示`,
    });
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    const textarea = screen.getByRole('textbox', { name: 'Prompt本文' });
    await user.clear(textarea);
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    await user.type(textarea, '保存中本文');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(repository.updatePromptBody).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Prompt本文を閉じる' }),
    ).toBeDisabled();
    expect(
      within(screen.getByRole('dialog', { name: 'Prompt本文' })).getByRole(
        'link',
        { name: `「${prompts[0].title}」を編集` },
      ),
    ).toHaveAttribute('aria-disabled', 'true');
    await user.click(
      screen.getByRole('button', { name: 'Prompt本文を閉じる' }),
    );
    expect(screen.getByRole('dialog', { name: 'Prompt本文' })).toBeVisible();
    await user.click(
      within(screen.getByRole('dialog', { name: 'Prompt本文' })).getByRole(
        'link',
        { name: `「${prompts[0].title}」を編集` },
      ),
    );
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/prompts');

    resolveSave({
      ...prompts[0],
      body: '保存中本文',
      updatedAt: '2026-08-02T00:00:00.000Z' as UtcDateTimeString,
    });
    expect(await screen.findByText('Prompt本文を更新しました。')).toBeVisible();
  });

  it('keeps stale drafts, requires latest body reload, and saves with the refreshed baseline', async () => {
    const user = userEvent.setup();
    const latest = {
      ...prompts[0],
      body: 'latest body',
      updatedAt: '2026-08-03T00:00:00.000Z' as UtcDateTimeString,
    };
    const updatePromptBody = vi
      .fn()
      .mockRejectedValueOnce(new PromptTrailRepositoryError('stale-write'))
      .mockResolvedValueOnce({ ...latest, body: 'draft body' });
    const repository = {
      listActivePrompts: vi.fn(async () => prompts),
      updatePromptBody,
      getPrompt: vi.fn(async () => latest),
    } as unknown as PromptTrailRepository;
    renderPromptLibraryPage(repository);

    await user.click(
      await screen.findByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を表示`,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: `「${prompts[0].title}」のPrompt本文を編集`,
      }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Prompt本文' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt本文' }),
      'draft body',
    );
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '最新の本文を読み込んでから再保存してください。',
    );
    expect(screen.getByRole('textbox', { name: 'Prompt本文' })).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: '最新の本文を読み込む' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '編集中のPrompt本文を破棄しますか？',
    );
    await user.click(screen.getByRole('button', { name: '編集を続ける' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      '最新の本文を読み込んでから再保存してください。',
    );
    expect(
      screen.getByRole('button', { name: '最新の本文を読み込む' }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: '最新の本文を読み込む' }),
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '最新の本文を読み込んでから再保存してください。',
    );
    expect(
      screen.getByRole('button', { name: '最新の本文を読み込む' }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: '最新の本文を読み込む' }),
    );
    await user.click(screen.getByRole('button', { name: '破棄する' }));
    expect(repository.getPrompt).toHaveBeenCalledWith(prompts[0].id);
    expect(screen.getByRole('textbox', { name: 'Prompt本文' })).toHaveValue(
      'latest body',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt本文' }),
      ' reviewed',
    );
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(updatePromptBody).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: latest.updatedAt,
        body: 'latest body reviewed',
      }),
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

  it('shows tags as read-only chips in the Popover view mode, and none when a Prompt has no tags', async () => {
    const user = userEvent.setup();
    const tagged = { ...prompts[0], tags: ['チャット相談', 'note'] };
    const untagged = { ...prompts[1], tags: [] };
    renderPromptLibraryPage(createRepository([tagged, untagged]));

    await user.click(
      await screen.findByRole('button', {
        name: `「${tagged.title}」のPrompt本文を表示`,
      }),
    );
    const taggedDialog = screen.getByRole('dialog', { name: 'Prompt本文' });
    expect(within(taggedDialog).getByText('チャット相談')).toBeInTheDocument();
    expect(within(taggedDialog).getByText('note')).toBeInTheDocument();
    expect(
      within(taggedDialog).queryByRole('button', { name: /削除/ }),
    ).toBeNull();

    await user.click(
      screen.getByRole('button', {
        name: `「${untagged.title}」のPrompt本文を表示`,
      }),
    );
    const untaggedDialog = screen.getByRole('dialog', { name: 'Prompt本文' });
    expect(
      within(untaggedDialog).queryByLabelText('タグ'),
    ).not.toBeInTheDocument();
  });

  it('opens the Trail search Popover and shows an empty state when no Trail is linked', async () => {
    const user = userEvent.setup();
    const repository = createRepositoryWithTrailSearch([prompts[0]], []);
    renderPromptLibraryPage(repository);

    await user.click(
      await screen.findByRole('button', {
        name: `「${prompts[0].title}」から作成されたTrailを検索`,
      }),
    );

    expect(
      await screen.findByText('まだ紐づくTrailはありません'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'すべて見る' })).toHaveAttribute(
      'href',
      `/trails?promptId=${encodeURIComponent(prompts[0].id)}`,
    );
  });

  it('shows linked Trails in the Trail search Popover, most recently updated first', async () => {
    const user = userEvent.setup();
    const trailA = createTrail('trail-a', 'Trail A', timestamp);
    const trailB = createTrail(
      'trail-b',
      'Trail B',
      '2026-08-02T00:00:00.000Z' as UtcDateTimeString,
    );
    const repository = createRepositoryWithTrailSearch(
      [prompts[0]],
      [
        createRun('run-a', prompts[0].id, trailA.id),
        createRun('run-b', prompts[0].id, trailB.id),
      ],
      [trailA, trailB],
    );
    renderPromptLibraryPage(repository);

    await user.click(
      await screen.findByRole('button', {
        name: `「${prompts[0].title}」から作成されたTrailを検索`,
      }),
    );

    const list = await screen.findByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      trailB.title,
      trailA.title,
    ]);
    expect(links[0]).toHaveAttribute(
      'href',
      `/trails/${encodeURIComponent(trailB.id)}`,
    );
  });
});

type LayoutRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

function setViewport(width: number, height: number) {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
  return () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
  };
}

function mockPromptBodyPopoverLayout({
  trigger,
  panel,
  editorPanel = panel,
}: {
  readonly trigger: LayoutRect;
  readonly panel: Pick<LayoutRect, 'width' | 'height'>;
  readonly editorPanel?: Pick<LayoutRect, 'width' | 'height'>;
}) {
  const originalAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const rectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function getBoundingClientRectMock(this: Element) {
      if (this.classList.contains('pt-prompt-body-trigger'))
        return createDomRect(trigger);
      if (this.classList.contains('pt-prompt-body-popover')) {
        const nextPanel = this.querySelector('textarea') ? editorPanel : panel;
        return createDomRect({
          left: Number.parseFloat((this as HTMLElement).style.left) || 0,
          top: Number.parseFloat((this as HTMLElement).style.top) || 0,
          width: nextPanel.width,
          height: nextPanel.height,
        });
      }
      return createDomRect({ left: 0, top: 0, width: 0, height: 0 });
    });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: (handle: number) => window.clearTimeout(handle),
  });
  return () => {
    rectSpy.mockRestore();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: originalAnimationFrame,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: originalCancelAnimationFrame,
    });
  };
}

function createDomRect(rect: LayoutRect): DOMRect {
  return {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => rect,
  } as DOMRect;
}

function renderPromptLibraryPage(
  repository: PromptTrailRepository,
  store?: DeveloperUiStateStore,
  withTrigger = false,
  initialEntry: InitialEntry = '/prompts',
  withGlobalNavigation = false,
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavigationGuardProvider>
        <PromptTrailRepositoryProvider repository={repository}>
          <PromptTrailDataRevisionProvider>
            <DeveloperToolsProvider
              value={
                store
                  ? ({ uiStateStore: store } as DeveloperToolsRuntime)
                  : null
              }
            >
              {withGlobalNavigation ? <GlobalNavigation /> : null}
              <PromptLibraryPage />
              <LocationProbe />
              {withTrigger ? <DataRevisionTrigger /> : null}
            </DeveloperToolsProvider>
          </PromptTrailDataRevisionProvider>
        </PromptTrailRepositoryProvider>
      </NavigationGuardProvider>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div aria-label="Current path">{location.pathname}</div>;
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

function createRepositoryWithTrailSearch(
  values: readonly Prompt[],
  runs: readonly Run[],
  trails: readonly Trail[] = [],
): PromptTrailRepository {
  return {
    listActivePrompts: vi.fn(async () => values),
    listRunsByPrompt: vi.fn(async (promptId: Prompt['id']) =>
      runs.filter((run) => run.promptSnapshot.promptId === promptId),
    ),
    getTrail: vi.fn(
      async (trailId: Trail['id']) =>
        trails.find((trail) => trail.id === trailId) ?? null,
    ),
    listRunsByTrail: vi.fn(async () => []),
    listActiveLinks: vi.fn(async () => []),
  } as unknown as PromptTrailRepository;
}

function createTrail(
  id: string,
  title: string,
  updatedAt: UtcDateTimeString,
): Trail {
  return {
    id: id as Trail['id'],
    projectId: 'project-default' as Trail['projectId'],
    title,
    kind: 'other',
    createdAt: timestamp,
    updatedAt,
    deletedAt: null,
    archivedAt: null,
  };
}

function createRun(
  id: string,
  promptId: Prompt['id'],
  trailId: Trail['id'],
): Run {
  return {
    id: id as Run['id'],
    projectId: 'project-default' as Run['projectId'],
    trailId,
    recipeId: null,
    promptSnapshot: { promptId, title: '', body: '' },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: '',
    status: 'draft',
    evaluation: null,
    improvementNote: null,
    output: null,
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    archivedAt: null,
  };
}

function createPrompt(
  id: string,
  title: string,
  body: string,
  scope: Prompt['scope'] = 'global',
): Prompt {
  const common = {
    id: id as Prompt['id'],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    title,
    body,
    status: 'active' as const,
    tags: [],
    variableValues: {},
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
