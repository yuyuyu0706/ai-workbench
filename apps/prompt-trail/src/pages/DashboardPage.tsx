import { useEffect, useState } from 'react';

import { loadDashboardDataState, type DashboardDataState } from '../dashboard';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';

const DASHBOARD_RECENT_RUN_LIMIT = 5;

type DashboardPageState = { readonly status: 'loading' } | DashboardDataState;

type DashboardPageStateSnapshot = {
  readonly repository: ReturnType<typeof usePromptTrailRepository>;
  readonly state: DashboardPageState;
};

const dashboardSections = [
  {
    title: '最近のRun',
    description:
      'Repositoryから取得したRecent Runsを表示する領域です。実データの詳細表示は後続Issueで扱います。',
  },
  {
    title: '再開ポイント',
    description:
      '途中で止めた作業や次に確認したい作業の入口を整理する領域です。',
  },
  {
    title: '未整理Link',
    description:
      'RunやRecipeへ接続する前の参照情報を見失わないための領域です。',
  },
  {
    title: '次にやること',
    description: '作業再開時に確認すべき次の行動を示す領域です。',
  },
] as const;

export function DashboardPage() {
  const repository = usePromptTrailRepository();
  const [pageStateSnapshot, setPageStateSnapshot] =
    useState<DashboardPageStateSnapshot>({
      repository,
      state: { status: 'loading' },
    });
  const pageState =
    pageStateSnapshot.repository === repository
      ? pageStateSnapshot.state
      : ({ status: 'loading' } as const);

  useEffect(() => {
    let isActive = true;

    loadDashboardDataState(repository, {
      recentRunLimit: DASHBOARD_RECENT_RUN_LIMIT,
    }).then((dashboardDataState) => {
      if (isActive) {
        setPageStateSnapshot({ repository, state: dashboardDataState });
      }
    });

    return () => {
      isActive = false;
    };
  }, [repository]);

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description="AI作業の再開入口として、最近の活動・未整理事項・次の行動を確認する画面です。"
      />
      <DashboardStateMessage pageState={pageState} />
      <div className="prompt-trail-page__sections">
        {dashboardSections.map((section) => (
          <PageSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            <p>
              この領域はRepository接続済みのDashboard骨格です。具体的なカード表示やRecent
              Runsの詳細表示は後続Issueで実装します。
            </p>
          </PageSection>
        ))}
      </div>
    </section>
  );
}

function DashboardStateMessage({
  pageState,
}: {
  pageState: DashboardPageState;
}) {
  switch (pageState.status) {
    case 'loading':
      return (
        <StateMessage
          variant="loading"
          title="Dashboardデータを読み込んでいます..."
          description="Repositoryから最近のRunと関連情報を取得しています。"
        />
      );
    case 'empty':
      return (
        <StateMessage
          variant="empty"
          title="Repositoryに表示できるRunがまだありません。"
          description="Fresh DBでは自動Seedせず、Repository読み取り後の正常なEmpty Stateとして表示しています。"
        />
      );
    case 'failure':
      return (
        <StateMessage
          variant="error"
          title="Dashboardデータの読み込みに失敗しました。"
          description="Repositoryの読み取りに失敗しました。時間をおいてページを再読み込みしてください。"
        />
      );
    case 'data':
      return null;
  }
}
