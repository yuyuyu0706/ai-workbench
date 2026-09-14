import { useEffect, useId, useRef, useState } from 'react';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { Link, LinkId, UtcDateTimeString } from '../domain';
import { RunStatusPin } from '../run-status';
import { executeRun } from '../run-execution/execute-run';
import {
  createRunLink,
  type SelectableLinkType,
} from '../trail-creation/create-run-link';
import type { TrailDetailStepItem } from '../trail-detail/trail-detail-read-query';
import { formatDateTime } from './date-time';
import { RunPopover, RUN_POPOVER_WIDE_HORIZONTAL_OFFSET_PX } from './RunPopover';
import { PromptPanel } from './run-panels/PromptPanel';
import { RunResultPanel } from './run-panels/RunResultPanel';
import { RunLinksPanel } from './run-panels/RunLinksPanel';

type ActivePopover = 'prompt' | 'result' | 'links' | null;

const EMPTY_LINKS: readonly Link[] = [];

export function TrailStepRow({
  stepItem,
  onChanged,
}: {
  stepItem: TrailDetailStepItem;
  onChanged: () => void;
}) {
  const repository = usePromptTrailRepository();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const { step, prompt } = stepItem;
  // Current implementation never produces more than one Run per Step; the
  // most recently updated Run (index 0, since `runs` is sorted `updatedAt`
  // descending) is the one displayed. See issue #337 5.2/申し送り.
  const run = stepItem.runs[0] ?? null;

  const linkInformationId = useId();
  const linkInformationRef = useRef<HTMLDivElement>(null);
  const linkInformationButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRefs = useRef(new Map<LinkId, HTMLButtonElement>());
  const [isLinkInformationOpen, setIsLinkInformationOpen] = useState(false);
  const runLinks = run?.links ?? EMPTY_LINKS;
  const [linksSnapshot, setLinksSnapshot] = useState({
    source: runLinks,
    links: runLinks,
  });
  if (linksSnapshot.source !== runLinks) {
    setLinksSnapshot({ source: runLinks, links: runLinks });
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
  const executeButtonRef = useRef<HTMLButtonElement>(null);
  const [resetStatus, setResetStatus] = useState<
    'idle' | 'confirming' | 'resetting' | 'failure'
  >('idle');
  const [messageDraft, setMessageDraft] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'failure'>(
    'idle',
  );
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = messageTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [messageDraft]);

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
      : (links[0]?.id ?? null)
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
        target instanceof Element && target.closest('.pt-responsive-popover');
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

  useEffect(() => {
    if (resetStatus === 'idle' || resetStatus === 'resetting') return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setResetStatus('idle');
      requestAnimationFrame(() => executeButtonRef.current?.focus());
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [resetStatus]);

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
    if (!run) return;
    if (deleteOverride !== null || deleteSnapshot.status === 'deleting') return;
    setDeleteSnapshot({ linkId, status: 'deleting', successNotice: false });
    try {
      await repository.softDeleteLink(
        run.run.id,
        linkId,
        new Date().toISOString() as UtcDateTimeString,
      );
      setLinks((current) => current.filter((link) => link.id !== linkId));
      setDeleteSnapshot((current) =>
        current.linkId === linkId && current.status === 'deleting'
          ? { linkId: null, status: 'idle', successNotice: true }
          : current,
      );
      onChanged();
    } catch {
      setDeleteSnapshot((current) =>
        current.linkId === linkId && current.status === 'deleting'
          ? { ...current, status: 'failure', successNotice: false }
          : current,
      );
    }
  }

  function startDelete(linkId: LinkId) {
    if (deleteOverride !== null) return;
    if (deleteSnapshot.status === 'deleting') return;
    setDeleteSnapshot({ linkId, status: 'idle', successNotice: false });
  }

  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (!run) return;
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
          runId: run.run.id,
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
      onChanged();
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
    if (!run) return;
    if (executeStatus === 'running') return;
    setExecuteStatus('running');
    try {
      await executeRun(repository, run.run);
      setExecuteStatus('idle');
      setHasNewResult(true);
      onChanged();
    } catch {
      setExecuteStatus('failure');
    }
  }

  function handleExecuteButtonClick() {
    if (!run) return;
    if (run.run.messages.length === 0) {
      void handleExecute();
      return;
    }
    setResetStatus('confirming');
  }

  function cancelReset() {
    setResetStatus('idle');
    requestAnimationFrame(() => executeButtonRef.current?.focus());
  }

  async function confirmReset() {
    if (!run) return;
    if (resetStatus === 'resetting' || executeStatus === 'running') return;
    setResetStatus('resetting');
    setExecuteStatus('running');
    try {
      const resetRun = await repository.saveRun({
        ...run.run,
        messages: [],
        output: null,
      });
      await executeRun(repository, resetRun);
      setResetStatus('idle');
      setExecuteStatus('idle');
      setHasNewResult(true);
      onChanged();
    } catch {
      setResetStatus('failure');
      setExecuteStatus('failure');
    }
  }

  async function handleSendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!run) return;
    if (sendStatus === 'sending') return;
    const text = messageDraft.trim();
    if (text.length === 0) return;
    setSendStatus('sending');
    try {
      await executeRun(repository, run.run, text);
      setMessageDraft('');
      setSendStatus('idle');
      setHasNewResult(true);
      onChanged();
    } catch {
      setSendStatus('failure');
    }
  }

  const promptName =
    step.kind === 'manual'
      ? '人手の工程'
      : prompt === null || prompt.deletedAt !== null
        ? '削除済みのPrompt'
        : prompt.title;

  return (
    <>
      {run !== null && run.run.contextSnapshots.length > 0 ? (
        <tr className="pt-run-table__row pt-run-table__row--context">
          <td colSpan={4}>
            <div className="pt-run-context-snapshots">
              {run.run.contextSnapshots.map((context) => (
                <article key={context.contextId}>
                  <h3>{context.title}</h3>
                  <pre className="pt-snapshot">{context.body}</pre>
                </article>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
      <tr className="pt-run-table__row">
        <td className="pt-run-table__prompt">
          <span className="pt-run-table__mobile-label">Step</span>
          <span>
            {step.order}. {step.title}
          </span>
          <span className="pt-run-table__prompt-secondary">{promptName}</span>
        </td>
        <td className="pt-run-table__status">
          <span className="pt-run-table__mobile-label">ステータス</span>
          {run !== null ? (
            <RunStatusPin status={run.run.status} />
          ) : (
            <span>未実行</span>
          )}
        </td>
        <td className="pt-run-table__last-run">
          <span className="pt-run-table__mobile-label">最終実行</span>
          {run !== null ? (
            <time dateTime={run.run.updatedAt}>
              {formatDateTime(run.run.updatedAt, { includeSeconds: true })}
            </time>
          ) : (
            <span>—</span>
          )}
        </td>
        <td className="pt-run-table__actions" ref={actionsCellRef}>
          <span className="pt-run-table__mobile-label">アクション</span>
          {run !== null ? (
            <div className="pt-run-actions">
              <span className="pt-run-action">
                <button
                  ref={executeButtonRef}
                  type="button"
                  className={
                    run.run.messages.length > 0
                      ? 'pt-run-actions__execute pt-run-actions__execute--icon-stroke ti-rotate'
                      : 'pt-run-actions__execute ti-player-play'
                  }
                  aria-label={run.run.messages.length > 0 ? 'やり直す' : '実行する'}
                  disabled={executeStatus === 'running'}
                  onClick={handleExecuteButtonClick}
                >
                  {executeStatus === 'running' ? (
                    <span className="pt-run-actions__spinner" aria-hidden="true" />
                  ) : run.run.messages.length > 0 ? (
                    <RefreshIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>
                {resetStatus !== 'idle' ? (
                  <RunPopover
                    triggerRef={executeButtonRef}
                    title="実行を確認"
                    onClose={cancelReset}
                  >
                    <p className="pt-run-popover__confirm-message">
                      会話をリセットして最初から実行しますか？
                    </p>
                    {resetStatus === 'failure' ? (
                      <p className="pt-form__error" role="alert">
                        実行をやり直せませんでした。もう一度お試しください。
                      </p>
                    ) : null}
                    <div className="pt-run-execute-confirmation__actions">
                      <button
                        className="pt-button pt-button--primary"
                        type="button"
                        disabled={resetStatus === 'resetting'}
                        onClick={() => void confirmReset()}
                      >
                        {resetStatus === 'resetting' ? '実行中...' : '実行する'}
                      </button>
                      <button
                        className="pt-button pt-button--secondary"
                        type="button"
                        disabled={resetStatus === 'resetting'}
                        onClick={cancelReset}
                      >
                        キャンセル
                      </button>
                    </div>
                  </RunPopover>
                ) : null}
              </span>
              <span className="pt-run-actions__divider" aria-hidden="true" />
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
                  <RunPopover
                    triggerRef={promptButtonRef}
                    title="Prompt Snapshot"
                    sheetHeader={false}
                    onClose={() => setActivePopover(null)}
                  >
                    <PromptPanel
                      heading="Prompt Snapshot"
                      title={run.run.promptSnapshot.title}
                      body={run.run.promptSnapshot.body}
                      reuseRunId={run.run.id}
                      onClose={() => setActivePopover(null)}
                    />
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
                  <RunPopover
                    triggerRef={resultButtonRef}
                    className="pt-run-popover--wide"
                    horizontalOffsetPx={RUN_POPOVER_WIDE_HORIZONTAL_OFFSET_PX}
                    title="実行結果"
                    sheetHeader={false}
                    onClose={() => setActivePopover(null)}
                  >
                    <RunResultPanel
                      run={run.run}
                      executeStatus={executeStatus}
                      sendStatus={sendStatus}
                      messageDraft={messageDraft}
                      onMessageDraftChange={(value) => {
                        setMessageDraft(value);
                        if (sendStatus === 'failure') setSendStatus('idle');
                      }}
                      onSendMessage={(event) => void handleSendMessage(event)}
                      messageTextareaRef={messageTextareaRef}
                      onClose={() => setActivePopover(null)}
                    />
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
                    title="関連リンク"
                    sheetHeader={false}
                    onClose={() => setActivePopover(null)}
                  >
                    <RunLinksPanel
                      runId={run.run.id}
                      links={links}
                      isLinkInformationOpen={isLinkInformationOpen}
                      onToggleLinkInformation={() =>
                        setIsLinkInformationOpen((open) => !open)
                      }
                      linkInformationId={linkInformationId}
                      linkInformationRef={linkInformationRef}
                      linkInformationButtonRef={linkInformationButtonRef}
                      formSnapshot={formSnapshot}
                      displayedFormStatus={displayedFormStatus}
                      formOverride={formOverride}
                      onFormFieldChange={(field, value) =>
                        setFormSnapshot({
                          ...formSnapshot,
                          [field]: value,
                          status: 'idle',
                          error: null,
                          successNotice: false,
                        })
                      }
                      onSaveLink={(event) => void saveLink(event)}
                      deleteButtonRefs={deleteButtonRefs}
                      deleteSnapshot={deleteSnapshot}
                      deleteOverride={deleteOverride}
                      overrideDeleteLinkId={overrideDeleteLinkId}
                      onStartDelete={startDelete}
                      onCancelDelete={cancelDelete}
                      onConfirmDelete={(linkId) => void deleteLink(linkId)}
                      onClose={() => setActivePopover(null)}
                    />
                  </RunPopover>
                ) : null}
              </span>
            </div>
          ) : step.kind === 'prompt' ? (
            <div className="pt-run-actions">
              <span className="pt-run-action">
                <button
                  ref={promptButtonRef}
                  type="button"
                  className="pt-run-actions__icon-button ti-file-text"
                  aria-label="Promptを表示"
                  aria-expanded={activePopover === 'prompt'}
                  onClick={() => togglePopover('prompt')}
                  disabled={prompt === null}
                >
                  <FileTextIcon />
                </button>
                {activePopover === 'prompt' && prompt !== null ? (
                  <RunPopover
                    triggerRef={promptButtonRef}
                    title="Prompt"
                    sheetHeader={false}
                    onClose={() => setActivePopover(null)}
                  >
                    <PromptPanel
                      heading="Prompt"
                      title={prompt.title}
                      body={prompt.body}
                      onClose={() => setActivePopover(null)}
                    />
                  </RunPopover>
                ) : null}
              </span>
            </div>
          ) : null}
        </td>
      </tr>
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

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6.5 6.5A8 8 0 1 1 4 12" />
      <path d="M4 5.5v4.5h4.5" />
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
