import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
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
type ProjectFilter = 'all' | PromptLibraryItem['scope'];

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
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [openPrompt, setOpenPrompt] = useState<{
    id: PromptLibraryItem['id'];
    revision: number;
    snapshot: typeof snapshot;
  } | null>(null);
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
      if (active) {
        setOpenPrompt(null);
        setLoaded({ repository, state: next });
      }
    });
    return () => {
      active = false;
    };
  }, [repository, revision]);

  useEffect(() => {
    if (saved === 'created' || saved === 'updated' || deleted === true)
      navigate(location.pathname, { replace: true, state: null });
  }, [deleted, location.pathname, navigate, saved]);

  const projectFilteredPrompts =
    state.status === 'data'
      ? filterPromptLibraryItemsByProject(state.data.prompts, projectFilter)
      : [];
  const results = searchPromptLibraryItems(projectFilteredPrompts, query);
  const hasConditions = projectFilter !== 'all' || query.trim() !== '';
  const openPromptId =
    openPrompt !== null &&
    openPrompt.revision === revision &&
    openPrompt.snapshot === snapshot &&
    results.some((prompt) => prompt.id === openPrompt.id)
      ? openPrompt.id
      : null;

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
        <PageSection title="Prompt一覧">
          <div className="pt-prompt-library__tools">
            <label className="pt-prompt-project-filter">
              <span>プロジェクト</span>
              <select
                value={projectFilter}
                onChange={(event) => {
                  setOpenPrompt(null);
                  setProjectFilter(event.target.value as ProjectFilter);
                }}
              >
                <option value="all">すべてのプロジェクト</option>
                <option value="global">Global</option>
                <option value="project">Default Project</option>
              </select>
            </label>
            <label className="pt-prompt-search">
              <span>Promptを検索</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setOpenPrompt(null);
                  setQuery(event.target.value);
                }}
                placeholder="タイトルまたは本文を検索"
              />
            </label>
            <div className="pt-prompt-library__result-row">
              <p className="pt-prompt-library__result-count" aria-live="polite">
                {!hasConditions
                  ? `全${state.data.prompts.length}件を表示`
                  : `全${state.data.prompts.length}件中 ${results.length}件を表示`}
              </p>
              {!hasConditions ? null : (
                <button
                  className="pt-prompt-library__clear"
                  type="button"
                  onClick={() => {
                    setOpenPrompt(null);
                    setProjectFilter('all');
                    setQuery('');
                  }}
                >
                  条件をクリア
                </button>
              )}
            </div>
          </div>
          {results.length === 0 ? (
            <StateMessage
              variant="empty"
              title="条件に一致するPromptがありません。"
              description="プロジェクトまたは検索条件を変更してください。"
            />
          ) : (
            <div
              aria-label="Prompt一覧テーブル"
              className="pt-prompt-table-region"
              role="region"
              tabIndex={0}
            >
              <table className="pt-prompt-table" aria-label="Prompt一覧">
                <thead>
                  <tr>
                    <th scope="col">タイトル</th>
                    <th scope="col">プロジェクト</th>
                    <th scope="col">種別</th>
                    <th scope="col">更新日時</th>
                    <th scope="col">Prompt</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((prompt) => (
                    <PromptTableRow
                      key={prompt.id}
                      prompt={prompt}
                      bodyOpen={openPromptId === prompt.id}
                      onBodyToggle={() =>
                        setOpenPrompt((current) =>
                          current?.id === prompt.id
                            ? null
                            : { id: prompt.id, revision, snapshot },
                        )
                      }
                      onBodyClose={() => setOpenPrompt(null)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      ) : null}
    </section>
  );
}

function filterPromptLibraryItemsByProject(
  prompts: readonly PromptLibraryItem[],
  filter: ProjectFilter,
) {
  return filter === 'all'
    ? prompts
    : prompts.filter((prompt) => prompt.scope === filter);
}

function PromptTableRow({
  prompt,
  bodyOpen,
  onBodyToggle,
  onBodyClose,
}: {
  prompt: PromptLibraryItem;
  bodyOpen: boolean;
  onBodyToggle: () => void;
  onBodyClose: () => void;
}) {
  return (
    <tr>
      <td className="pt-prompt-table__title">{prompt.title}</td>
      <td className="pt-prompt-table__muted">
        {prompt.scope === 'global' ? 'Global' : 'Default Project'}
      </td>
      <td>
        <span className="pt-status-pin">{KIND_LABELS[prompt.kind]}</span>
      </td>
      <td className="pt-prompt-table__muted">
        <time dateTime={prompt.updatedAt}>
          {formatDateTime(prompt.updatedAt)}
        </time>
      </td>
      <td>
        <PromptBodyPopover
          prompt={prompt}
          open={bodyOpen}
          onToggle={onBodyToggle}
          onClose={onBodyClose}
        />
      </td>
      <td>
        <div className="pt-prompt-table__actions">
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
      </td>
    </tr>
  );
}

function PromptBodyPopover({
  prompt,
  open,
  onToggle,
  onClose,
}: {
  prompt: PromptLibraryItem;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const reactId = useId();
  const panelId = `prompt-body-${reactId.replaceAll(':', '')}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open || triggerRef.current === null) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(448, window.innerWidth - 32);
    setPosition({
      left: Math.max(
        16,
        Math.min(
          rect.left + rect.width / 2 - width / 2,
          window.innerWidth - width - 16,
        ),
      ),
      top: Math.min(rect.bottom + 10, window.innerHeight - 80),
      width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeAndFocus = () => {
      onClose();
      triggerRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      )
        closeAndFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndFocus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeAndFocus);
    const scrollListenerTimer = window.setTimeout(
      () => window.addEventListener('scroll', closeAndFocus, true),
      0,
    );
    return () => {
      window.clearTimeout(scrollListenerTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeAndFocus);
      window.removeEventListener('scroll', closeAndFocus, true);
    };
  }, [onClose, open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="pt-button pt-button--secondary pt-prompt-body-trigger"
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={`「${prompt.title}」のプロンプトを表示`}
        onClick={onToggle}
      >
        プロンプト
      </button>
      {open && position !== undefined
        ? createPortal(
            <div
              ref={panelRef}
              className="pt-prompt-body-popover"
              id={panelId}
              role="dialog"
              aria-label="Prompt本文"
              style={position}
            >
              <h3>Prompt本文</h3>
              <p>{prompt.body}</p>
              <div className="pt-prompt-body-popover__actions">
                <button
                  className="pt-button pt-button--secondary"
                  type="button"
                  onClick={() => {
                    onClose();
                    triggerRef.current?.focus();
                  }}
                >
                  閉じる
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
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
