import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { buildPromptEditPath, routePaths } from '../app/routes';
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
  const [notice] = useState(() =>
    saved === 'created' || saved === 'updated' ? saved : null,
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
    if (saved === 'created' || saved === 'updated')
      navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, saved]);

  const results =
    state.status === 'data'
      ? searchPromptLibraryItems(state.data.prompts, query)
      : [];

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Prompt Library"
        title="Prompt Library"
        description="保存したAIへの依頼パターンを検索し、再利用可能な資産として確認できます。"
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
          Promptを{notice === 'created' ? '登録' : '更新'}しました。
        </p>
      ) : null}
      <PromptLibraryStateMessage state={state} />
      {state.status === 'data' ? (
        <PageSection
          title="保存済みPrompt"
          description={`${state.data.prompts.length}件の利用可能なPrompt`}
        >
          <label className="pt-prompt-search">
            <span>Promptを検索</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="タイトルまたは本文を検索"
            />
          </label>
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
      <p className="pt-prompt-card__body">{prompt.body}</p>
      <p className="pt-prompt-card__meta">
        <span>{prompt.scope === 'global' ? 'Global' : 'Default Project'}</span>
        <span>
          更新{' '}
          <time dateTime={prompt.updatedAt}>
            {formatDateTime(prompt.updatedAt)}
          </time>
        </span>
      </p>
      <Link
        className="pt-prompt-card__edit"
        to={buildPromptEditPath(prompt.id)}
      >
        編集
      </Link>
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
