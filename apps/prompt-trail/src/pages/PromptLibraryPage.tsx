import {
  useCallback,
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
                <colgroup>
                  <col className="pt-prompt-table__column-title" />
                  <col className="pt-prompt-table__column-project" />
                  <col className="pt-prompt-table__column-kind" />
                  <col className="pt-prompt-table__column-updated-at" />
                  <col className="pt-prompt-table__column-prompt" />
                  <col className="pt-prompt-table__column-actions" />
                </colgroup>
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
      <td className="pt-prompt-table__title">
        <Link
          className="pt-prompt-table__title-link"
          to={buildPromptEditPath(prompt.id)}
          aria-label={`「${prompt.title}」を編集`}
        >
          {prompt.title}
        </Link>
      </td>
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
      <td className="pt-prompt-table__prompt-cell">
        <PromptBodyPopover
          prompt={prompt}
          open={bodyOpen}
          onToggle={onBodyToggle}
          onClose={onBodyClose}
        />
      </td>
      <td>
        <Link
          className="pt-button pt-button--primary"
          to={buildNewTrailFromPromptPath(prompt.id)}
          aria-label={`「${prompt.title}」からTrailを作成`}
        >
          Trailを作成
        </Link>
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
  const tooltipId = `${panelId}-tooltip`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    placement: 'right-start' | 'left-start' | 'bottom-start';
    style: CSSProperties;
  }>();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (trigger === null || panel === null) return;
    const margin = 16;
    const gap = 12;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width;
    const panelHeight = panelRect.height;
    const top = Math.max(
      margin,
      Math.min(triggerRect.top, window.innerHeight - panelHeight - margin),
    );
    if (window.innerWidth - triggerRect.right >= panelWidth + gap) {
      setPosition({
        placement: 'right-start',
        style: { left: triggerRect.right + gap, top },
      });
      return;
    }
    if (triggerRect.left >= panelWidth + gap) {
      setPosition({
        placement: 'left-start',
        style: { left: triggerRect.left - panelWidth - gap, top },
      });
      return;
    }
    setPosition({
      placement: 'bottom-start',
      style: {
        left: Math.max(
          margin,
          Math.min(triggerRect.left, window.innerWidth - panelWidth - margin),
        ),
        top: Math.min(
          triggerRect.bottom + gap,
          window.innerHeight - panelHeight - margin,
        ),
      },
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const closeAndFocus = () => {
      onClose();
      triggerRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeAndFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndFocus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [onClose, open, updatePosition]);

  return (
    <>
      <span className="pt-prompt-body-trigger-wrap">
        <button
          ref={triggerRef}
          className="pt-prompt-body-trigger"
          type="button"
          aria-controls={panelId}
          aria-describedby={tooltipId}
          aria-expanded={open}
          aria-label={`「${prompt.title}」のPrompt本文を表示`}
          onClick={onToggle}
        >
          <svg
            aria-hidden="true"
            className="pt-prompt-body-trigger__icon"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="M6 3.5h8l4 4V20.5H6zM14 3.5v4h4M9 12h6M9 15.5h6" />
          </svg>
        </button>
        <span
          className="pt-prompt-body-trigger__tooltip"
          id={tooltipId}
          role="tooltip"
        >
          Prompt本文を表示
        </span>
      </span>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="pt-prompt-body-popover"
              data-placement={position?.placement}
              id={panelId}
              role="dialog"
              aria-label="Prompt本文"
              style={
                position?.style ?? {
                  left: 0,
                  top: 0,
                  visibility: 'hidden',
                }
              }
            >
              <span
                aria-hidden="true"
                className="pt-prompt-body-popover__arrow"
              />
              <h3>Prompt本文</h3>
              <div className="pt-prompt-body-popover__content">
                <p>{prompt.body}</p>
              </div>
              <div className="pt-prompt-body-popover__actions">
                <button
                  aria-label="Prompt本文を閉じる"
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
