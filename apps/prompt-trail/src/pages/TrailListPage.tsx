import { useEffect, useState } from 'react';

import {
  loadTrailListDataState,
  type TrailListDataState,
} from '../trail-list';
import type { TrailListReadModel } from '../trail-list';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';

import { TrailTable } from './TrailTable';

const TRAIL_LIST_LIMIT = Number.MAX_SAFE_INTEGER;

type TrailListPageState = { readonly status: 'loading' } | TrailListDataState;

type TrailListPageStateSnapshot = {
  readonly repository: ReturnType<typeof usePromptTrailRepository>;
  readonly state: TrailListPageState;
};

export function TrailListPage() {
  const repository = usePromptTrailRepository();
  const { revision } = usePromptTrailDataRevision();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [pageStateSnapshot, setPageStateSnapshot] =
    useState<TrailListPageStateSnapshot>({
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
  const displayedPageState: TrailListPageState =
    pageOverride === 'failure'
      ? { status: 'failure', error: undefined }
      : pageOverride === 'loading' || pageOverride === 'empty'
        ? { status: pageOverride }
        : pageState;

  useEffect(() => {
    let isActive = true;

    loadTrailListDataState(repository, {
      limit: TRAIL_LIST_LIMIT,
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
      <TrailListStateMessage pageState={displayedPageState} />
      {displayedPageState.status === 'data' ? (
        <TrailListDataSection data={displayedPageState.data} />
      ) : null}
    </section>
  );
}

function TrailListDataSection({ data }: { data: TrailListReadModel }) {
  return (
    <div className="prompt-trail-page__sections">
      <PageSection title="Trail一覧">
        <TrailTable trails={data.trails} />
      </PageSection>
    </div>
  );
}

function TrailListStateMessage({
  pageState,
}: {
  pageState: TrailListPageState;
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
