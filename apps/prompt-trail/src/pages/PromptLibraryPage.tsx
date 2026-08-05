import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
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
  sortPromptLibraryItems,
  type PromptLibraryDataState,
  type PromptLibraryItem,
  type PromptSortMode,
} from '../prompt-library';
import { updatePromptBody, validatePromptBody } from '../prompt-editor';
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

const CLEAN_PROMPT_BODY_GUARD: PromptBodyGuardState = {
  dirty: false,
  saving: false,
  requestDiscard: null,
};

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
  const [sortMode, setSortMode] = useState<PromptSortMode>('updated-desc');
  const [openPrompt, setOpenPrompt] = useState<{
    id: PromptLibraryItem['id'];
    revision: number;
    snapshot: typeof snapshot;
  } | null>(null);
  const [promptBodyGuard, setPromptBodyGuard] = useState<PromptBodyGuardState>(
    CLEAN_PROMPT_BODY_GUARD,
  );
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
  const searchedPrompts = searchPromptLibraryItems(
    projectFilteredPrompts,
    query,
  );
  const results = sortPromptLibraryItems(searchedPrompts, sortMode);
  const hasConditions = projectFilter !== 'all' || query.trim() !== '';
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
      <PageHeader
        title="Prompt Library"
        description="保存済みPromptを検索・改善し、新しいTrailへ再利用できます。"
        actions={
          <Link
            className="pt-button pt-button--primary"
            aria-disabled={controlsLocked}
            onClick={(event) => guardNavigation(event, routePaths.promptNew)}
            to={routePaths.promptNew}
          >
            Promptを新規登録
          </Link>
        }
      />
      {quickEditNotice !== null ? (
        <p className="pt-success-notice" role="status">
          {quickEditNotice}
        </p>
      ) : notice !== null ? (
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
            <label className="pt-prompt-search">
              <span>Promptを検索</span>
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
                  disabled={controlsLocked}
                  onClick={() => {
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
              <table
                className="pt-prompt-table pt-prompt-table--compact"
                aria-label="Prompt一覧"
              >
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
                    <th scope="col">種別</th>
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
      </td>
    </tr>
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
  const reactId = useId();
  const panelId = `prompt-body-${reactId.replaceAll(':', '')}`;
  const tooltipId = `${panelId}-tooltip`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [isTriggerFocused, setIsTriggerFocused] = useState(false);
  const [suppressFocusTooltip, setSuppressFocusTooltip] = useState(false);
  const [copyState, setCopyState] = useState<'success' | 'error' | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState(prompt.body);
  const [baseline, setBaseline] = useState({
    body: prompt.body,
    updatedAt: prompt.updatedAt,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPositionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const saveTokenRef = useRef(0);
  const sessionRef = useRef(0);
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);
  const reloadAfterCloseRef = useRef(false);
  const [recoveryStatus, setRecoveryStatus] =
    useState<PromptBodyRecoveryStatus>(null);
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
    const arrowSize = 12;
    const arrowSafeMargin = 16;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width;
    const panelHeight = panelRect.height;
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const maxTop = Math.max(margin, window.innerHeight - panelHeight - margin);
    const sideTop = Math.max(margin, Math.min(triggerRect.top, maxTop));
    const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin);
    const bottomLeft = Math.max(margin, Math.min(triggerRect.left, maxLeft));
    const bottomTop = Math.min(
      triggerRect.bottom + gap,
      Math.max(margin, window.innerHeight - panelHeight - margin),
    );
    const clampArrow = (value: number, size: number) =>
      Math.max(
        arrowSafeMargin,
        Math.min(value, Math.max(arrowSafeMargin, size - arrowSafeMargin)),
      );
    const buildStyle = (left: number, top: number): CSSProperties =>
      ({
        left,
        top,
        '--pt-prompt-body-arrow-x': `${clampArrow(
          triggerCenterX - left,
          panelWidth,
        )}px`,
        '--pt-prompt-body-arrow-y': `${clampArrow(
          triggerCenterY - top,
          panelHeight,
        )}px`,
        '--pt-prompt-body-arrow-offset': `${arrowSize / 2}px`,
      }) as CSSProperties;
    const next =
      window.innerWidth - triggerRect.right >= panelWidth + gap
        ? {
            placement: 'right-start' as const,
            style: buildStyle(triggerRect.right + gap, sideTop),
          }
        : triggerRect.left >= panelWidth + gap
          ? {
              placement: 'left-start' as const,
              style: buildStyle(triggerRect.left - panelWidth - gap, sideTop),
            }
          : {
              placement: 'bottom-start' as const,
              style: buildStyle(bottomLeft, bottomTop),
            };
    const nextSignature = JSON.stringify(next);
    if (lastPositionRef.current === nextSignature) return;
    lastPositionRef.current = nextSignature;
    setPosition(next);
  }, []);

  const schedulePositionUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const panel = panelRef.current;
    if (panel === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => schedulePositionUpdate());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, schedulePositionUpdate, updatePosition]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current !== null)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      pendingDiscardActionRef.current = null;
      savingRef.current = false;
      return;
    }
    sessionRef.current += 1;
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
    (action: () => void) => {
      if (savingRef.current) return false;
      if (!isDirty) {
        action();
        return true;
      }
      pendingDiscardActionRef.current = action;
      setError(
        '編集中のPrompt本文を破棄しますか？ 保存していない変更は失われます。',
      );
      schedulePositionUpdate();
      textareaRef.current?.focus();
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
          onClose();
          triggerRef.current?.focus({ preventScroll: true });
        });
        return;
      }
      setMode('view');
      setCopyState(null);
      setSuppressFocusTooltip(true);
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
      if (event.key === 'Escape') closeAndFocus();
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
  }, [isDirty, requestDiscard, onClose, open, saving, schedulePositionUpdate]);

  const tooltipVisible =
    !open && (isTriggerHovered || (isTriggerFocused && !suppressFocusTooltip));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.body);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  };

  const discardDraft = () => {
    setMode('view');
    setDraft(baseline.body);
    setError(null);
    setRecoveryStatus(null);
  };

  const confirmDiscard = () => {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    discardDraft();
    setCopyState(null);
    setSuppressFocusTooltip(true);
    onClose();
    if (action !== null) action();
    else triggerRef.current?.focus({ preventScroll: true });
  };

  const handleCloseButton = () => {
    if (savingRef.current) return;
    if (isDirty) {
      requestDiscard(() => {
        setMode('view');
        setCopyState(null);
        setSuppressFocusTooltip(true);
        onClose();
        triggerRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    discardDraft();
    setCopyState(null);
    setSuppressFocusTooltip(true);
    onClose();
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleLoadLatestBody = async () => {
    const latest = await repository.getPrompt(prompt.id);
    if (!mountedRef.current) return;
    if (latest === null) {
      setRecoveryStatus('not-found');
      setError(
        'このPromptは見つかりません。一覧を更新して対象を選び直してください。',
      );
      reloadAfterCloseRef.current = true;
      schedulePositionUpdate();
      return;
    }
    if (latest.deletedAt !== null || latest.status !== 'active') {
      setRecoveryStatus('unavailable');
      setError(
        'このPromptは編集できません。削除済みまたはActiveではないPromptです。',
      );
      reloadAfterCloseRef.current = true;
      schedulePositionUpdate();
      return;
    }
    setBaseline({ body: latest.body, updatedAt: latest.updatedAt });
    setRecoveryStatus(null);
    setError(
      '最新のPrompt本文を読み込みました。編集中の本文は保持しています。',
    );
    schedulePositionUpdate();
  };

  const handleSave = async () => {
    if (savingRef.current || recoveryStatus !== null) return;
    const validation = validatePromptBody(draft);
    if (validation !== undefined) {
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
    setError(null);
    try {
      const result = await updatePromptBody(targetRepository, {
        promptId: targetPromptId,
        expectedUpdatedAt: baseline.updatedAt,
        body: draft,
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
          updatedAt: result.prompt.updatedAt,
        });
        setRecoveryStatus(null);
        setMode('view');
        onClose();
        onSaved();
        requestAnimationFrame(() =>
          triggerRef.current?.focus({ preventScroll: true }),
        );
      } else if (result.status === 'invalid') {
        setError('Prompt本文を入力してください。');
        schedulePositionUpdate();
        textareaRef.current?.focus();
      } else if (result.status === 'stale') {
        setRecoveryStatus('stale');
        setError(
          'このPromptは別の操作で更新されました。入力中の本文は保持しています。最新の本文を読み込んでから再保存してください。',
        );
        schedulePositionUpdate();
      } else if (result.status === 'not-found') {
        setRecoveryStatus('not-found');
        reloadAfterCloseRef.current = true;
        setError(
          'このPromptは見つかりません。一覧を更新して対象を選び直してください。',
        );
        schedulePositionUpdate();
      } else {
        setRecoveryStatus('unavailable');
        reloadAfterCloseRef.current = true;
        setError(
          'このPromptは編集できません。削除済みまたはActiveではないPromptです。',
        );
        schedulePositionUpdate();
      }
    } catch {
      if (!mountedRef.current || saveTokenRef.current !== token) return;
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
            setCopyState(null);
            setIsTriggerHovered(false);
            if (open) setSuppressFocusTooltip(true);
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
              <header className="pt-prompt-body-popover__header">
                <h3>Prompt本文</h3>
                <div className="pt-prompt-body-popover__header-actions">
                  <span className="pt-prompt-body-popover__edit-wrap">
                    <button
                      aria-label={`「${prompt.title}」のPrompt本文を編集`}
                      className="pt-prompt-body-popover__edit"
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setCopyState(null);
                        setError(null);
                        setDraft(prompt.body);
                        setBaseline({
                          body: prompt.body,
                          updatedAt: prompt.updatedAt,
                        });
                        setMode('edit');
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
                        requestDiscard(() => {});
                        if (isDirty) event.preventDefault();
                      }}
                      to={buildPromptEditPath(prompt.id)}
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                      >
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
                        aria-label={`「${prompt.title}」のPrompt本文をコピー`}
                        className="pt-prompt-body-popover__copy"
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
                      onClick={handleCloseButton}
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                      >
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
              <p
                aria-live="polite"
                className="pt-prompt-body-popover__copy-status"
              >
                {copyState === 'success'
                  ? 'コピーしました'
                  : copyState === 'error'
                    ? 'コピーできませんでした'
                    : null}
              </p>
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
                  {error.startsWith('編集中') ? (
                    <div className="pt-prompt-body-popover__actions">
                      <button type="button" onClick={() => setError(null)}>
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
                    aria-invalid={error !== null}
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
                      onClick={handleCloseButton}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-prompt-body-popover__content">
                  <p>{prompt.body}</p>
                </div>
              )}
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
