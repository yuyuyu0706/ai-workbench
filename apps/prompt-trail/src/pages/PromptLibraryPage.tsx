import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  CLEAN_NAVIGATION_GUARD,
  useSetNavigationGuard,
} from '../app/NavigationGuardContext';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import {
  buildNewTrailFromPromptPath,
  buildPromptEditPath,
  buildTrailDetailPath,
  buildTrailListByPromptPath,
  routePaths,
} from '../app/routes';
import { PageSection, StateMessage } from '../components/ui';
import { ResponsivePopover } from '../components/ResponsivePopover';
import type {
  PopoverMeasurements,
  PopoverPlacementOption,
} from '../components/usePopoverPosition';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import {
  collectUsedTags,
  filterPromptLibraryItemsByTag,
  loadPromptLibraryDataState,
  searchPromptLibraryItems,
  sortPromptLibraryItems,
  type PromptLibraryDataState,
  type PromptLibraryItem,
  type PromptSortMode,
  type PromptTagFilter,
} from '../prompt-library';
import { listTrailsByPromptId, type TrailListItem } from '../trail-list';
import { updatePromptBody, validatePromptBody } from '../prompt-editor';
import {
  extractPromptVariables,
  resolvePromptVariables,
} from '../prompt-shared/promptVariables';
import { formatDateTime } from './date-time';

type PageState = { readonly status: 'loading' } | PromptLibraryDataState;
type ProjectFilter = 'all' | PromptLibraryItem['scope'];
type PromptBodyDiscardRequest = (action: () => void) => boolean;
type PromptBodyGuardState = {
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly requestDiscard: PromptBodyDiscardRequest | null;
};

type PromptBodyRecoveryStatus = 'stale' | 'not-found' | 'unavailable' | null;
type PromptBodyMessageKind =
  'validation' | 'discard' | 'status' | 'notice' | null;
type PromptBodyDiscardRestore = {
  readonly error: string | null;
  readonly messageKind: PromptBodyMessageKind;
  readonly recoveryStatus: PromptBodyRecoveryStatus;
};

const CLEAN_PROMPT_BODY_GUARD: PromptBodyGuardState = {
  dirty: false,
  saving: false,
  requestDiscard: null,
};

type PromptBodyPopoverPlacement = 'right-start' | 'left-start' | 'bottom-start';

const PROMPT_BODY_POPOVER_ARROW_SIZE_PX = 12;
const PROMPT_BODY_POPOVER_ARROW_SAFE_MARGIN_PX = 16;

function promptBodyPopoverSideTop(m: PopoverMeasurements) {
  const maxTop = Math.max(
    m.margin,
    m.viewportHeight - m.panelHeight - m.margin,
  );
  return Math.max(m.margin, Math.min(m.triggerRect.top, maxTop));
}

const PROMPT_BODY_POPOVER_PLACEMENTS: readonly PopoverPlacementOption<PromptBodyPopoverPlacement>[] =
  [
    {
      id: 'right-start',
      fits: (m) =>
        m.viewportWidth - m.triggerRect.right >= m.panelWidth + m.gap,
      place: (m) => ({
        left: m.triggerRect.right + m.gap,
        top: promptBodyPopoverSideTop(m),
      }),
    },
    {
      id: 'left-start',
      fits: (m) => m.triggerRect.left >= m.panelWidth + m.gap,
      place: (m) => ({
        left: m.triggerRect.left - m.panelWidth - m.gap,
        top: promptBodyPopoverSideTop(m),
      }),
    },
    {
      id: 'bottom-start',
      fits: () => true,
      place: (m) => {
        const maxLeft = Math.max(
          m.margin,
          m.viewportWidth - m.panelWidth - m.margin,
        );
        const left = Math.max(m.margin, Math.min(m.triggerRect.left, maxLeft));
        const top = Math.min(
          m.triggerRect.bottom + m.gap,
          Math.max(m.margin, m.viewportHeight - m.panelHeight - m.margin),
        );
        return { left, top };
      },
    },
  ];

type TrailSearchPopoverPlacement =
  'right-start' | 'left-start' | 'bottom-start';

const TRAIL_SEARCH_POPOVER_ARROW_SIZE_PX = 12;
const TRAIL_SEARCH_POPOVER_ARROW_SAFE_MARGIN_PX = 16;
const TRAIL_SEARCH_RESULT_LIMIT = 3;

function trailSearchPopoverSideTop(m: PopoverMeasurements) {
  const maxTop = Math.max(
    m.margin,
    m.viewportHeight - m.panelHeight - m.margin,
  );
  return Math.max(m.margin, Math.min(m.triggerRect.top, maxTop));
}

const TRAIL_SEARCH_POPOVER_PLACEMENTS: readonly PopoverPlacementOption<TrailSearchPopoverPlacement>[] =
  [
    {
      id: 'right-start',
      fits: (m) =>
        m.viewportWidth - m.triggerRect.right >= m.panelWidth + m.gap,
      place: (m) => ({
        left: m.triggerRect.right + m.gap,
        top: trailSearchPopoverSideTop(m),
      }),
    },
    {
      id: 'left-start',
      fits: (m) => m.triggerRect.left >= m.panelWidth + m.gap,
      place: (m) => ({
        left: m.triggerRect.left - m.panelWidth - m.gap,
        top: trailSearchPopoverSideTop(m),
      }),
    },
    {
      id: 'bottom-start',
      fits: () => true,
      place: (m) => {
        const maxLeft = Math.max(
          m.margin,
          m.viewportWidth - m.panelWidth - m.margin,
        );
        const left = Math.max(m.margin, Math.min(m.triggerRect.left, maxLeft));
        const top = Math.min(
          m.triggerRect.bottom + m.gap,
          Math.max(m.margin, m.viewportHeight - m.panelHeight - m.margin),
        );
        return { left, top };
      },
    },
  ];

