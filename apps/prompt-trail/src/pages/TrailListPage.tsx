import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  listTrailsByPromptId,
  loadTrailListDataState,
  type TrailListDataState,
} from '../trail-list';
import type { TrailListReadModel } from '../trail-list';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { routePaths, trailListPromptIdParam } from '../app/routes';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { PromptId } from '../domain';

import { TrailTable } from './TrailTable';

const TRAIL_LIST_LIMIT = Number.MAX_SAFE_INTEGER;

type TrailListPageState = { readonly status: 'loading' } | TrailListDataState;

type TrailListPageStateSnapshot = {
  readonly repository: ReturnType<typeof usePromptTrailRepository>;
  readonly promptId: string | null;
  readonly promptName: string | null;
  readonly state: TrailListPageState;
};

export function TrailListPage() {
  const repository = usePromptTrailRepository();
  const { revision } = usePromptTrailDataRevision();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [searchParams] = useSearchParams();
  const promptId = searchParams.get(trailListPromptIdParam);
  const [pageStateSnapshot, setPageStateSnapshot] =
    useState<TrailListPageStateSnapshot>({
      repository,
      promptId,
      promptName: null,
      state: { status: 'loading' },
    });
  const pageState =
    pageStateSnapshot.repository === repository &&
    pageStateSnapshot.promptId === promptId
      ? pageStateSnapshot.state
      : ({ status: 'loading' } as const);
  const promptName =
    pageStateSnapshot.repository === repository &&
    pageStateSnapshot.promptId === promptId
      ? pageStateSnapshot.promptName
      : null;
  const pageOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'trail-list-page',
  );
  const displayedPageState: TrailListPageState =
    pageOverride === 'failure'
      ? { status: 'failure', error: undefined }
      : pageOverride === 'loading' || pageOverride === 'empty'
        ? { status: pageOverride }
        : pageState;

  useEffect(() => {
    let isActive = true;

    if (promptId === null) {
      loadTrailListDataState(repository, { limit: TRAIL_LIST_LIMIT }).then(
        (state) => {
          if (isActive) {
            setPageStateSnapshot({
              repository,
              promptId,
              promptName: null,
              state,
            });
          }
        },
      );
      return () => {
        isActive = false;
      };
    }

    Promise.all([
      listTrailsByPromptId(repository, promptId as PromptId),
      repository.getPrompt(promptId as PromptId),
    ]).then(([trails, prompt]) => {
      if (!isActive) return;
      const state: TrailListPageState =
        trails.length === 0
          ? { status: 'empty' }
          : { status: 'data', data: { trails } };
      setPageStateSnapshot({
        repository,
        promptId,
        promptName: prompt?.title ?? null,
        state,
      });
    });

    return () => {
      isActive = false;
    };
  }, [promptId, repository, revision]);

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Trail一覧"
        title="Trail一覧"
        description={
          promptId === null ? (
            'すべてのActive TrailをUpdated日時の降順で表示します。'
          ) : (
            <span className="pt-trail-list__filter-banner">
              {`『${promptName ?? promptId}』から作成されたTrailのみ表示しています。`}
              <Link to={routePaths.trailList}>すべてのTrailを見る</Link>
            </span>
          )
        }
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
