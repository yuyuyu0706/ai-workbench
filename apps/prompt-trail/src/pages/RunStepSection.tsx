import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link as RouterLink } from 'react-router-dom';
import { buildNewTrailReusePath } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageSection } from '../components/ui';
import {
  usePopoverPosition,
  type PopoverMeasurements,
  type PopoverPlacementOption,
} from '../components/usePopoverPosition';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { LinkId, LinkType, UtcDateTimeString } from '../domain';
import { RunStatusPin } from '../run-status';
import { executeRun } from '../run-execution/execute-run';
import {
  createRunLink,
  type SelectableLinkType,
} from '../trail-creation/create-run-link';
import type { TrailDetailRunItem } from '../trail-detail/trail-detail-read-query';
import { formatDateTime } from './date-time';

type ActivePopover = 'prompt' | 'result' | 'links' | null;

// Anchored above the trigger, left-aligned to it, speech-bubble style, so it
// opens upward and to the right instead of overflowing below the viewport.
// Falls back to opening below the trigger (still left-aligned, clamped to
// the viewport) when there isn't enough room above it — e.g. a trigger near
// the top edge.
type RunPopoverPlacement = 'above-right' | 'below-right';

function runPopoverLeft(m: PopoverMeasurements) {
  const maxLeft = Math.max(
    m.margin,
    m.viewportWidth - m.margin - m.panelWidth,
  );
  const left = m.triggerRect.right + m.gap;
  return Math.max(m.margin, Math.min(left, maxLeft));
}

const RUN_POPOVER_PLACEMENTS: readonly PopoverPlacementOption<RunPopoverPlacement>[] =
  [
    {
      id: 'above-right',
      fits: (m) => m.triggerRect.top - m.gap - m.panelHeight >= m.margin,
      place: (m) => ({
        left: runPopoverLeft(m),
        top: m.triggerRect.top - m.gap - m.panelHeight,
      }),
    },
    {
      id: 'below-right',
      fits: () => true,
      place: (m) => {
        const maxTop = Math.max(
          m.margin,
          m.viewportHeight - m.margin - m.panelHeight,
        );
        const top = Math.min(m.triggerRect.bottom + m.gap, maxTop);
        return { left: runPopoverLeft(m), top: Math.max(m.margin, top) };
      },
    },
  ];

const RUN_POPOVER_GAP_PX = 8;

