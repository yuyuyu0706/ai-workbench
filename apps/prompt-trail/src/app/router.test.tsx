import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';
import { AppRouter } from './router';
import { buildRunDetailPath, routePaths } from './routes';

function LocationProbe({
  onLocationChange,
}: {
  onLocationChange?: (pathname: string) => void;
}) {
  const { pathname } = useLocation();

  onLocationChange?.(pathname);

  return null;
}

function renderRoute(
  pathname: string,
  options: { onLocationChange?: (pathname: string) => void } = {},
) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <LocationProbe onLocationChange={options.onLocationChange} />
      <AppShell>
        <AppRouter />
      </AppShell>
    </MemoryRouter>,
  );
}

function getGlobalNavigation() {
  return screen.getByRole('navigation', { name: 'Global navigation' });
}

function expectOnlyActiveNavigationItem(accessibleName: string) {
  const navigation = getGlobalNavigation();
  const activeLinks = within(navigation).getAllByRole('link', {
    current: 'page',
  });

  expect(activeLinks).toHaveLength(1);
  expect(activeLinks[0]).toHaveAccessibleName(accessibleName);

  for (const link of within(navigation).getAllByRole('link')) {
    if (link === activeLinks[0]) {
      continue;
    }

    expect(link).not.toHaveAttribute('aria-current');
  }
}

function expectNoActiveNavigationItem() {
  expect(
    within(getGlobalNavigation()).queryByRole('link', { current: 'page' }),
  ).toBeNull();
}

describe('AppRouter', () => {
  it('redirects the root route to the dashboard skeleton and active navigation', async () => {
    const visitedPathnames: string[] = [];
    renderRoute(routePaths.root, {
      onLocationChange: (pathname) => visitedPathnames.push(pathname),
    });

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('最近のRun')).toBeInTheDocument();
    expectOnlyActiveNavigationItem('Dashboard');
    expect(visitedPathnames.at(-1)).toBe(routePaths.dashboard);
  });

  it.each([
    [
      routePaths.dashboard,
      'Dashboard',
      'AI作業を再開するための利用開始状態です。',
      'まだRepositoryから取得したRunやLinkがないため、画面の役割と次に確認する領域だけを静的に示します。P0-5以降でRepository連携後のempty stateへ置き換えます。',
      ['最近のRun', '再開ポイント', '未整理Link', '次にやること'],
    ],
    [
      routePaths.promptLibrary,
      'Prompt Library',
      'Prompt資産を登録する前の利用開始状態です。',
      'まだRepositoryからPromptを取得しないため、依頼テンプレートを蓄積する場所だけを静的に示します。P0-5以降でRepository連携後のempty stateと作成導線へ置き換えます。',
      ['Prompt資産', '分類・検索予定', '作成導線予定', 'Recipeへの接続'],
    ],
    [
      routePaths.contextLibrary,
      'Context Library',
      'Context資産を登録する前の利用開始状態です。',
      'まだRepositoryからContextを取得しないため、AI作業へ渡す背景・制約・前提を整理する場所だけを静的に示します。P0-5以降でRepository連携後のempty stateと作成導線へ置き換えます。',
      [
        'Context資産',
        '背景・制約・前提の整理',
        '分類・検索予定',
        'Recipeへの接続',
      ],
    ],
  ])(
    'renders the static page skeleton for %s',
    (pathname, heading, startMessage, stateDescription, sectionHeadings) => {
      renderRoute(pathname);

      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expectOnlyActiveNavigationItem(heading);
      expect(screen.getByText(startMessage)).toBeInTheDocument();
      expect(screen.getByText(stateDescription)).toBeInTheDocument();

      for (const sectionHeading of sectionHeadings) {
        expect(
          screen.getByRole('heading', { level: 2, name: sectionHeading }),
        ).toBeInTheDocument();
      }
    },
  );

  it('renders the static recipe builder skeleton', () => {
    renderRoute(routePaths.recipeBuilder);

    expect(
      screen.getByRole('heading', { name: 'Recipe Builder' }),
    ).toBeInTheDocument();
    expectOnlyActiveNavigationItem('Recipe Builder');
    expect(
      screen.getByText('Recipeを組み立てる前の利用開始状態です。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'まだRepositoryからPromptやContextを取得しないため、AI作業を組み立てる静的な骨格だけを示します。Prompt選択、Context選択、保存、実行の実動作はP0-5以降で扱います。',
      ),
    ).toBeInTheDocument();

    for (const sectionHeading of [
      'Prompt選択',
      'Context選択',
      'Recipe組み立て',
      '実行準備',
    ]) {
      expect(
        screen.getByRole('heading', { level: 2, name: sectionHeading }),
      ).toBeInTheDocument();
    }
  });

  it('renders run detail from a direct URL with an explicit dashboard recovery link', async () => {
    const user = userEvent.setup();
    renderRoute(buildRunDetailPath('run-123'));

    expect(
      screen.getByRole('heading', { name: 'Run Detail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Runを振り返る前の利用開始状態です。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'まだRepositoryからRun履歴を取得しないため、振り返りに必要な領域だけを静的に示します。P0-5以降でRepository連携後のempty / failure stateと実データ表示へ置き換えます。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Run run-123 の入力、成果物、評価を含めて振り返る画面です。',
      ),
    ).toBeInTheDocument();

    for (const sectionHeading of [
      '実行サマリ',
      '使用したRecipe',
      'Prompt Snapshot',
      'Context Snapshot',
      '成果物 / Link',
      '評価',
      '改善メモ',
    ]) {
      expect(
        screen.getByRole('heading', { level: 2, name: sectionHeading }),
      ).toBeInTheDocument();
    }

    expectNoActiveNavigationItem();

    const dashboardLink = screen.getByRole('link', { name: 'Dashboardへ戻る' });
    expect(dashboardLink).toHaveAttribute('href', routePaths.dashboard);

    await user.click(dashboardLink);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('renders not found for an unknown URL with an explicit dashboard recovery link', async () => {
    const user = userEvent.setup();
    renderRoute('/unknown-route');

    expect(
      screen.getByRole('heading', { name: 'Not Found' }),
    ).toBeInTheDocument();
    expect(screen.getByText('未知のURLです。')).toBeInTheDocument();

    expectNoActiveNavigationItem();

    const dashboardLink = screen.getByRole('link', { name: 'Dashboardへ戻る' });
    expect(dashboardLink).toHaveAttribute('href', routePaths.dashboard);

    await user.click(dashboardLink);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });
});
