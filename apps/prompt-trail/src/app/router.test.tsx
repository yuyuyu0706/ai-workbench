import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';
import { PromptTrailRepositoryProvider } from './PromptTrailRepositoryContext';
import { createPromptTrailRuntime } from './prompt-trail-runtime';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { AppRouter } from './router';
import { buildTrailDetailPath, routePaths } from './routes';

function LocationProbe({
  onLocationChange,
}: {
  onLocationChange?: (pathname: string) => void;
}) {
  const { pathname } = useLocation();

  onLocationChange?.(pathname);

  return null;
}

const databaseTestScope = createDatabaseTestScope('router');

afterEach(async () => {
  await databaseTestScope.cleanup();
});

function renderRoute(
  pathname: string,
  options: { onLocationChange?: (pathname: string) => void } = {},
) {
  const database = databaseTestScope.createDatabase();
  const runtime = createPromptTrailRuntime(database);

  render(
    <PromptTrailRepositoryProvider repository={runtime.repository}>
      <MemoryRouter initialEntries={[pathname]}>
        <LocationProbe onLocationChange={options.onLocationChange} />
        <AppShell>
          <AppRouter />
        </AppShell>
      </MemoryRouter>
    </PromptTrailRepositoryProvider>,
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
  it('renders the Public Alpha guide at the root route', () => {
    renderRoute(routePaths.root);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '次の仕事に活かせるTrailへ',
    );
    expectOnlyActiveNavigationItem('はじめに');
    expect(
      screen.getByRole('link', { name: 'PromptTrailを試す' }),
    ).toHaveAttribute('href', routePaths.dashboard);
  });

  it.each([
    [
      routePaths.dashboard,
      'Dashboard',
      'Repositoryに表示できるRunがまだありません。',
      'Fresh DBでは自動Seedせず、Repository読み取り後の正常なEmpty Stateとして表示しています。',
      [],
    ],
    [
      routePaths.promptLibrary,
      'Prompt Library',
      'Repositoryに表示できるPromptがまだありません。',
      '保存済みのActive Promptが作成されると、ここに表示されます。',
      [],
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
    async (
      pathname,
      heading,
      startMessage,
      stateDescription,
      sectionHeadings,
    ) => {
      renderRoute(pathname);

      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      if (
        pathname === routePaths.dashboard ||
        pathname === routePaths.promptLibrary
      ) {
        expectOnlyActiveNavigationItem(heading);
      } else {
        expectNoActiveNavigationItem();
      }
      expect(await screen.findByText(startMessage)).toBeInTheDocument();
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
    expectNoActiveNavigationItem();
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

  it.each([
    [routePaths.promptNew, 'Promptを新規登録'],
    ['/prompts/prompt-123/edit', 'Promptを編集'],
  ])(
    'keeps Prompt Library active on the prompt editor route %s',
    (pathname, heading) => {
      renderRoute(pathname);

      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expectOnlyActiveNavigationItem('Prompt Library');
    },
  );

  it('renders a repository-backed run detail loading state with a dashboard recovery link', () => {
    const user = userEvent.setup();
    renderRoute(buildTrailDetailPath('trail-123'));

    expect(
      screen.getByRole('heading', { name: 'Run Detail' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Runを読み込んでいます...')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Dashboardへ戻る' }),
    ).toHaveAttribute('href', '/dashboard');
    void user;
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

  it('does not activate Prompt Library for an unknown prompt URL', () => {
    renderRoute('/prompts/unknown');

    expect(
      screen.getByRole('heading', { name: 'Not Found' }),
    ).toBeInTheDocument();
    expectNoActiveNavigationItem();
  });
});
