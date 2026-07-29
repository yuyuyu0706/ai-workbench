import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { buildRunDetailPath, routePaths } from '../app/routes';
import { loadDashboardDataState, type DashboardDataState } from '../dashboard';
import type { DashboardReadModel, DashboardRecentRun } from '../dashboard';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { RunStatus } from '../domain';

import { formatDateTime } from './date-time';

const DASHBOARD_RECENT_RUN_LIMIT = 5;

type DashboardPageState = { readonly status: 'loading' } | DashboardDataState;

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

function DashboardDataSections({ data }: { data: DashboardReadModel }) {
  return (
    <div className="prompt-trail-page__sections">
      <PageSection title="最近のTrail">
        <table className="pt-dashboard-runs">
          <thead>
            <tr>
              <th className="pt-dashboard-run-row__trail" scope="col">
                Trail名
              </th>
              <th className="pt-dashboard-run-row__status" scope="col">
                ステータス
              </th>
              <th className="pt-dashboard-run-row__updated-at" scope="col">
                更新日時
              </th>
              <th className="pt-dashboard-run-row__links" scope="col">
                関連リンク
              </th>
            </tr>
          </thead>
          <tbody>
            {data.recentRuns.map((recentRun) => (
              <DashboardRecentRunRow
                key={recentRun.run.id}
                recentRun={recentRun}
              />
            ))}
          </tbody>
        </table>
      </PageSection>
    </div>
  );
}

function DashboardRecentRunRow({
  recentRun,
}: {
  recentRun: DashboardRecentRun;
}) {
  const { run, links } = recentRun;

  return (
    <tr className="pt-dashboard-run-row">
      <th className="pt-dashboard-run-row__trail" scope="row">
        <h3 className="pt-dashboard-run-row__title">
          <RouterLink
            className="pt-dashboard-run-row__title-link"
            to={buildRunDetailPath(run.id)}
          >
            {run.promptSnapshot.title}
          </RouterLink>
        </h3>
      </th>
      <td className="pt-dashboard-run-row__status">
        <span className="pt-dashboard-run-row__mobile-label">ステータス</span>
        <RunStatusPin status={run.status} />
      </td>
      <td className="pt-dashboard-run-row__updated-at">
        <span className="pt-dashboard-run-row__mobile-label">更新日時</span>
        <time dateTime={run.updatedAt}>{formatDateTime(run.updatedAt)}</time>
      </td>
      <td className="pt-dashboard-run-row__links">
        <span className="pt-dashboard-run-row__mobile-label">関連リンク</span>
        <span>{links.length}件</span>
      </td>
    </tr>
  );
}

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  draft: '下書き',
  prepared: '準備済み',
  'in-progress': '実行中',
  executed: '実行済み',
  done: '完了',
};

function RunStatusPin({ status }: { status: RunStatus }) {
  return (
    <span className={`pt-status-pin pt-status-pin--${status}`}>
      {RUN_STATUS_LABELS[status]}
    </span>
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