function RunPopover({
  triggerRef,
  className,
  children,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { position } = usePopoverPosition({
    triggerRef,
    panelRef,
    open: true,
    placements: RUN_POPOVER_PLACEMENTS,
    gap: RUN_POPOVER_GAP_PX,
  });
  const style = useMemo<CSSProperties>(() => {
    if (position === null) return { left: 0, top: 0, visibility: 'hidden' };
    const centerX = position.triggerRect.left + position.triggerRect.width / 2;
    const arrowLeft = centerX - position.left;
    return {
      left: position.left,
      top: position.top,
      '--pt-run-popover-arrow-left': `${arrowLeft}px`,
    } as CSSProperties;
  }, [position]);
  return createPortal(
    <div
      className={
        className ? `pt-run-popover ${className}` : 'pt-run-popover'
      }
      data-placement={position?.placement}
      ref={panelRef}
      role="dialog"
      style={style}
    >
      <div className="pt-run-popover__scroll">{children}</div>
    </div>,
    document.body,
  );
}

export function RunStepSection({
  run: runItem,
  onRunChanged,
}: {
  run: TrailDetailRunItem;
  onRunChanged: () => void;
}) {
  const repository = usePromptTrailRepository();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const { run } = runItem;
  const linkInformationId = useId();
  const linkInformationRef = useRef<HTMLDivElement>(null);
  const linkInformationButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRefs = useRef(new Map<LinkId, HTMLButtonElement>());
  const [isLinkInformationOpen, setIsLinkInformationOpen] = useState(false);
  const [linksSnapshot, setLinksSnapshot] = useState({
    source: runItem.links,
    links: runItem.links,
  });
  if (linksSnapshot.source !== runItem.links) {
    setLinksSnapshot({ source: runItem.links, links: runItem.links });
  }
  const links = linksSnapshot.links;
  function setLinks(updater: (current: typeof links) => typeof links) {
    setLinksSnapshot((current) => ({
      ...current,
      links: updater(current.links),
    }));
  }
  const [formSnapshot, setFormSnapshot] = useState({
    title: '',
    url: '',
    type: '' as SelectableLinkType | '',
    status: 'idle' as 'idle' | 'submitting' | 'failure',
    error: null as 'title' | 'url' | 'type' | 'save' | null,
    successNotice: false,
  });
  const [deleteSnapshot, setDeleteSnapshot] = useState({
    linkId: null as LinkId | null,
    status: 'idle' as 'idle' | 'deleting' | 'failure',
    successNotice: false,
  });

  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const actionsCellRef = useRef<HTMLTableCellElement>(null);
  const promptButtonRef = useRef<HTMLButtonElement>(null);
  const resultButtonRef = useRef<HTMLButtonElement>(null);
  const linksButtonRef = useRef<HTMLButtonElement>(null);
  const [executeStatus, setExecuteStatus] = useState<
    'idle' | 'running' | 'failure'
  >('idle');
  const [hasNewResult, setHasNewResult] = useState(false);

  const formOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'run-detail-link-form',
  );
  const displayedFormStatus =
    formOverride === 'submitting'
      ? 'submitting'
      : formOverride === 'save-failure'
        ? 'failure'
        : formSnapshot.status;
  const deleteOverride =
    links.length > 0
      ? selectActiveDeveloperUiState(uiStateSnapshot, 'run-detail-link-delete')
      : null;
  const overrideDeleteLinkId = deleteOverride
    ? links.some((link) => link.id === deleteSnapshot.linkId)
      ? deleteSnapshot.linkId
      : links[0]?.id
    : null;

  useEffect(() => {
    if (!isLinkInformationOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!linkInformationRef.current?.contains(event.target as Node)) {
        setIsLinkInformationOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsLinkInformationOpen(false);
        linkInformationButtonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLinkInformationOpen]);

  useEffect(() => {
    if (
      deleteOverride !== null ||
      deleteSnapshot.linkId === null ||
      deleteSnapshot.status === 'deleting'
    )
      return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || deleteSnapshot.linkId === null) return;
      const button = deleteButtonRefs.current.get(deleteSnapshot.linkId);
      setDeleteSnapshot({ linkId: null, status: 'idle', successNotice: false });
      requestAnimationFrame(() => button?.focus());
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteOverride, deleteSnapshot.linkId, deleteSnapshot.status]);

  useEffect(() => {
    if (activePopover === null) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideActionsCell = actionsCellRef.current?.contains(target);
      const isInsidePortaledPopover =
        target instanceof Element && target.closest('.pt-run-popover');
      if (!isInsideActionsCell && !isInsidePortaledPopover) {
        setActivePopover(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        !isLinkInformationOpen &&
        deleteSnapshot.linkId === null
      ) {
        setActivePopover(null);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePopover, isLinkInformationOpen, deleteSnapshot.linkId]);

  function togglePopover(popover: Exclude<ActivePopover, null>) {
    setActivePopover((current) => (current === popover ? null : popover));
    if (popover === 'result') setHasNewResult(false);
  }

  function cancelDelete(linkId: LinkId) {
    if (deleteOverride !== null) return;
    const button = deleteButtonRefs.current.get(linkId);
    setDeleteSnapshot({ linkId: null, status: 'idle', successNotice: false });
    requestAnimationFrame(() => button?.focus());
  }

  async function deleteLink(linkId: LinkId) {
    if (deleteOverride !== null || deleteSnapshot.status === 'deleting') return;
    setDeleteSnapshot({ linkId, status: 'deleting', successNotice: false });
    try {
      await repository.softDeleteLink(
        run.id,
        linkId,
        new Date().toISOString() as UtcDateTimeString,
      );
      setLinks((current) => current.filter((link) => link.id !== linkId));
      setDeleteSnapshot((current) =>
        current.linkId === linkId && current.status === 'deleting'
          ? { linkId: null, status: 'idle', successNotice: true }
          : current,
      );
      onRunChanged();
    } catch {
      setDeleteSnapshot((current) =>
        current.linkId === linkId && current.status === 'deleting'
          ? { ...current, status: 'failure', successNotice: false }
          : current,
      );
    }
  }

  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (formOverride !== null || formSnapshot.status === 'submitting') return;
    const title = formSnapshot.title.trim();
    if (title.length === 0) {
      setFormSnapshot({
        ...formSnapshot,
        status: 'failure',
        error: 'title',
        successNotice: false,
      });
      return;
    }
    let url: string;
    try {
      const parsed = new URL(formSnapshot.url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      url = parsed.toString();
    } catch {
      setFormSnapshot((current) => ({
        ...current,
        status: 'failure',
        error: 'url',
        successNotice: false,
      }));
      return;
    }
    if (formSnapshot.type === '') {
      setFormSnapshot({
        ...formSnapshot,
        status: 'failure',
        error: 'type',
        successNotice: false,
      });
      return;
    }
    setFormSnapshot((current) => ({
      ...current,
      status: 'submitting',
      error: null,
      successNotice: false,
    }));
    try {
      const link = await repository.saveLink(
        createRunLink({
          runId: run.id,
          title,
          url,
          type: formSnapshot.type,
        }),
      );
      setLinks((current) => [...current, link]);
      setFormSnapshot({
        title: '',
        url: '',
        type: '',
        status: 'idle',
        error: null,
        successNotice: true,
      });
      onRunChanged();
    } catch {
      setFormSnapshot((current) => ({
        ...current,
        status: 'failure',
        error: 'save',
        successNotice: false,
      }));
    }
  }

  async function handleExecute() {
    if (executeStatus === 'running') return;
    setExecuteStatus('running');
    try {
      await executeRun(repository, run);
      setExecuteStatus('idle');
      setHasNewResult(true);
      onRunChanged();
    } catch {
      setExecuteStatus('failure');
    }
  }

  return (
    <>
      <PageSection title="実行サマリ">
        {run.contextSnapshots.length > 0 ? (
          <div className="pt-run-context-snapshots">
            {run.contextSnapshots.map((context) => (
              <article key={context.contextId}>
                <h3>{context.title}</h3>
                <pre className="pt-snapshot">{context.body}</pre>
              </article>
            ))}
          </div>
        ) : null}
        <div className="pt-run-table-wrapper">
          <table className="pt-run-table">
            <thead>
              <tr>
                <th scope="col">Prompt</th>
                <th scope="col">ステータス</th>
                <th scope="col">最終実行</th>
                <th scope="col">アクション</th>
              </tr>
            </thead>
            <tbody>
              <tr className="pt-run-table__row">
                <td className="pt-run-table__prompt">
                  <span className="pt-run-table__mobile-label">Prompt</span>
                  <span>{run.promptSnapshot.title}</span>
                </td>
                <td className="pt-run-table__status">
                  <span className="pt-run-table__mobile-label">ステータス</span>
                  <RunStatusPin status={run.status} />
                </td>
                <td className="pt-run-table__last-run">
                  <span className="pt-run-table__mobile-label">最終実行</span>
                  <time dateTime={run.updatedAt}>
                    {formatDateTime(run.updatedAt, { includeSeconds: true })}
                  </time>
                </td>
                <td className="pt-run-table__actions" ref={actionsCellRef}>
                  <span className="pt-run-table__mobile-label">アクション</span>
                  <div className="pt-run-actions">
                    <button
                      type="button"
                      className="pt-run-actions__execute"
                      aria-label="実行する"
                      disabled={executeStatus === 'running'}
                      onClick={() => void handleExecute()}
                    >
                      {executeStatus === 'running' ? (
                        <span
                          className="pt-run-actions__spinner"
                          aria-hidden="true"
                        />
                      ) : (
                        <PlayIcon />
                      )}
                    </button>
                    <span
                      className="pt-run-actions__divider"
                      aria-hidden="true"
                    />
                    <span className="pt-run-action">
                      <button
                        ref={promptButtonRef}
                        type="button"
                        className="pt-run-actions__icon-button ti-file-text"
                        aria-label="Prompt Snapshotを表示"
                        aria-expanded={activePopover === 'prompt'}
                        onClick={() => togglePopover('prompt')}
                      >
                        <FileTextIcon />
                      </button>
                      {activePopover === 'prompt' ? (
                        <RunPopover triggerRef={promptButtonRef}>
                          <div className="pt-run-popover__header">
                            <h3>Prompt Snapshot</h3>
                            <div className="pt-run-popover__header-actions">
                              <RouterLink
                                className="pt-button pt-button--secondary"
                                to={buildNewTrailReusePath(run.id)}
                              >
                                このPromptを再利用
                              </RouterLink>
                              <button
                                type="button"
                                className="pt-run-popover__close"
                                aria-label="閉じる"
                                onClick={() => setActivePopover(null)}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <h4>{run.promptSnapshot.title}</h4>
                          <pre className="pt-snapshot">
                            {run.promptSnapshot.body}
                          </pre>
                        </RunPopover>
                      ) : null}
                    </span>
                    <span className="pt-run-action">
                      <button
                        ref={resultButtonRef}
                        type="button"
                        className="pt-run-actions__icon-button ti-clock"
                        aria-label="実行結果を表示"
                        aria-expanded={activePopover === 'result'}
                        onClick={() => togglePopover('result')}
                      >
                        <ClockIcon />
                        {hasNewResult ? (
                          <span
                            className="pt-run-actions__badge-dot"
                            aria-label="新しい実行結果があります"
                          />
                        ) : null}
                      </button>
                      {activePopover === 'result' ? (
                        <RunPopover triggerRef={resultButtonRef}>
                          <div className="pt-run-popover__header">
                            <h3>実行結果</h3>
                            <button
                              type="button"
                              className="pt-run-popover__close"
                              aria-label="閉じる"
                              onClick={() => setActivePopover(null)}
                            >
                              ×
                            </button>
                          </div>
                          {executeStatus === 'failure' ? (
                            <p className="pt-form__error" role="alert">
                              実行に失敗しました。もう一度お試しください。
                            </p>
                          ) : null}
                          {run.output === null ? (
                            <p className="pt-run-popover__empty">
                              まだ実行されていません
                            </p>
                          ) : (
                            <pre className="pt-snapshot">{run.output}</pre>
                          )}
                        </RunPopover>
                      ) : null}
                    </span>
                    <span className="pt-run-action">
                      <button
                        ref={linksButtonRef}
                        type="button"
                        className="pt-run-actions__icon-button ti-link"
                        aria-label="関連リンクを表示"
                        aria-expanded={activePopover === 'links'}
                        onClick={() => togglePopover('links')}
                      >
                        <LinkIcon />
                        {links.length > 0 ? (
                          <span className="pt-run-actions__badge-count">
                            {links.length}
                          </span>
                        ) : null}
                      </button>
                      {activePopover === 'links' ? (
                        <RunPopover
                          triggerRef={linksButtonRef}
                          className="pt-run-popover--links"
                        >
                          <div className="pt-run-popover__header">
                            <h3>関連リンク</h3>
                            <div
                              className="pt-run-link-information"
                              ref={linkInformationRef}
                            >
                              <button
                                ref={linkInformationButtonRef}
                                className="pt-run-link-information__button"
                                type="button"
                                aria-label="関連リンクについて"
                                aria-expanded={isLinkInformationOpen}
                                aria-controls={linkInformationId}
                                onClick={() =>
                                  setIsLinkInformationOpen((open) => !open)
                                }
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 11v6M12 7.5v.5" />
                                </svg>
                              </button>
                              {isLinkInformationOpen ? (
                                <p
                                  className="pt-run-link-information__popover"
                                  id={linkInformationId}
                                >
                                  この作業で参照したChat・Issue・PR・Documentや、作成した成果物のURLを登録できます。
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="pt-run-popover__close"
                              aria-label="閉じる"
                              onClick={() => setActivePopover(null)}
                            >
                              ×
                            </button>
                          </div>
                          <form className="pt-form" onSubmit={saveLink}>
                            <label htmlFor={`link-title-${run.id}`}>
                              Link名称
                            </label>
                            <input
                              id={`link-title-${run.id}`}
                              value={formSnapshot.title}
                              onChange={(e) =>
                                setFormSnapshot({
                                  ...formSnapshot,
                                  title: e.target.value,
                                  status: 'idle',
                                  error: null,
                                  successNotice: false,
                                })
                              }
                              disabled={displayedFormStatus === 'submitting'}
                            />
                            <label htmlFor={`link-url-${run.id}`}>URL</label>
                            <input
                              id={`link-url-${run.id}`}
                              type="url"
                              value={formSnapshot.url}
                              onChange={(e) =>
                                setFormSnapshot({
                                  ...formSnapshot,
                                  url: e.target.value,
                                  status: 'idle',
                                  error: null,
                                  successNotice: false,
                                })
                              }
                              disabled={displayedFormStatus === 'submitting'}
                            />
                            <label htmlFor={`link-type-${run.id}`}>
                              Link種別
                            </label>
                            <select
                              id={`link-type-${run.id}`}
                              value={formSnapshot.type}
                              onChange={(e) =>
                                setFormSnapshot({
                                  ...formSnapshot,
                                  type: e.target
                                    .value as typeof formSnapshot.type,
                                  status: 'idle',
                                  error: null,
                                  successNotice: false,
                                })
                              }
                              disabled={displayedFormStatus === 'submitting'}
                            >
                              <option value="">選択してください</option>
                              {SELECTABLE_LINK_TYPES.map((value) => (
                                <option key={value} value={value}>
                                  {LINK_TYPE_LABELS[value]}
                                </option>
                              ))}
                            </select>
                            {displayedFormStatus === 'failure' ? (
                              <p className="pt-form__error">
                                {formOverride === 'save-failure'
                                  ? 'Linkを保存できませんでした。入力内容を保持しています。もう一度お試しください。'
                                  : formSnapshot.error === 'title'
                                    ? 'Link名称を入力してください。'
                                    : formSnapshot.error === 'type'
                                      ? 'Link種別を選択してください。'
                                      : formSnapshot.error === 'url'
                                        ? 'http または https のURLを入力してください。'
                                        : 'Linkを保存できませんでした。入力内容を保持しています。もう一度お試しください。'}
                              </p>
                            ) : null}
                            {formOverride === null &&
                            formSnapshot.successNotice ? (
                              <p className="pt-success-notice" role="status">
                                関連リンクを登録しました。
                              </p>
                            ) : null}
                            <button
                              className="pt-button pt-button--primary pt-run-link-submit"
                              disabled={displayedFormStatus === 'submitting'}
                            >
                              {displayedFormStatus === 'submitting'
                                ? '保存中...'
                                : '関連リンクを登録'}
                            </button>
                          </form>
                          {links.length > 0 ? (
                            <ul className="pt-link-list">
                              {links.map((link) => {
                                const label = link.title?.trim() || link.url;
                                const isConfirming = deleteOverride
                                  ? overrideDeleteLinkId === link.id
                                  : deleteSnapshot.linkId === link.id;
                                const displayedDeleteStatus =
                                  deleteOverride &&
                                  overrideDeleteLinkId === link.id
                                    ? deleteOverride === 'confirming'
                                      ? 'idle'
                                      : deleteOverride === 'deleting'
                                        ? 'deleting'
                                        : 'failure'
                                    : deleteSnapshot.status;
                                return (
                                  <li key={link.id} className="pt-run-link-row">
                                    <div className="pt-run-link-row__content">
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {label}
                                      </a>
                                      {link.title?.trim() ? (
                                        <span className="pt-link-list__url">
                                          {link.url}
                                        </span>
                                      ) : null}
                                      <span>
                                        {LINK_TYPE_LABELS[link.type]} /{' '}
                                        {link.createdAt}
                                      </span>
                                    </div>
                                    <button
                                      ref={(node) => {
                                        if (node)
                                          deleteButtonRefs.current.set(
                                            link.id,
                                            node,
                                          );
                                        else
                                          deleteButtonRefs.current.delete(
                                            link.id,
                                          );
                                      }}
                                      className="pt-run-link-row__delete"
                                      type="button"
                                      aria-label={`${label}を削除`}
                                      onClick={() => {
                                        if (deleteOverride !== null) return;
                                        if (
                                          deleteSnapshot.status === 'deleting'
                                        )
                                          return;
                                        setDeleteSnapshot({
                                          linkId: link.id,
                                          status: 'idle',
                                          successNotice: false,
                                        });
                                      }}
                                      disabled={
                                        deleteOverride !== null ||
                                        displayedDeleteStatus === 'deleting'
                                      }
                                    >
                                      削除
                                    </button>
                                    {isConfirming ? (
                                      <div className="pt-run-link-confirmation">
                                        <p>「{label}」を削除しますか？</p>
                                        {displayedDeleteStatus === 'failure' ? (
                                          <p className="pt-form__error">
                                            関連リンクを削除できませんでした。もう一度お試しください。
                                          </p>
                                        ) : null}
                                        <div className="pt-run-link-confirmation__actions">
                                          <button
                                            className="pt-button pt-button--primary"
                                            type="button"
                                            disabled={
                                              displayedDeleteStatus ===
                                              'deleting'
                                            }
                                            onClick={() =>
                                              void deleteLink(link.id)
                                            }
                                          >
                                            {displayedDeleteStatus ===
                                            'deleting'
                                              ? '削除中...'
                                              : '削除する'}
                                          </button>
                                          <button
                                            className="pt-button pt-button--secondary"
                                            type="button"
                                            disabled={
                                              displayedDeleteStatus ===
                                              'deleting'
                                            }
                                            onClick={() =>
                                              cancelDelete(link.id)
                                            }
                                          >
                                            キャンセル
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                          {deleteOverride === null &&
                          deleteSnapshot.successNotice ? (
                            <p className="pt-success-notice" role="status">
                              関連リンクを削除しました。
                            </p>
                          ) : null}
                        </RunPopover>
                      ) : null}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </PageSection>
    </>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4M8 13h8M8 16.5h8M8 9.5h3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5" />
      <path d="M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5" />
    </svg>
  );
}

const SELECTABLE_LINK_TYPES: readonly SelectableLinkType[] = [
  'chat',
  'issue',
  'pull-request',
  'commit',
  'release',
  'document',
];

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  chat: 'Chat',
  issue: 'Issue',
  'pull-request': 'Pull Request',
  commit: 'Commit',
  release: 'Release',
  document: 'Document',
  external: 'その他',
};
