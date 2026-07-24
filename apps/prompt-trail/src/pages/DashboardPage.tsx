import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { buildRunDetailPath, routePaths } from '../app/routes';
import { loadDashboardDataState, type DashboardDataState } from '../dashboard';
import type { DashboardReadModel, DashboardRecentRun } from '../dashboard';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';

const DASHBOARD_RECENT_RUN_LIMIT = 5;

type DashboardPageState = { readonly status: 'loading' } | DashboardDataState;

type DashboardPageStateSnapshot = {
  readonly repository: ReturnType<typeof usePromptTrailRepository>;
  readonly state: DashboardPageState;
};

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
        description="AI作業の再開入口として、最近のRunと関連Linkを確認する画面です。"
        actions={
          <RouterLink
            className="pt-button pt-button--primary"
            to={routePaths.newTrail}
          >
            新しいTrailを始める
          </RouterLink>
        }
      />
      <DashboardStateMessage pageState={pageState} />
      {pageState.status === 'data' ? (
        <DashboardDataSections data={pageState.data} />
      ) : null}
    </section>
  );
}

function DashboardDataSections({ data }: { data: DashboardReadModel }) {
  return (
    <div className="prompt-trail-page__sections">
      <PageSection
        title="最近のRun"
        description="最近のRunと、その作業に紐づく関連Linkを確認できます。"
      >
        <div className="pt-dashboard-runs">
          {data.recentRuns.map((recentRun) => (
            <DashboardRecentRunCard
              key={recentRun.run.id}
              recentRun={recentRun}
            />
          ))}
        </div>
      </PageSection>
    </div>
  );
}

function DashboardRecentRunCard({
  recentRun,
}: {
  recentRun: DashboardRecentRun;
}) {
  const { run, project, recipe, links } = recentRun;

  return (
    <article className="pt-dashboard-run-card">
      <div className="pt-dashboard-run-card__header">
        <h3 className="pt-dashboard-run-card__title">
          {run.promptSnapshot.title}
        </h3>
        <RouterLink
          className="pt-button pt-button--secondary"
          to={buildRunDetailPath(run.id)}
        >
          Run Detailへ移動
        </RouterLink>
      </div>
      <dl className="pt-dashboard-run-card__meta">
        <div>
          <dt className="pt-dashboard-label">Project</dt>
          <dd className="pt-dashboard-value">{project.name}</dd>
        </div>
        {recipe === null ? null : (
          <div>
            <dt className="pt-dashboard-label">Recipe</dt>
            <dd className="pt-dashboard-value">{recipe.title}</dd>
          </div>
        )}
        <div>
          <dt className="pt-dashboard-label">Status</dt>
          <dd className="pt-dashboard-value">{run.status}</dd>
        </div>
        {run.evaluation === null ? null : (
          <div>
            <dt className="pt-dashboard-label">Evaluation</dt>
            <dd className="pt-dashboard-value">{run.evaluation}</dd>
          </div>
        )}
        <div>
          <dt className="pt-dashboard-label">Updated At</dt>
          <dd className="pt-dashboard-value">
            <time dateTime={run.updatedAt}>{run.updatedAt}</time>
          </dd>
        </div>
        <div>
          <dt className="pt-dashboard-label">Links</dt>
          <dd className="pt-dashboard-value">{links.length}件</dd>
        </div>
      </dl>
      <RelatedLinks recentRun={recentRun} />
    </article>
  );
}

function RelatedLinks({ recentRun }: { recentRun: DashboardRecentRun }) {
  const { recipe, links } = recentRun;

  return (
    <section className="pt-dashboard-related-links" aria-label="関連Link">
      <h4 className="pt-dashboard-related-links__title">関連Link</h4>
      {links.length === 0 ? (
        <p>このRunに紐づく関連Linkはありません。</p>
      ) : (
        <ul className="pt-dashboard-related-links__list">
          {links.map((link) => (
            <li className="pt-dashboard-related-link" key={link.id}>
              <p className="pt-dashboard-related-link__title">
                {link.title ?? link.type}
              </p>
              <p className="pt-dashboard-related-link__meta">
                <span>Type: {link.type}</span>
                <span>Role: {link.role}</span>
                {recipe === null ? null : <span>Recipe: {recipe.title}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
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
