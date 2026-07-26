import { useEffect, useId, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { buildRunDetailPath, routePaths } from '../app/routes';
import { loadDashboardDataState, type DashboardDataState } from '../dashboard';
import type { DashboardReadModel, DashboardRecentRun } from '../dashboard';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import type { Run, RunStatus } from '../domain';

import { formatDashboardDateTime } from './dashboard-date-time';

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
      <DashboardStateMessage pageState={pageState} />
      {pageState.status === 'data' ? (
        <DashboardDataSections data={pageState.data} />
      ) : null}
    </section>
  );
}

function DashboardDataSections({ data }: { data: DashboardReadModel }) {
  const [openMenuRunId, setOpenMenuRunId] = useState<Run['id'] | null>(null);

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
              <th className="pt-dashboard-run-row__action" scope="col">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {data.recentRuns.map((recentRun) => (
              <DashboardRecentRunRow
                key={recentRun.run.id}
                recentRun={recentRun}
                isMenuOpen={openMenuRunId === recentRun.run.id}
                onMenuOpenChange={(isOpen) =>
                  setOpenMenuRunId(isOpen ? recentRun.run.id : null)
                }
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
  isMenuOpen,
  onMenuOpenChange,
}: {
  recentRun: DashboardRecentRun;
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
}) {
  const { run, links } = recentRun;

  return (
    <tr className="pt-dashboard-run-row">
      <th className="pt-dashboard-run-row__trail" scope="row">
        <h3 className="pt-dashboard-run-row__title">
          {run.promptSnapshot.title}
        </h3>
      </th>
      <td className="pt-dashboard-run-row__status">
        <span className="pt-dashboard-run-row__mobile-label">ステータス</span>
        <RunStatusPin status={run.status} />
      </td>
      <td className="pt-dashboard-run-row__updated-at">
        <span className="pt-dashboard-run-row__mobile-label">更新日時</span>
        <time dateTime={run.updatedAt}>
          {formatDashboardDateTime(run.updatedAt)}
        </time>
      </td>
      <td className="pt-dashboard-run-row__links">
        <span className="pt-dashboard-run-row__mobile-label">関連リンク</span>
        <span>{links.length}件</span>
      </td>
      <td className="pt-dashboard-run-row__action">
        <DashboardRunActionMenu
          run={run}
          isOpen={isMenuOpen}
          onOpenChange={onMenuOpenChange}
        />
      </td>
    </tr>
  );
}

function DashboardRunActionMenu({
  run,
  isOpen,
  onOpenChange,
}: {
  run: DashboardRecentRun['run'];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const generatedId = useId();
  const triggerId = `${generatedId}-trigger`;
  const menuId = `${generatedId}-menu`;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    menuItemRef.current?.focus();

    const closeFromOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="pt-dashboard-run-menu" ref={containerRef}>
      <button
        id={triggerId}
        ref={triggerRef}
        className="pt-dashboard-run-menu__trigger"
        type="button"
        aria-label={`${run.promptSnapshot.title}の操作メニュー`}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!isOpen)}
      >
        <svg aria-hidden="true" viewBox="0 0 4 16" focusable="false">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" />
        </svg>
      </button>
      {isOpen ? (
        <div
          className="pt-dashboard-run-menu__popover"
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
        >
          <RouterLink
            ref={menuItemRef}
            className="pt-dashboard-run-menu__item"
            role="menuitem"
            to={buildRunDetailPath(run.id)}
          >
            Trailを確認
          </RouterLink>
        </div>
      ) : null}
    </div>
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