export function PromptLibraryPage() {
  const repository = usePromptTrailRepository();
  const { revision, notifyDataChanged } = usePromptTrailDataRevision();
  const snapshot = useDeveloperUiStateSnapshot();
  const location = useLocation();
  const navigate = useNavigate();
  const saved = (location.state as { promptSaved?: string } | null)
    ?.promptSaved;
  const deleted = (location.state as { promptDeleted?: boolean } | null)
    ?.promptDeleted;
  const [quickEditNotice, setQuickEditNotice] = useState<string | null>(null);
  const [notice] = useState(() =>
    deleted === true
      ? 'deleted'
      : saved === 'created' || saved === 'updated'
        ? saved
        : null,
  );
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [tagFilter, setTagFilter] = useState<PromptTagFilter>('all');
  const [sortMode, setSortMode] = useState<PromptSortMode>('updated-desc');
  const keepOpenPromptIdRef = useRef<string | null>(null);
  const [openPrompt, setOpenPrompt] = useState<{
    id: PromptLibraryItem['id'];
    revision: number;
    snapshot: typeof snapshot;
  } | null>(null);
  const [promptBodyGuard, setPromptBodyGuardState] =
    useState<PromptBodyGuardState>(CLEAN_PROMPT_BODY_GUARD);
  const setNavigationGuard = useSetNavigationGuard();
  const setPromptBodyGuard = useCallback(
    (guard: PromptBodyGuardState) => {
      setPromptBodyGuardState(guard);
      setNavigationGuard(guard);
    },
    [setNavigationGuard],
  );

  useEffect(() => {
    return () => setNavigationGuard(CLEAN_NAVIGATION_GUARD);
  }, [setNavigationGuard]);
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
    const keepId = keepOpenPromptIdRef.current;
    keepOpenPromptIdRef.current = null;
    loadPromptLibraryDataState(repository).then((next) => {
      if (active) {
        setLoaded({ repository, state: next });
        if (keepId !== null) {
          setOpenPrompt((prev) =>
            prev?.id === keepId ? { ...prev, revision } : null,
          );
        } else {
          setOpenPrompt(null);
        }
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
  const tagFilteredPrompts = filterPromptLibraryItemsByTag(
    projectFilteredPrompts,
    tagFilter,
  );
  const searchedPrompts = searchPromptLibraryItems(tagFilteredPrompts, query);
  const results = sortPromptLibraryItems(searchedPrompts, sortMode);
  const hasConditions =
    projectFilter !== 'all' || tagFilter !== 'all' || query.trim() !== '';
  const usedTags =
    state.status === 'data' ? collectUsedTags(state.data.prompts) : [];
  const openPromptId =
    openPrompt !== null &&
    openPrompt.revision === revision &&
    openPrompt.snapshot === snapshot &&
    results.some((prompt) => prompt.id === openPrompt.id)
      ? openPrompt.id
      : null;
  const controlsLocked = promptBodyGuard.dirty || promptBodyGuard.saving;

  const runAfterPromptBodyGuard = (action: () => void) => {
    if (promptBodyGuard.saving) return;
    if (promptBodyGuard.dirty && promptBodyGuard.requestDiscard !== null) {
      promptBodyGuard.requestDiscard(action);
      return;
    }
    action();
  };

  const guardNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    path: string,
  ) => {
    if (!controlsLocked) return;
    event.preventDefault();
    runAfterPromptBodyGuard(() => navigate(path));
  };

  return (
    <section className="prompt-trail-page">
      <header className="pt-prompt-library__header">
        <div className="pt-prompt-library__header-meta">
          <h1 className="pt-page-header__title">Prompt Library</h1>
          <p className="pt-page-header__description">
            保存済みPromptを検索・改善し、新しいTrailへ再利用できます。
          </p>
        </div>
        <div className="pt-prompt-library__header-controls">
          <Link
            className="pt-button pt-button--primary"
            aria-disabled={controlsLocked}
            onClick={(event) => guardNavigation(event, routePaths.promptNew)}
            to={routePaths.promptNew}
          >
            Promptを新規登録
          </Link>
          {state.status === 'data' ? (
            <>
              <label className="pt-prompt-search">
                <span className="pt-sr-only">Promptを検索</span>
                <input
                  type="search"
                  value={query}
                  disabled={controlsLocked}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="Prompt名または本文を検索"
                />
              </label>
              <label className="pt-prompt-project-filter">
                <span className="pt-sr-only">プロジェクト</span>
                <select
                  value={projectFilter}
                  disabled={controlsLocked}
                  onChange={(event) => {
                    setProjectFilter(event.target.value as ProjectFilter);
                  }}
                >
                  <option value="all">すべてのプロジェクト</option>
                  <option value="global">Global</option>
                  <option value="project">Default Project</option>
                </select>
              </label>
              <label className="pt-prompt-tag-filter">
                <span className="pt-sr-only">タグ</span>
                <select
                  value={tagFilter}
                  disabled={controlsLocked}
                  onChange={(event) => {
                    setTagFilter(event.target.value as PromptTagFilter);
                  }}
                >
                  <option value="all">すべてのタグ</option>
                  {usedTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>
      </header>
      <PromptLibraryStateMessage state={state} />
      {state.status === 'data' ? (
        <PageSection
          title="Prompt一覧"
          actions={
            quickEditNotice !== null ? (
              <p className="pt-prompt-library__notice" role="status">
                {quickEditNotice}
              </p>
            ) : notice !== null ? (
              <p className="pt-prompt-library__notice" role="status">
                {notice === 'deleted'
                  ? 'Promptを削除しました。'
                  : `Promptを${notice === 'created' ? '登録' : '更新'}しました。`}
              </p>
            ) : undefined
          }
          titleAccessory={
            <p className="pt-prompt-library__result-count" aria-live="polite">
              {!hasConditions
                ? `全${state.data.prompts.length}件`
                : `全${state.data.prompts.length}件中 ${results.length}件`}
            </p>
          }
        >
          <div className="pt-prompt-library__result-row">
            {!hasConditions ? null : (
              <button
                className="pt-prompt-library__clear"
                type="button"
                disabled={controlsLocked}
                onClick={() => {
                  setProjectFilter('all');
                  setTagFilter('all');
                  setQuery('');
                }}
              >
                条件をクリア
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <StateMessage
              variant="empty"
              title="条件に一致するPromptがありません。"
              description="プロジェクト・タグまたは検索条件を変更してください。"
            />
          ) : (
            <div
              aria-label="Prompt一覧テーブル"
              className="pt-prompt-table-region"
              role="region"
              tabIndex={0}
            >
              <table
                className="pt-prompt-table pt-prompt-table--compact"
                aria-label="Prompt一覧"
              >
                <colgroup>
                  <col className="pt-prompt-table__column-title" />
                  <col className="pt-prompt-table__column-project" />
                  <col className="pt-prompt-table__column-tags" />
                  <col className="pt-prompt-table__column-updated-at" />
                  <col className="pt-prompt-table__column-prompt" />
                  <col className="pt-prompt-table__column-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      aria-sort={
                        sortMode === 'name-asc'
                          ? 'ascending'
                          : sortMode === 'name-desc'
                            ? 'descending'
                            : 'none'
                      }
                    >
                      <button
                        className="pt-prompt-table__sort"
                        type="button"
                        aria-label={
                          sortMode === 'updated-desc'
                            ? 'Prompt名を昇順に並べ替え'
                            : sortMode === 'name-asc'
                              ? 'Prompt名を降順に並べ替え'
                              : '更新日時降順へ戻す'
                        }
                        disabled={controlsLocked}
                        onClick={() => {
                          setSortMode((current) =>
                            current === 'updated-desc'
                              ? 'name-asc'
                              : current === 'name-asc'
                                ? 'name-desc'
                                : 'updated-desc',
                          );
                        }}
                      >
                        <span>Prompt名</span>
                        <span
                          aria-hidden="true"
                          data-sort={sortMode}
                          className="pt-prompt-table__sort-icon"
                        />
                      </button>
                    </th>
                    <th scope="col">プロジェクト</th>
                    <th scope="col">タグ</th>
                    <th
                      scope="col"
                      aria-sort={
                        sortMode === 'updated-desc' ? 'descending' : 'none'
                      }
                    >
                      更新日時
                    </th>
                    <th className="pt-prompt-table__prompt-heading" scope="col">
                      Prompt
                    </th>
                    <th className="pt-prompt-table__action-heading" scope="col">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((prompt) => (
                    <PromptTableRow
                      key={prompt.id}
                      prompt={prompt}
                      bodyOpen={openPromptId === prompt.id}
                      controlsLocked={controlsLocked}
                      onGuardedNavigate={guardNavigation}
                      onBodyToggle={() =>
                        runAfterPromptBodyGuard(() =>
                          setOpenPrompt((current) =>
                            current?.id === prompt.id
                              ? null
                              : { id: prompt.id, revision, snapshot },
                          ),
                        )
                      }
                      onBodyClose={() => setOpenPrompt(null)}
                      onBodyGuardChange={setPromptBodyGuard}
                      onBodySaved={() => {
                        setQuickEditNotice('Prompt本文を更新しました。');
                        if (openPrompt !== null) {
                          keepOpenPromptIdRef.current = openPrompt.id;
                          // Pre-advance revision so openPromptId stays truthy during
                          // the async reload, preventing a one-frame popover close.
                          setOpenPrompt({
                            ...openPrompt,
                            revision: revision + 1,
                          });
                        }
                        notifyDataChanged();
                      }}
                      onBodyReloadRequested={() => notifyDataChanged()}
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

const PROMPT_TABLE_TAG_VISIBLE_COUNT = 2;

function PromptTagList({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  const visibleTags = tags.slice(0, PROMPT_TABLE_TAG_VISIBLE_COUNT);
  const hiddenCount = tags.length - visibleTags.length;
  return (
    <span className="pt-prompt-body-popover__tags" aria-label="タグ">
      {visibleTags.map((tag) => (
        <span key={tag} className="pt-prompt-body-popover__tag-chip">
          {tag}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="pt-prompt-body-popover__tag-chip pt-prompt-table__tag-more">
          {`+${hiddenCount}`}
        </span>
      ) : null}
    </span>
  );
}

function areVariableValuesEqual(
  a: Record<string, string>,
  b: Record<string, string>,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function PromptTableRow({
  prompt,
  bodyOpen,
  controlsLocked,
  onGuardedNavigate,
  onBodyToggle,
  onBodyClose,
  onBodyGuardChange,
  onBodySaved,
  onBodyReloadRequested,
}: {
  controlsLocked: boolean;
  onGuardedNavigate: (
    event: MouseEvent<HTMLAnchorElement>,
    path: string,
  ) => void;
  prompt: PromptLibraryItem;
  bodyOpen: boolean;
  onBodyToggle: () => void;
  onBodyClose: () => void;
  onBodyGuardChange: (state: PromptBodyGuardState) => void;
  onBodySaved: () => void;
  onBodyReloadRequested: () => void;
}) {
  return (
    <tr>
      <td className="pt-prompt-table__title">
        <Link
          className="pt-prompt-table__title-link"
          aria-disabled={controlsLocked}
          onClick={(event) =>
            onGuardedNavigate(event, buildPromptEditPath(prompt.id))
          }
          to={buildPromptEditPath(prompt.id)}
          aria-label={`「${prompt.title}」を編集`}
        >
          {prompt.title}
        </Link>
      </td>
      <td className="pt-prompt-table__muted">
        {prompt.scope === 'global' ? 'Global' : 'Default Project'}
      </td>
      <td className="pt-prompt-table__tags">
        <PromptTagList tags={prompt.tags} />
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
          onGuardChange={onBodyGuardChange}
          onSaved={onBodySaved}
          onReloadRequested={onBodyReloadRequested}
        />
      </td>
      <td className="pt-prompt-table__action-cell">
        <span className="pt-prompt-trail-action-wrap">
          <Link
            className="pt-prompt-trail-action"
            aria-disabled={controlsLocked}
            onClick={(event) =>
              onGuardedNavigate(event, buildNewTrailFromPromptPath(prompt.id))
            }
            to={buildNewTrailFromPromptPath(prompt.id)}
            aria-label={`「${prompt.title}」からTrailを作成`}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M6 4v5a4 4 0 0 0 4 4h4M6 20v-3a4 4 0 0 1 4-4M14 8h6M17 5v6" />
              <circle cx="6" cy="4" r="2" />
              <circle cx="6" cy="20" r="2" />
              <path d="m15 13 3 3 3-3" />
            </svg>
          </Link>
          <span className="pt-prompt-trail-action__tooltip" role="tooltip">
            Trailを作成
          </span>
        </span>
        <TrailSearchPopover prompt={prompt} />
      </td>
    </tr>
  );
}

function TrailSearchPopover({ prompt }: { prompt: PromptLibraryItem }) {
  const repository = usePromptTrailRepository();
  const { revision } = usePromptTrailDataRevision();
  const reactId = useId();
  const panelId = `trail-search-${reactId.replaceAll(':', '')}`;
  const tooltipId = `${panelId}-tooltip`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [trailsResult, setTrailsResult] = useState<{
    readonly key: string;
    readonly items: readonly TrailListItem[];
  } | null>(null);
  const trailsKey = open ? `${prompt.id}:${revision}` : null;
  const trailsLoading = trailsKey !== null && trailsResult?.key !== trailsKey;
  const trailsItems = trailsResult?.key === trailsKey ? trailsResult.items : [];

  const scheduleUpdateRef = useRef<(() => void) | null>(null);
  const schedulePositionUpdate = useCallback(
    () => scheduleUpdateRef.current?.(),
    [],
  );

  useEffect(() => {
    if (trailsKey === null) return;
    let active = true;
    listTrailsByPromptId(repository, prompt.id, TRAIL_SEARCH_RESULT_LIMIT).then(
      (items) => {
        if (active) setTrailsResult({ key: trailsKey, items });
      },
    );
    return () => {
      active = false;
    };
  }, [prompt.id, repository, trailsKey]);

  useEffect(() => {
    if (!open) return;
    const closeAndFocus = () => {
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeAndFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeAndFocus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [open, schedulePositionUpdate]);

  return (
    <span className="pt-prompt-trail-action-wrap">
      <button
        ref={triggerRef}
        className="pt-prompt-trail-action"
        type="button"
        aria-controls={panelId}
        aria-describedby={tooltipId}
        aria-expanded={open}
        aria-label={`「${prompt.title}」から作成されたTrailを検索`}
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m20 20-4.85-4.85" />
        </svg>
      </button>
      <span
        className="pt-prompt-trail-action__tooltip"
        id={tooltipId}
        role="tooltip"
      >
        紐づくTrailを検索
      </span>
      <ResponsivePopover
        triggerRef={triggerRef}
        panelRef={panelRef}
        open={open}
        placements={TRAIL_SEARCH_POPOVER_PLACEMENTS}
        arrow={{
          varPrefix: '--pt-prompt-body-arrow',
          sizePx: TRAIL_SEARCH_POPOVER_ARROW_SIZE_PX,
          safeMarginPx: TRAIL_SEARCH_POPOVER_ARROW_SAFE_MARGIN_PX,
          className: 'pt-prompt-body-popover__arrow',
        }}
        panelClassName="pt-prompt-body-popover pt-trail-search-popover"
        panelId={panelId}
        ariaLabel={`「${prompt.title}」から作成されたTrail`}
        title="紐づくTrail"
        sheetHeader={false}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus({ preventScroll: true });
        }}
        scheduleUpdateRef={scheduleUpdateRef}
      >
        <header className="pt-prompt-body-popover__header">
          <h3>紐づくTrail</h3>
          <span className="pt-prompt-body-popover__close-wrap">
            <button
              aria-label="閉じる"
              className="pt-prompt-body-popover__close"
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
              }}
            >
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </span>
        </header>
        <div className="pt-prompt-body-popover__content">
          {trailsLoading ? (
            <p className="pt-trail-search-popover__empty">読み込み中...</p>
          ) : trailsItems.length === 0 ? (
            <p className="pt-trail-search-popover__empty">
              まだ紐づくTrailはありません
            </p>
          ) : (
            <ul className="pt-trail-search-popover__list">
              {trailsItems.map((item) => (
                <li key={item.trail.id}>
                  <Link
                    to={buildTrailDetailPath(item.trail.id)}
                    onClick={() => setOpen(false)}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            className="pt-trail-search-popover__see-all"
            to={buildTrailListByPromptPath(prompt.id)}
            onClick={() => setOpen(false)}
          >
            すべて見る
          </Link>
        </div>
      </ResponsivePopover>
    </span>
  );
}

function PromptBodyPopover({
  prompt,
  open,
  onToggle,
  onClose,
  onGuardChange,
  onSaved,
  onReloadRequested,
}: {
  prompt: PromptLibraryItem;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onGuardChange: (state: PromptBodyGuardState) => void;
  onSaved: () => void;
  onReloadRequested: () => void;
}) {
  const repository = usePromptTrailRepository();
  const navigate = useNavigate();
  const reactId = useId();
  const panelId = `prompt-body-${reactId.replaceAll(':', '')}`;
  const tooltipId = `${panelId}-tooltip`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [isTriggerFocused, setIsTriggerFocused] = useState(false);
  const [suppressFocusTooltip, setSuppressFocusTooltip] = useState(false);
  const [copyState, setCopyState] = useState<'success' | 'error' | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>(() => ({
    ...prompt.variableValues,
  }));
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const varPanelRef = useRef<HTMLDivElement>(null);
  const focusInPanelRef = useRef(false);
  const detectedVars = useMemo(
    () => extractPromptVariables(prompt.body),
    [prompt.body],
  );
  const effectiveVarPanelOpen = detectedVars.length > 0;
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState(prompt.body);
  const [baseline, setBaseline] = useState({
    body: prompt.body,
    variableValues: prompt.variableValues,
    updatedAt: prompt.updatedAt,
  });
  const [error, setError] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<PromptBodyMessageKind>(null);
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const saveTokenRef = useRef(0);
  const sessionRef = useRef(0);
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);
  const pendingDiscardClosesRef = useRef(true);
  const pendingDiscardRestoreRef = useRef<PromptBodyDiscardRestore | null>(
    null,
  );
  const reloadAfterCloseRef = useRef(false);
  const [recoveryStatus, setRecoveryStatus] =
    useState<PromptBodyRecoveryStatus>(null);

  const scheduleUpdateRef = useRef<(() => void) | null>(null);
  const schedulePositionUpdate = useCallback(
    () => scheduleUpdateRef.current?.(),
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      pendingDiscardActionRef.current = null;
      savingRef.current = false;
      return;
    }
    sessionRef.current += 1;
    resetVarPanel();
    // resetVarPanel restores varValues from the latest baseline on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt.id]);

  useEffect(() => {
    if (open || !reloadAfterCloseRef.current) return;
    reloadAfterCloseRef.current = false;
    onReloadRequested();
  }, [onReloadRequested, open]);

  useEffect(() => {
    if (open && mode === 'edit') textareaRef.current?.focus();
  }, [mode, open]);

  useEffect(() => {
    if (!(open && mode === 'edit' && draft !== baseline.body)) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [baseline.body, draft, mode, open]);

  const isDirty = open && mode === 'edit' && draft !== baseline.body;
  const requestDiscard = useCallback(
    (
      action: () => void,
      options: {
        readonly closeOnConfirm?: boolean;
        readonly restoreOnCancel?: PromptBodyDiscardRestore;
      } = {},
    ) => {
      if (savingRef.current) return false;
      if (!isDirty) {
        action();
        return true;
      }
      pendingDiscardActionRef.current = action;
      pendingDiscardClosesRef.current = options.closeOnConfirm ?? true;
      pendingDiscardRestoreRef.current = options.restoreOnCancel ?? null;
      setDiscardConfirmVisible(true);
      setMessageKind('discard');
      setError(
        '編集中のPrompt本文を破棄しますか？ 保存していない変更は失われます。',
      );
      schedulePositionUpdate();
      requestAnimationFrame(() =>
        continueEditingRef.current?.focus({ preventScroll: true }),
      );
      return false;
    },
    [isDirty, schedulePositionUpdate],
  );

  useEffect(() => {
    onGuardChange({
      dirty: isDirty,
      saving,
      requestDiscard: open ? requestDiscard : null,
    });
  }, [isDirty, onGuardChange, open, requestDiscard, saving]);

  useEffect(() => {
    return () => onGuardChange(CLEAN_PROMPT_BODY_GUARD);
  }, [onGuardChange]);

  useEffect(() => {
    if (!open) return;
    const closeAndFocus = () => {
      if (savingRef.current) return;
      if (isDirty) {
        requestDiscard(() => {
          setMode('view');
          setCopyState(null);
          setSuppressFocusTooltip(true);
          resetVarPanel();
          onClose();
          triggerRef.current?.focus({ preventScroll: true });
        });
        return;
      }
      setMode('view');
      setCopyState(null);
      setSuppressFocusTooltip(true);
      resetVarPanel();
      onClose();
      triggerRef.current?.focus({ preventScroll: true });
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeAndFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (discardConfirmVisible) {
        event.preventDefault();
        continueEditing();
        return;
      }
      closeAndFocus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
    };
    // continueEditing intentionally reads the latest pending-discard refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    discardConfirmVisible,
    isDirty,
    onClose,
    open,
    requestDiscard,
    saving,
    schedulePositionUpdate,
  ]);

  const tooltipVisible =
    !open && (isTriggerHovered || (isTriggerFocused && !suppressFocusTooltip));

  function resetVarPanel() {
    setVarValues({ ...baseline.variableValues });
  }

  useEffect(() => {
    if (!effectiveVarPanelOpen) return;
    function onFocusIn(e: FocusEvent) {
      focusInPanelRef.current = !!(
        varPanelRef.current && varPanelRef.current.contains(e.target as Node)
      );
    }
    focusInPanelRef.current = !!(
      varPanelRef.current &&
      document.activeElement &&
      varPanelRef.current.contains(document.activeElement)
    );
    document.addEventListener('focusin', onFocusIn);
    const editButton = editButtonRef.current;
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      if (focusInPanelRef.current) editButton?.focus();
      focusInPanelRef.current = false;
    };
  }, [effectiveVarPanelOpen]);

  const writeToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('success');
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopyState(null);
      }, 2000);
    } catch {
      setCopyState('error');
    }
  };

  const handleCopy = () => {
    if (detectedVars.length === 0) {
      void writeToClipboard(prompt.body);
      return;
    }
    void copyResolved();
  };

  const copyResolved = async () => {
    const prunedValues = Object.fromEntries(
      detectedVars.filter((v) => v in varValues).map((v) => [v, varValues[v]]),
    );
    const unchanged = areVariableValuesEqual(
      prunedValues,
      baseline.variableValues,
    );
    if (unchanged) {
      const resolved = resolvePromptVariables(prompt.body, prunedValues);
      setVarValues(prunedValues);
      await writeToClipboard(resolved);
      return;
    }
    const targetRepository = repository;
    const targetPromptId = prompt.id;
    try {
      const result = await updatePromptBody(targetRepository, {
        promptId: targetPromptId,
        expectedUpdatedAt: baseline.updatedAt,
        body: prompt.body,
        variableValues: prunedValues,
      });
      if (
        !mountedRef.current ||
        repository !== targetRepository ||
        prompt.id !== targetPromptId
      )
        return;
      if (result.status === 'success') {
        setBaseline({
          body: result.prompt.body,
          variableValues: result.prompt.variableValues,
          updatedAt: result.prompt.updatedAt,
        });
        onSaved();
        const resolved = resolvePromptVariables(
          prompt.body,
          result.prompt.variableValues,
        );
        setVarValues(result.prompt.variableValues);
        await writeToClipboard(resolved);
      } else {
        setCopyState('error');
      }
    } catch {
      if (!mountedRef.current) return;
      setCopyState('error');
    }
  };

  const resetSession = () => {
    pendingDiscardClosesRef.current = true;
    pendingDiscardRestoreRef.current = null;
    setMode('view');
    setDraft(baseline.body);
    setError(null);
    setMessageKind(null);
    setDiscardConfirmVisible(false);
    setRecoveryStatus(null);
    pendingDiscardActionRef.current = null;
    resetVarPanel();
  };

  const discardDraft = () => {
    resetSession();
  };

  function continueEditing() {
    const restore = pendingDiscardRestoreRef.current;
    pendingDiscardActionRef.current = null;
    pendingDiscardClosesRef.current = true;
    pendingDiscardRestoreRef.current = null;
    setDiscardConfirmVisible(false);
    if (restore !== null) {
      setError(restore.error);
      setMessageKind(restore.messageKind);
      setRecoveryStatus(restore.recoveryStatus);
    } else {
      setError(null);
      setMessageKind(null);
    }
    textareaRef.current?.focus({ preventScroll: true });
    schedulePositionUpdate();
  }

  const confirmDiscard = () => {
    const action = pendingDiscardActionRef.current;
    const closeOnConfirm = pendingDiscardClosesRef.current;
    pendingDiscardActionRef.current = null;
    pendingDiscardClosesRef.current = true;
    pendingDiscardRestoreRef.current = null;
    discardDraft();
    setCopyState(null);
    setSuppressFocusTooltip(true);
    if (closeOnConfirm) {
      onClose();
      if (action !== null) action();
      else triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (action !== null) action();
  };

  const handleCloseButton = () => {
    if (savingRef.current) return;
    if (isDirty) {
      requestDiscard(() => {
        setMode('view');
        setCopyState(null);
        setSuppressFocusTooltip(true);
        resetVarPanel();
        onClose();
        triggerRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    discardDraft();
    setCopyState(null);
    setSuppressFocusTooltip(true);
    resetVarPanel();
    onClose();
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleCancelEdit = () => {
    if (savingRef.current) return;
    requestDiscard(
      () => {
        setMode('view');
        setError(null);
        setMessageKind(null);
        resetVarPanel();
      },
      { closeOnConfirm: false },
    );
  };

  const loadLatestBody = async (replaceDraft: boolean) => {
    const latest = await repository.getPrompt(prompt.id);
    if (!mountedRef.current) return;
    if (latest === null) {
      setRecoveryStatus('not-found');
      setMessageKind('status');
      setError(
        'このPromptは見つかりません。一覧を更新して対象を選び直してください。',
      );
      reloadAfterCloseRef.current = true;
      schedulePositionUpdate();
      return;
    }
    if (latest.deletedAt !== null || latest.status !== 'active') {
      setRecoveryStatus('unavailable');
      setMessageKind('status');
      setError(
        'このPromptは編集できません。削除済みまたはActiveではないPromptです。',
      );
      reloadAfterCloseRef.current = true;
      schedulePositionUpdate();
      return;
    }
    setBaseline({
      body: latest.body,
      variableValues: latest.variableValues,
      updatedAt: latest.updatedAt,
    });
    if (replaceDraft) {
      setDraft(latest.body);
      setMode('edit');
      resetVarPanel();
    }
    setRecoveryStatus(null);
    setMessageKind('notice');
    setError(
      replaceDraft
        ? '最新のPrompt本文を読み込みました。内容を確認してから保存してください。'
        : '最新のPrompt本文を読み込みました。編集中の本文は保持しています。',
    );
    requestAnimationFrame(() =>
      textareaRef.current?.focus({ preventScroll: true }),
    );
    schedulePositionUpdate();
  };

  const handleLoadLatestBody = async () => {
    if (draft !== baseline.body) {
      requestDiscard(
        () => {
          void loadLatestBody(true);
        },
        {
          closeOnConfirm: false,
          restoreOnCancel: {
            error,
            messageKind,
            recoveryStatus,
          },
        },
      );
      return;
    }
    await loadLatestBody(true);
  };

  const handleSave = async () => {
    if (savingRef.current || recoveryStatus !== null) return;
    const validation = validatePromptBody(draft);
    if (validation !== undefined) {
      setMessageKind('validation');
      setError(validation);
      schedulePositionUpdate();
      textareaRef.current?.focus();
      return;
    }
    savingRef.current = true;
    const token = saveTokenRef.current + 1;
    saveTokenRef.current = token;
    const targetRepository = repository;
    const targetPromptId = prompt.id;
    const targetSession = sessionRef.current;
    setSaving(true);
    setMessageKind(null);
    setDiscardConfirmVisible(false);
    setError(null);
    try {
      const persistedVariableValues = Object.fromEntries(
        extractPromptVariables(draft)
          .filter((v) => v in varValues)
          .map((v) => [v, varValues[v]]),
      );
      const result = await updatePromptBody(targetRepository, {
        promptId: targetPromptId,
        expectedUpdatedAt: baseline.updatedAt,
        body: draft,
        variableValues: persistedVariableValues,
      });
      if (
        !mountedRef.current ||
        saveTokenRef.current !== token ||
        repository !== targetRepository ||
        prompt.id !== targetPromptId ||
        sessionRef.current !== targetSession
      )
        return;
      if (result.status === 'success') {
        setBaseline({
          body: result.prompt.body,
          variableValues: result.prompt.variableValues,
          updatedAt: result.prompt.updatedAt,
        });
        setRecoveryStatus(null);
        setMessageKind(null);
        setDiscardConfirmVisible(false);
        setMode('view');
        onSaved();
      } else if (result.status === 'invalid') {
        setMessageKind('validation');
        setError('Prompt本文を入力してください。');
        schedulePositionUpdate();
        textareaRef.current?.focus();
      } else if (result.status === 'stale') {
        setRecoveryStatus('stale');
        setMessageKind('status');
        setError(
          'このPromptは別の操作で更新されました。入力中の本文は保持しています。最新の本文を読み込んでから再保存してください。',
        );
        schedulePositionUpdate();
      } else if (result.status === 'not-found') {
        setRecoveryStatus('not-found');
        setMessageKind('status');
        reloadAfterCloseRef.current = true;
        setError(
          'このPromptは見つかりません。一覧を更新して対象を選び直してください。',
        );
        schedulePositionUpdate();
      } else {
        setRecoveryStatus('unavailable');
        setMessageKind('status');
        reloadAfterCloseRef.current = true;
        setError(
          'このPromptは編集できません。削除済みまたはActiveではないPromptです。',
        );
        schedulePositionUpdate();
      }
    } catch {
      if (!mountedRef.current || saveTokenRef.current !== token) return;
      setMessageKind('status');
      setError(
        '保存に失敗しました。入力内容を保持しています。再試行してください。',
      );
      schedulePositionUpdate();
    } finally {
      if (mountedRef.current && saveTokenRef.current === token) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  return (
    <>
      <span
        className="pt-prompt-body-trigger-wrap"
        onMouseEnter={() => setIsTriggerHovered(true)}
        onMouseLeave={() => setIsTriggerHovered(false)}
      >
        <button
          ref={triggerRef}
          className="pt-prompt-body-trigger"
          type="button"
          aria-controls={panelId}
          aria-describedby={tooltipId}
          aria-expanded={open}
          aria-label={`「${prompt.title}」のPrompt本文を表示`}
          onBlur={() => {
            setIsTriggerFocused(false);
            setSuppressFocusTooltip(false);
          }}
          onClick={() => {
            if (savingRef.current) return;
            setCopyState(null);
            setIsTriggerHovered(false);
            if (open) setSuppressFocusTooltip(true);
            if (open && !isDirty) resetSession();
            onToggle();
          }}
          onFocus={() => setIsTriggerFocused(true)}
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
          data-visible={tooltipVisible}
          id={tooltipId}
          role="tooltip"
        >
          Prompt本文を表示
        </span>
      </span>
      <ResponsivePopover
        triggerRef={triggerRef}
        panelRef={panelRef}
        open={open}
        placements={PROMPT_BODY_POPOVER_PLACEMENTS}
        arrow={{
          varPrefix: '--pt-prompt-body-arrow',
          sizePx: PROMPT_BODY_POPOVER_ARROW_SIZE_PX,
          safeMarginPx: PROMPT_BODY_POPOVER_ARROW_SAFE_MARGIN_PX,
          className: 'pt-prompt-body-popover__arrow',
        }}
        panelClassName="pt-prompt-body-popover"
        panelId={panelId}
        ariaLabel="Prompt本文"
        title="Prompt本文"
        sheetHeader={false}
        onClose={handleCloseButton}
        scheduleUpdateRef={scheduleUpdateRef}
      >
        <>
          <header className="pt-prompt-body-popover__header">
            <h3>Prompt本文</h3>
            <div className="pt-prompt-body-popover__header-actions">
              {mode === 'view' ? (
                <span className="pt-prompt-body-popover__edit-wrap">
                  <button
                    ref={editButtonRef}
                    aria-label={`「${prompt.title}」のPrompt本文を編集`}
                    className="pt-prompt-body-popover__edit"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setCopyState(null);
                      setError(null);
                      setMessageKind(null);
                      setDiscardConfirmVisible(false);
                      setDraft(prompt.body);
                      setBaseline({
                        body: prompt.body,
                        variableValues: prompt.variableValues,
                        updatedAt: prompt.updatedAt,
                      });
                      setMode('edit');
                      resetVarPanel();
                      schedulePositionUpdate();
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                    >
                      <path d="m4 20 4.25-1 10.5-10.5a2.12 2.12 0 0 0-3-3L5.25 16Z" />
                      <path d="m14.5 6.75 3 3M4 20h6" />
                    </svg>
                  </button>
                  <span
                    className="pt-prompt-body-popover__edit-tooltip"
                    role="tooltip"
                  >
                    Prompt本文を編集
                  </span>
                </span>
              ) : null}
              <span className="pt-prompt-body-popover__edit-wrap">
                <Link
                  aria-label={`「${prompt.title}」を編集`}
                  aria-disabled={saving}
                  className="pt-prompt-body-popover__edit"
                  onClick={(event) => {
                    if (savingRef.current) {
                      event.preventDefault();
                      return;
                    }
                    if (!isDirty) return;
                    event.preventDefault();
                    requestDiscard(() =>
                      navigate(buildPromptEditPath(prompt.id)),
                    );
                  }}
                  to={buildPromptEditPath(prompt.id)}
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                    <path d="M5 5h14M5 12h14M5 19h14" />
                  </svg>
                </Link>
                <span
                  className="pt-prompt-body-popover__edit-tooltip"
                  role="tooltip"
                >
                  Promptを編集する
                </span>
              </span>
              {mode === 'view' ? (
                <span className="pt-prompt-body-popover__copy-wrap">
                  <button
                    ref={copyButtonRef}
                    aria-label={`「${prompt.title}」のPrompt本文をコピー`}
                    aria-expanded={
                      detectedVars.length > 0
                        ? effectiveVarPanelOpen
                        : undefined
                    }
                    className="pt-prompt-body-popover__copy"
                    data-copied={copyState === 'success'}
                    type="button"
                    onClick={handleCopy}
                  >
                    <svg
                      aria-hidden="true"
                      className="pt-prompt-body-popover__copy-icon"
                      focusable="false"
                      viewBox="0 0 24 24"
                    >
                      <rect x="8" y="8" width="11" height="11" rx="2" />
                      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                    </svg>
                    <svg
                      aria-hidden="true"
                      className="pt-prompt-body-popover__copy-check"
                      focusable="false"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </button>
                  <span
                    className="pt-prompt-body-popover__copy-tooltip"
                    role="tooltip"
                  >
                    Prompt本文をコピー
                  </span>
                </span>
              ) : null}
              <span className="pt-prompt-body-popover__close-wrap">
                <button
                  aria-label="Prompt本文を閉じる"
                  className="pt-prompt-body-popover__close"
                  type="button"
                  disabled={saving}
                  onClick={handleCloseButton}
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
                <span
                  className="pt-prompt-body-popover__close-tooltip"
                  role="tooltip"
                >
                  閉じる
                </span>
              </span>
            </div>
          </header>
          <span
            aria-live="polite"
            className="pt-prompt-body-popover__copy-status"
          >
            {copyState === 'success'
              ? 'コピーしました'
              : copyState === 'error'
                ? 'コピーできませんでした'
                : null}
          </span>
          {error !== null ? (
            <div
              className="pt-prompt-body-popover__error"
              id={`${panelId}-error`}
              role="alert"
            >
              <p>{error}</p>
              {recoveryStatus === 'stale' ? (
                <div className="pt-prompt-body-popover__actions">
                  <button type="button" onClick={handleLoadLatestBody}>
                    最新の本文を読み込む
                  </button>
                </div>
              ) : null}
              {discardConfirmVisible ? (
                <div className="pt-prompt-body-popover__actions">
                  <button
                    ref={continueEditingRef}
                    type="button"
                    onClick={continueEditing}
                  >
                    編集を続ける
                  </button>
                  <button type="button" onClick={confirmDiscard}>
                    破棄する
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {mode === 'edit' ? (
            <div className="pt-prompt-body-popover__editor">
              <label htmlFor={`${panelId}-textarea`}>Prompt本文</label>
              <textarea
                ref={textareaRef}
                id={`${panelId}-textarea`}
                value={draft}
                disabled={saving}
                aria-invalid={messageKind === 'validation'}
                aria-describedby={
                  error !== null ? `${panelId}-error` : undefined
                }
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="pt-prompt-body-popover__actions">
                <button
                  type="button"
                  disabled={saving || recoveryStatus !== null}
                  onClick={handleSave}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCancelEdit}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-prompt-body-popover__content">
              {effectiveVarPanelOpen ? (
                <div
                  ref={varPanelRef}
                  className="pt-prompt-body-popover__var-panel"
                  role="dialog"
                  aria-label="変数に値を入力してコピー"
                >
                  <div className="pt-prompt-body-popover__var-panel-fields">
                    {detectedVars.map((v) => (
                      <div
                        key={v}
                        className="pt-prompt-body-popover__var-panel-field"
                      >
                        <label
                          className="pt-prompt-body-popover__var-badge"
                          htmlFor={`${panelId}-var-${v}`}
                        >{`\${${v}}`}</label>
                        <input
                          id={`${panelId}-var-${v}`}
                          type="text"
                          value={varValues[v] ?? ''}
                          onChange={(e) =>
                            setVarValues((prev) => ({
                              ...prev,
                              [v]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {prompt.tags.length > 0 ? (
                <div className="pt-prompt-body-popover__tags" aria-label="タグ">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="pt-prompt-body-popover__tag-chip"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <p>{prompt.body}</p>
            </div>
          )}
        </>
      </ResponsivePopover>
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
