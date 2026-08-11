import { useEffect, useState } from 'react';

import { loadDashboardDataState, type DashboardDataState } from '../dashboard';
import type { DashboardReadModel } from '../dashboard';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';

import { RunTable } from './RunTable';

const RUN_LIST_LIMIT = Number.MAX_SAFE_INTEGER;

type RunListPageState = { readonly status: 'loading' } | DashboardDataState;

type RunListPageStateSnapshot = {
  readonly repository: ReturnType<typeof usePromptTrailRepository>;
  readonly state: RunListPageState;
};

export function RunListPage() {
  const repository = usePromptTrailRepository();
  const { revision } = usePromptTrailDataRevision();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [pageStateSnapshot, setPageStateSnapshot] =
    useState<RunListPageStateSnapshot>({
      repository,
      state: { status: 'loading' },
    });
  const pageState =
    pageStateSnapshot.repository === repository
      ? pageStateSnapshot.state
      : ({ status: 'loading' } as const);
  const pageOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'run-list-page',
  );
  const displayedPageState: RunListPageState =
    pageOverride === 'failure'
      ? { status: 'failure', error: undefined }
      : pageOverride === 'loading' || pageOverride === 'empty'
        ? { status: pageOverride }
        : pageState;

  useEffect(() => {
    let isActive = true;

    loadDashboardDataState(repository, {
      recentRunLimit: RUN_LIST_LIMIT,
    }).then((dataState) => {
      if (isActive) {
        setPageStateSnapshot({ repository, state: dataState });
      }
    });

    return () => {
      isActive = false;
    };
  }, [repository, revision]);

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Trail一覧"
        title="Trail一覧"
        description="すべてのActive TrailをUpdated日時の降順で表示します。"
      />
      <RunListStateMessage pageState={displayedPageState} />
      {displayedPageState.status === 'data' ? (
        <RunListDataSection data={displayedPageState.data} />
      ) : null}
    </section>
  );
}

function RunListDataSection({ data }: { data: DashboardReadModel }) {
  return (
    <div className="prompt-trail-page__sections">
      <PageSection title="Trail一覧">
        <RunTable runs={data.recentRuns} />
      </PageSection>
    </div>
  );
}

function RunListStateMessage({
  pageState,
}: {
  pageState: RunListPageState;
}) {
  switch (pageState.status) {
    case 'loading':
      return (
        <StateMessage
          variant="loading"
          title="Trail一覧を読み込んでいます..."
          description="Repositoryから全Trailを取得しています。"
        />
      );
    case 'empty':
      return (
        <StateMessage
          variant="empty"
          title="Repositoryに表示できるTrailがまだありません。"
          description="Fresh DBでは自動Seedせず、Repository読み取り後の正常なEmpty Stateとして表示しています。"
        />
      );
    case 'failure':
      return (
        <StateMessage
          variant="error"
          title="Trail一覧の読み込みに失敗しました。"
          description="Repositoryの読み取りに失敗しました。時間をおいてページを再読み込みしてください。"
        />
      );
    case 'data':
      return null;
  }
}
