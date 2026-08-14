import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { routePaths } from '../app/routes';
import { loadTrailListDataState, type TrailListDataState } from '../trail-list';
import type { TrailListReadModel } from '../trail-list';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';

import { TrailTable } from './TrailTable';

const DASHBOARD_RECENT_TRAIL_LIMIT = 5;

type DashboardPageState = { readonly status: 'loading' } | TrailListDataState;

type DashboardPageStateSnapshot = {
  readonly repository: ReturnType<typeof usePromptTrailRepository>;
  readonly state: DashboardPageState;
};

export function DashboardPage() {
  const repository = usePromptTrailRepository();
  const { revision } = usePromptTrailDataRevision();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [pageStateSnapshot, setPageStateSnapshot] =
    useState<DashboardPageStateSnapshot>({
      repository,
      state: { status: 'loading' },
    });
  const pageState =
    pageStateSnapshot.repository === repository
      ? pageStateSnapshot.state
      : ({ status: 'loading' } as const);
  const pageOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'dashboard-page',
  );
  const displayedPageState: DashboardPageState =
    pageOverride === 'failure'
      ? { status: 'failure', error: undefined }
      : pageOverride === 'loading' || pageOverride === 'empty'
        ? { status: pageOverride }
        : pageState;

  useEffect(() => {
    let isActive = true;

    loadTrailListDataState(repository, {
      limit: DASHBOARD_RECENT_TRAIL_LIMIT,
    }).then((dashboardDataState) => {
      if (isActive) {
        setPageStateSnapshot({ repository, state: dashboardDataState });
      }
    });

    return () => {
      isActive = false;
    };
  }, [repository, revision]);

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description="AI作業の再開入口として、最近のTrailを確認する画面です。"
        actions={
          <RouterLink
            className="pt-button pt-button--primary"
            to={routePaths.newTrail}
          >
            新しいTrailを始める
          </RouterLink>
        }
      />
      <DashboardStateMessage pageState={displayedPageState} />
      {displayedPageState.status === 'data' ? (
        <DashboardDataSections data={displayedPageState.data} />
      ) : null}
    </section>
  );
}

function DashboardDataSections({ data }: { data: TrailListReadModel }) {
  return (
    <div className="prompt-trail-page__sections">
      <PageSection
        title="最近のTrail"
        actions={
          <RouterLink
            className="pt-button pt-button--secondary pt-dashboard-header__all-trails-link"
            to={routePaths.trailList}
          >
            すべてのTrailを表示
          </RouterLink>
        }
      >
        <TrailTable trails={data.trails} />
      </PageSection>
    </div>
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
