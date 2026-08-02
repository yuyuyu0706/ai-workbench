import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import {
  buildNewTrailFromPromptPath,
  buildPromptEditPath,
  routePaths,
} from '../app/routes';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import {
  loadPromptLibraryDataState,
  searchPromptLibraryItems,
  type PromptLibraryDataState,
  type PromptLibraryItem,
} from '../prompt-library';
import { formatDateTime } from './date-time';

type PageState = { readonly status: 'loading' } | PromptLibraryDataState;

const KIND_LABELS: Record<PromptLibraryItem['kind'], string> = {
  'chat-consultation': 'チャット相談',
  'codex-request': 'Codex依頼',
  'issue-creation': 'Issue作成',
  'design-review': '設計レビュー',
  'incident-analysis': '障害分析',
  other: 'その他',
};

export function PromptLibraryPage() {
  const repository = usePromptTrailRepository();
  const { revision } = usePromptTrailDataRevision();
  const snapshot = useDeveloperUiStateSnapshot();
  const location = useLocation();
  const navigate = useNavigate();
  const saved = (location.state as { promptSaved?: string } | null)
    ?.promptSaved;
  const deleted = (location.state as { promptDeleted?: boolean } | null)
    ?.promptDeleted;
  const [notice] = useState(() =>
    deleted === true
      ? 'deleted'
      : saved === 'created' || saved === 'updated'
        ? saved
        : null,
  );
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState<{
    repository: typeof repository;
    state: PageState;
  }>({
    repository,
    state: { status: 'loading' },
  });
  const current =
    loaded.repository === repository
      ? loaded.state
      : { status: 'loading' as const };
  const override = selectActiveDeveloperUiState(
    snapshot,
    'prompt-library-page',
  );
  const state: PageState =
    override === 'failure'
      ? { status: 'failure', error: undefined }
      : override === 'loading' || override === 'empty'
        ? { status: override }
        : current;

  useEffect(() => {
    let active = true;
    loadPromptLibraryDataState(repository).then((next) => {
      if (active) setLoaded({ repository, state: next });
    });
    return () => {
      active = false;
    };
  }, [repository, revision]);

  useEffect(() => {
    if (saved === 'created' || saved === 'updated' || deleted === true)
      navigate(location.pathname, { replace: true, state: null });
  }, [deleted, location.pathname, navigate, saved]);

  const results =
    state.status === 'data'
      ? searchPromptLibraryItems(state.data.prompts, query)
      : [];

  return (
    <section className="prompt-trail-page">
      <PageHeader
        title="Prompt Library"
        description="保存済みPromptを検索・改善し、新しいTrailへ再利用できます。"
        actions={
          <Link
            className="pt-button pt-button--primary"
            to={routePaths.promptNew}
          >
            Promptを新規登録
          </Link>
        }
      />
      {notice !== null ? (
        <p className="pt-success-notice" role="status">
          {notice === 'deleted'
            ? 'Promptを削除しました。'
            : `Promptを${notice === 'created' ? '登録' : '更新'}しました。`}
        </p>
      ) : null}
      <PromptLibraryStateMessage state={state} />
      {state.status === 'data' ? (
        <PageSection
          title="保存済みPrompt"
          description="利用するPromptをタイトルまたは本文から探せます。"
        >
          <div className="pt-prompt-library__tools">
            <label className="pt-prompt-search">
              <span>Promptを検索</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="タイトルまたは本文を検索"
              />
            </label>
            <div className="pt-prompt-library__result-row">
              <p className="pt-prompt-library__result-count" aria-live="polite">
                {query.trim() === ''
                  ? `全${state.data.prompts.length}件を表示`
                  : `全${state.data.prompts.length}件中 ${results.length}件を表示`}
              </p>
              {query.trim() === '' ? null : (
                <button
                  className="pt-prompt-library__clear"
                  type="button"
                  onClick={() => setQuery('')}
                >
                  検索をクリア
                </button>
              )}
            </div>
          </div>
          {results.length === 0 ? (
            <StateMessage
              variant="empty"
              title="検索条件に一致するPromptがありません。"
              description="別のキーワードを入力するか、検索条件を削除してください。"
            />
          ) : (
            <ul className="pt-prompt-list" aria-label="Prompt一覧">
              {results.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </ul>
          )}
        </PageSection>
      ) : null}
    </section>
  );
}

function PromptCard({ prompt }: { prompt: PromptLibraryItem }) {
  return (
    <li className="pt-prompt-card">
      <div className="pt-prompt-card__heading">
        <h3>{prompt.title}</h3>
        <span className="pt-status-pin">{KIND_LABELS[prompt.kind]}</span>
      </div>
      <p className="pt-prompt-card__meta">
        <span>{prompt.scope === 'global' ? 'Global' : 'Default Project'}</span>
        <span>
          更新{' '}
          <time dateTime={prompt.updatedAt}>
            {formatDateTime(prompt.updatedAt)}
          </time>
        </span>
      </p>
      <p className="pt-prompt-card__body">{prompt.body}</p>
      <div className="pt-prompt-card__actions">
        <Link
          className="pt-button pt-button--primary"
          to={buildNewTrailFromPromptPath(prompt.id)}
          aria-label={`「${prompt.title}」からTrailを作成`}
        >
          Trailを作成
        </Link>
        <Link
          className="pt-button pt-button--secondary"
          to={buildPromptEditPath(prompt.id)}
          aria-label={`「${prompt.title}」を編集`}
        >
          編集
        </Link>
      </div>
    </li>
  );
}

function PromptLibraryStateMessage({ state }: { state: PageState }) {
  if (state.status === 'loading')
    return (
      <StateMessage
        variant="loading"
        title="Promptを読み込んでいます..."
        description="Repositoryから利用可能なPromptを取得しています。"
      />
    );
  if (state.status === 'empty')
    return (
      <StateMessage
        variant="empty"
        title="Repositoryに表示できるPromptがまだありません。"
        description="保存済みのActive Promptが作成されると、ここに表示されます。"
      />
    );
  if (state.status === 'failure')
    return (
      <StateMessage
        variant="error"
        title="Promptの読み込みに失敗しました。"
        description="時間をおいてページを再読み込みしてください。"
      />
    );
  return null;
}
