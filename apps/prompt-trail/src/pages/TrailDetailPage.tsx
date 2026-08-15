import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { buildNewTrailReusePath, routePaths } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type {
  Link as TrailLink,
  LinkId,
  LinkType,
  TrailKind,
  UtcDateTimeString,
} from '../domain';
import { TRAIL_KINDS } from '../domain';
import {
  createRunLink,
  type SelectableLinkType,
} from '../trail-creation/create-run-link';
import {
  loadTrailDetailDataState,
  type TrailDetailDataState,
} from '../trail-detail/trail-detail-data-state';
import { formatDateTime } from './date-time';
import { updateRunTrailMetadata } from '../trail-detail/update-trail-metadata';
import {
  normalizeTrailTitle,
  TRAIL_KIND_LABELS,
  TRAIL_TITLE_MAX_LENGTH,
  validateTrailMetadata,
} from '../trail-metadata';
export function TrailDetailPage() {
  const repository = usePromptTrailRepository();
  const { trailId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const { notifyDataChanged } = usePromptTrailDataRevision();
  const metadataInputRef = useRef<HTMLInputElement>(null);
  const metadataEditButtonRef = useRef<HTMLButtonElement>(null);
  const metadataReloadButtonRef = useRef<HTMLButtonElement>(null);
  const metadataErrorId = useId();
  const activeIdentityRef = useRef({ repository, trailId, mounted: true });
  const metadataSubmissionRef = useRef<symbol | null>(null);
  const metadataReloadRef = useRef<symbol | null>(null);
  const linkInformationId = useId();
  const linkInformationRef = useRef<HTMLDivElement>(null);
  const linkInformationButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRefs = useRef(new Map<LinkId, HTMLButtonElement>());
  const [isLinkInformationOpen, setIsLinkInformationOpen] = useState(false);
  const trailCreated =
    (location.state as { trailCreated?: boolean } | null)?.trailCreated ===
    true;
  const [createdNoticeRunId] = useState(trailCreated ? trailId : null);
  const [snapshot, setSnapshot] = useState<{
    repository: typeof repository;
    trailId: string;
    state: TrailDetailDataState | { status: 'loading' };
    links: readonly TrailLink[];
  }>({ repository, trailId, state: { status: 'loading' }, links: [] });
  const [formSnapshot, setFormSnapshot] = useState({
    repository,
    trailId,
    title: '',
    url: '',
    type: '' as SelectableLinkType | '',
    status: 'idle' as 'idle' | 'submitting' | 'failure',
    error: null as 'title' | 'url' | 'type' | 'save' | null,
    successNotice: false,
  });
  const [deleteSnapshot, setDeleteSnapshot] = useState({
    repository,
    trailId,
    linkId: null as LinkId | null,
    status: 'idle' as 'idle' | 'deleting' | 'failure',
    successNotice: false,
  });
  const [metadataSnapshot, setMetadataSnapshot] = useState({
    repository,
    trailId,
    trailTitle: '',
    trailKind: 'other' as TrailKind,
    expectedUpdatedAt: '' as UtcDateTimeString,
    status: 'view' as 'view' | 'editing' | 'submitting' | 'failure' | 'stale',
    validationErrors: [] as readonly string[],
    successNotice: false,
  });
  const isCurrent =
    snapshot.repository === repository && snapshot.trailId === trailId;
  const state = isCurrent ? snapshot.state : ({ status: 'loading' } as const);
  const links = isCurrent ? snapshot.links : [];
  const form =
    formSnapshot.repository === repository && formSnapshot.trailId === trailId
      ? formSnapshot
      : {
          repository,
          trailId,
          title: '',
          url: '',
          type: '' as const,
          status: 'idle' as const,
          error: null,
          successNotice: false,
        };
  const deletion =
    deleteSnapshot.repository === repository &&
    deleteSnapshot.trailId === trailId
      ? deleteSnapshot
      : {
          repository,
          trailId,
          linkId: null,
          status: 'idle' as const,
          successNotice: false,
        };
  const metadata =
    metadataSnapshot.repository === repository &&
    metadataSnapshot.trailId === trailId
      ? metadataSnapshot
      : { ...metadataSnapshot, repository, trailId, status: 'view' as const };
  const pageOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'run-detail-page',
  );
  const displayedState: typeof state = pageOverride
    ? { status: pageOverride }
    : state;
  const formOverride =
    state.status === 'data'
      ? selectActiveDeveloperUiState(uiStateSnapshot, 'run-detail-link-form')
      : null;
  const displayedFormStatus =
    formOverride === 'submitting'
      ? 'submitting'
      : formOverride === 'save-failure'
        ? 'failure'
        : form.status;
  const metadataOverride =
    state.status === 'data'
      ? selectActiveDeveloperUiState(
          uiStateSnapshot,
          'run-detail-trail-metadata',
        )
      : null;
  const displayedMetadataStatus =
    metadataOverride === 'save-failure'
      ? 'failure'
      : (metadataOverride ?? metadata.status);
  const displayedMetadata =
    metadataOverride !== null && state.status === 'data'
      ? {
          ...metadata,
          trailTitle: state.data.trail.title,
          trailKind: state.data.trail.kind,
          expectedUpdatedAt: state.data.trail.updatedAt,
        }
      : metadata;
  const metadataInteractionDisabled =
    metadataOverride !== null ||
    displayedMetadataStatus === 'submitting' ||
    displayedMetadataStatus === 'stale';
  const metadataUnchanged =
    state.status === 'data' &&
    normalizeTrailTitle(displayedMetadata.trailTitle) ===
      state.data.trail.title &&
    displayedMetadata.trailKind === state.data.trail.kind;
  const deleteOverride =
    state.status === 'data' && links.length > 0
      ? selectActiveDeveloperUiState(uiStateSnapshot, 'run-detail-link-delete')
      : null;
  const overrideDeleteLinkId = deleteOverride
    ? links.some((link) => link.id === deletion.linkId)
      ? deletion.linkId
      : links[0]?.id
    : null;
  useLayoutEffect(() => {
    activeIdentityRef.current = { repository, trailId, mounted: true };
    metadataSubmissionRef.current = null;
    metadataReloadRef.current = null;
    return () => {
      activeIdentityRef.current.mounted = false;
    };
  }, [repository, trailId]);
  useEffect(() => {
    if (trailCreated) {
      void navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: null,
      });
    }
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    trailCreated,
  ]);
  useEffect(() => {
    let active = true;
    loadTrailDetailDataState(repository, trailId).then((next) => {
      if (active)
        setSnapshot({
          repository,
          trailId,
          state: next,
          links: next.status === 'data' ? (next.data.runs[0]?.links ?? []) : [],
        });
    });
    return () => {
      active = false;
    };
  }, [repository, trailId]);
  useEffect(() => {
    if (displayedMetadataStatus === 'editing')
      metadataInputRef.current?.focus();
  }, [displayedMetadataStatus]);
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
      deletion.linkId === null ||
      deletion.status === 'deleting'
    )
      return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || deletion.linkId === null) return;
      const button = deleteButtonRefs.current.get(deletion.linkId);
      setDeleteSnapshot({
        repository,
        trailId,
        linkId: null,
        status: 'idle',
        successNotice: false,
      });
      requestAnimationFrame(() => button?.focus());
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteOverride, deletion.linkId, deletion.status, repository, trailId]);

  function cancelDelete(linkId: LinkId) {
    if (deleteOverride !== null) return;
    const button = deleteButtonRefs.current.get(linkId);
    setDeleteSnapshot({
      repository,
      trailId,
      linkId: null,
      status: 'idle',
      successNotice: false,
    });
    requestAnimationFrame(() => button?.focus());
  }

  async function deleteLink(linkId: LinkId) {
    if (
      deleteOverride !== null ||
      deletion.status === 'deleting' ||
      state.status !== 'data' ||
      state.data.runs[0] === undefined
    )
      return;
    const activeRunId = state.data.runs[0].run.id;
    setDeleteSnapshot({
      repository,
      trailId,
      linkId,
      status: 'deleting',
      successNotice: false,
    });
    try {
      await repository.softDeleteLink(
        activeRunId,
        linkId,
        new Date().toISOString() as UtcDateTimeString,
      );
      setSnapshot((current) =>
        current.repository === repository && current.trailId === trailId
          ? {
              ...current,
              links: current.links.filter((link) => link.id !== linkId),
            }
          : current,
      );
      setDeleteSnapshot((current) =>
        current.repository === repository &&
        current.trailId === trailId &&
        current.linkId === linkId &&
        current.status === 'deleting'
          ? {
              repository,
              trailId,
              linkId: null,
              status: 'idle',
              successNotice: true,
            }
          : current,
      );
    } catch {
      setDeleteSnapshot((current) =>
        current.repository === repository &&
        current.trailId === trailId &&
        current.linkId === linkId &&
        current.status === 'deleting'
          ? { ...current, status: 'failure', successNotice: false }
          : current,
      );
    }
  }
  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (
      formOverride !== null ||
      state.status !== 'data' ||
      state.data.runs[0] === undefined ||
      form.status === 'submitting'
    )
      return;
    const activeRunId = state.data.runs[0].run.id;
    const title = form.title.trim();
    if (title.length === 0) {
      setFormSnapshot({
        ...form,
        status: 'failure',
        error: 'title',
        successNotice: false,
      });
      return;
    }
    let url: string;
    try {
      const parsed = new URL(form.url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      url = parsed.toString();
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository && current.trailId === trailId
          ? {
              ...current,
              status: 'failure',
              error: 'url',
              successNotice: false,
            }
          : current,
      );
      return;
    }
    if (form.type === '') {
      setFormSnapshot({
        ...form,
        status: 'failure',
        error: 'type',
        successNotice: false,
      });
      return;
    }
    const savingForm = {
      ...form,
      status: 'submitting' as const,
      error: null,
      successNotice: false,
    };
    setFormSnapshot(savingForm);
    try {
      const link = await repository.saveLink(
        createRunLink({
          runId: activeRunId,
          title,
          url,
          type: form.type,
        }),
      );
      setSnapshot((current) =>
        current.repository === repository && current.trailId === trailId
          ? { ...current, links: [...current.links, link] }
          : current,
      );
      setFormSnapshot((current) =>
        current.repository === repository && current.trailId === trailId
          ? {
              repository,
              trailId,
              title: '',
              url: '',
              type: '',
              status: 'idle',
              error: null,
              successNotice: true,
            }
          : current,
      );
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository && current.trailId === trailId
          ? {
              ...current,
              status: 'failure',
              error: 'save',
              successNotice: false,
            }
          : current,
      );
    }
  }
  function beginMetadataEdit() {
    if (metadataOverride !== null || state.status !== 'data') return;
    setMetadataSnapshot({
      repository,
      trailId,
      trailTitle: state.data.trail.title,
      trailKind: state.data.trail.kind,
      expectedUpdatedAt: state.data.trail.updatedAt,
      status: 'editing',
      validationErrors: [],
      successNotice: false,
    });
  }
  function cancelMetadataEdit() {
    if (
      metadataOverride !== null ||
      metadata.status === 'submitting' ||
      metadata.status === 'stale'
    )
      return;
    setMetadataSnapshot({ ...metadata, status: 'view', validationErrors: [] });
    requestAnimationFrame(() => metadataEditButtonRef.current?.focus());
  }
  async function saveMetadata(event: React.FormEvent) {
    event.preventDefault();
    if (
      metadataOverride !== null ||
      state.status !== 'data' ||
      metadata.status === 'submitting' ||
      metadataSubmissionRef.current !== null
    )
      return;
    const errors = validateTrailMetadata(metadata);
    if (errors.length > 0) {
      setMetadataSnapshot({
        ...metadata,
        status: 'failure',
        validationErrors: errors,
      });
      requestAnimationFrame(() => metadataInputRef.current?.focus());
      return;
    }
    const trailTitle = normalizeTrailTitle(metadata.trailTitle);
    if (
      trailTitle === state.data.trail.title &&
      metadata.trailKind === state.data.trail.kind
    ) {
      setMetadataSnapshot({ ...metadata, trailTitle, status: 'view' });
      return;
    }
    const token = Symbol('metadata-submission');
    metadataSubmissionRef.current = token;
    setMetadataSnapshot({
      ...metadata,
      status: 'submitting',
      validationErrors: [],
      successNotice: false,
    });
    try {
      const result = await updateRunTrailMetadata(repository, {
        trailId: state.data.trail.id,
        expectedUpdatedAt: metadata.expectedUpdatedAt,
        trailTitle,
        trailKind: metadata.trailKind,
      });
      const active = activeIdentityRef.current;
      if (
        !active.mounted ||
        active.repository !== repository ||
        active.trailId !== trailId ||
        metadataSubmissionRef.current !== token
      )
        return;
      metadataSubmissionRef.current = null;
      if (result.status === 'success') {
        setSnapshot((current) =>
          current.repository === repository &&
          current.trailId === trailId &&
          current.state.status === 'data'
            ? {
                ...current,
                state: {
                  status: 'data',
                  data: { ...current.state.data, trail: result.trail },
                },
              }
            : current,
        );
        setMetadataSnapshot({
          repository,
          trailId,
          trailTitle: result.trail.title,
          trailKind: result.trail.kind,
          expectedUpdatedAt: result.trail.updatedAt,
          status: 'view',
          validationErrors: [],
          successNotice: true,
        });
        notifyDataChanged();
        requestAnimationFrame(() => metadataEditButtonRef.current?.focus());
      } else if (result.status === 'stale') {
        setMetadataSnapshot({ ...metadata, status: 'stale' });
        requestAnimationFrame(() => metadataReloadButtonRef.current?.focus());
      } else {
        setMetadataSnapshot({ ...metadata, status: 'failure' });
      }
    } catch {
      if (metadataSubmissionRef.current === token) {
        metadataSubmissionRef.current = null;
        setMetadataSnapshot((current) =>
          current.repository === repository && current.trailId === trailId
            ? { ...current, status: 'failure' }
            : current,
        );
      }
    }
  }
  async function reloadLatestMetadata() {
    if (metadataOverride !== null) return;
    const token = Symbol('metadata-reload');
    metadataReloadRef.current = token;
    const requestedRepository = repository;
    const requestedRunId = trailId;
    const latest = await loadTrailDetailDataState(repository, trailId);
    const active = activeIdentityRef.current;
    if (
      !active.mounted ||
      active.repository !== requestedRepository ||
      active.trailId !== requestedRunId ||
      metadataReloadRef.current !== token
    )
      return;
    metadataReloadRef.current = null;
    if (latest.status !== 'data') return;
    setSnapshot({
      repository,
      trailId,
      state: latest,
      links: latest.data.runs[0]?.links ?? [],
    });
    setMetadataSnapshot({
      repository,
      trailId,
      trailTitle: latest.data.trail.title,
      trailKind: latest.data.trail.kind,
      expectedUpdatedAt: latest.data.trail.updatedAt,
      status: 'view',
      validationErrors: [],
      successNotice: false,
    });
  }
  if (displayedState.status === 'loading')
    return (
      <DetailMessage
        variant="loading"
        title="Runを読み込んでいます..."
        description="RepositoryからRunとTrailを取得しています。"
      />
    );
  if (displayedState.status === 'not-found')
    return (
      <DetailMessage
        variant="empty"
        title="指定されたRunが見つかりません。"
        description="Dashboardから別のRunを選択してください。"
      />
    );
  if (displayedState.status === 'failure')
    return (
      <DetailMessage
        variant="error"
        title="Runの読み込みに失敗しました。"
        description="ページを再読み込みするか、Dashboardへ戻ってください。"
      />
    );
  const { trail, runs } = displayedState.data;
  const activeRun = runs[0];
  if (activeRun === undefined)
    return (
      <DetailMessage
        variant="empty"
        title="指定されたRunが見つかりません。"
        description="Dashboardから別のRunを選択してください。"
      />
    );
  const { run, project, recipe } = activeRun;
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Run Detail"
        title="Run Detail"
        description={`${project.name} のTrail: ${trail.title}`}
      />
      <div className="prompt-trail-page__sections">
        {createdNoticeRunId === trailId ? (
          <p className="pt-success-notice" role="status">
            Trailを作成しました。Promptを確認し、作業に関係する関連リンクを追加してください。
          </p>
        ) : null}
        <PageSection
          title="Trail情報"
          actions={
            run.deletedAt === null && displayedMetadataStatus === 'view' ? (
              <button
                ref={metadataEditButtonRef}
                className="pt-button pt-button--secondary"
                type="button"
                onClick={beginMetadataEdit}
              >
                Trail情報を編集
              </button>
            ) : null
          }
        >
          {displayedMetadataStatus === 'view' ? (
            <>
              <dl className="pt-detail-list">
                <div>
                  <dt>Trail名</dt>
                  <dd>{trail.title}</dd>
                </div>
                <div>
                  <dt>Trail種別</dt>
                  <dd>{TRAIL_KIND_LABELS[trail.kind]}</dd>
                </div>
              </dl>
              {metadataOverride === null && metadata.successNotice ? (
                <p className="pt-success-notice" role="status">
                  Trail情報を保存しました。
                </p>
              ) : null}
            </>
          ) : (
            <form
              className="pt-form pt-trail-metadata-form"
              onSubmit={saveMetadata}
              onKeyDown={(event) => {
                if (
                  event.key === 'Escape' &&
                  metadataOverride === null &&
                  metadata.status !== 'stale'
                ) {
                  event.preventDefault();
                  cancelMetadataEdit();
                }
              }}
            >
              <label htmlFor="trail-title">Trail名</label>
              <input
                ref={metadataInputRef}
                id="trail-title"
                value={displayedMetadata.trailTitle}
                maxLength={TRAIL_TITLE_MAX_LENGTH + 1}
                disabled={metadataInteractionDisabled}
                aria-invalid={
                  metadata.validationErrors.some((error) =>
                    error.startsWith('trail-title'),
                  ) || undefined
                }
                aria-describedby={
                  metadata.validationErrors.length > 0
                    ? metadataErrorId
                    : undefined
                }
                onChange={(event) =>
                  metadataOverride === null && metadata.status !== 'stale'
                    ? setMetadataSnapshot({
                        ...metadata,
                        trailTitle: event.target.value,
                        status: 'editing',
                        validationErrors: [],
                      })
                    : undefined
                }
              />
              <span className="pt-form__hint">必須・80文字以内・改行不可</span>
              <label htmlFor="trail-kind">Trail種別</label>
              <select
                id="trail-kind"
                value={displayedMetadata.trailKind}
                disabled={metadataInteractionDisabled}
                aria-invalid={
                  metadata.validationErrors.includes('trail-kind-invalid') ||
                  undefined
                }
                aria-describedby={
                  metadata.validationErrors.includes('trail-kind-invalid')
                    ? metadataErrorId
                    : undefined
                }
                onChange={(event) =>
                  metadataOverride === null && metadata.status !== 'stale'
                    ? setMetadataSnapshot({
                        ...metadata,
                        trailKind: event.target.value as TrailKind,
                        status: 'editing',
                        validationErrors: [],
                      })
                    : undefined
                }
              >
                {TRAIL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {TRAIL_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
              {displayedMetadataStatus === 'failure' ? (
                <p className="pt-form__error" id={metadataErrorId} role="alert">
                  {metadata.validationErrors.length > 0
                    ? 'Trail名は必須・80文字以内で、改行を含めないでください。'
                    : 'Trail情報を保存できませんでした。入力内容を保持しています。もう一度お試しください。'}
                </p>
              ) : null}
              {displayedMetadataStatus === 'stale' ? (
                <div role="alert">
                  <p className="pt-form__error">
                    別の画面でTrail情報が更新されました。最新内容を読み込み、変更内容を確認してください。
                  </p>
                  <button
                    ref={metadataReloadButtonRef}
                    className="pt-button pt-button--secondary"
                    type="button"
                    onClick={() => void reloadLatestMetadata()}
                  >
                    最新内容を読み込む
                  </button>
                </div>
              ) : null}
              <div className="pt-trail-metadata-form__actions">
                <button
                  className="pt-button pt-button--primary"
                  disabled={metadataInteractionDisabled || metadataUnchanged}
                >
                  {displayedMetadataStatus === 'submitting'
                    ? '保存中...'
                    : '変更を保存'}
                </button>
                <button
                  className="pt-button pt-button--secondary"
                  type="button"
                  disabled={metadataInteractionDisabled}
                  onClick={cancelMetadataEdit}
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </PageSection>
        <PageSection title="実行サマリ">
          <dl className="pt-detail-list">
            <div>
              <dt>Project</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{run.status}</dd>
            </div>
            <div>
              <dt>種類</dt>
              <dd>{recipe === null ? 'Direct Prompt' : 'Recipe'}</dd>
            </div>
            <div>
              <dt>Created At</dt>
              <dd>
                <time dateTime={run.createdAt}>
                  {formatDateTime(run.createdAt, { includeSeconds: true })}
                </time>
              </dd>
            </div>
            <div>
              <dt>Updated At</dt>
              <dd>
                <time dateTime={run.updatedAt}>
                  {formatDateTime(run.updatedAt, { includeSeconds: true })}
                </time>
              </dd>
            </div>
            {recipe === null ? null : (
              <div>
                <dt>Recipe</dt>
                <dd>{recipe.title}</dd>
              </div>
            )}
          </dl>
        </PageSection>
        <PageSection
          title="Prompt"
          actions={
            <Link
              className="pt-button pt-button--secondary"
              to={buildNewTrailReusePath(run.id)}
            >
              このPromptを再利用
            </Link>
          }
        >
          <h3>{run.promptSnapshot.title}</h3>
          <pre className="pt-snapshot">{run.promptSnapshot.body}</pre>
        </PageSection>
        {run.contextSnapshots.length > 0 ? (
          <PageSection title="Context Snapshot">
            {run.contextSnapshots.map((context) => (
              <article key={context.contextId}>
                <h3>{context.title}</h3>
                <pre className="pt-snapshot">{context.body}</pre>
              </article>
            ))}
          </PageSection>
        ) : null}
        <PageSection
          title="関連リンク"
          titleAccessory={
            <div className="pt-run-link-information" ref={linkInformationRef}>
              <button
                ref={linkInformationButtonRef}
                className="pt-run-link-information__button"
                type="button"
                aria-label="関連リンクについて"
                aria-expanded={isLinkInformationOpen}
                aria-controls={linkInformationId}
                onClick={() => setIsLinkInformationOpen((open) => !open)}
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
          }
        >
          <form className="pt-form" onSubmit={saveLink}>
            <label htmlFor="link-title">Link名称</label>
            <input
              id="link-title"
              value={form.title}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  title: e.target.value,
                  status: 'idle',
                  error: null,
                  successNotice: false,
                })
              }
              disabled={displayedFormStatus === 'submitting'}
            />
            <label htmlFor="link-url">URL</label>
            <input
              id="link-url"
              type="url"
              value={form.url}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  url: e.target.value,
                  status: 'idle',
                  error: null,
                  successNotice: false,
                })
              }
              disabled={displayedFormStatus === 'submitting'}
            />
            <label htmlFor="link-type">Link種別</label>
            <select
              id="link-type"
              value={form.type}
              onChange={(e) =>
                setFormSnapshot({
                  ...form,
                  type: e.target.value as typeof form.type,
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
                  : form.error === 'title'
                    ? 'Link名称を入力してください。'
                    : form.error === 'type'
                      ? 'Link種別を選択してください。'
                      : form.error === 'url'
                        ? 'http または https のURLを入力してください。'
                        : 'Linkを保存できませんでした。入力内容を保持しています。もう一度お試しください。'}
              </p>
            ) : null}
            {formOverride === null && form.successNotice ? (
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
                  : deletion.linkId === link.id;
                const displayedDeleteStatus =
                  deleteOverride && overrideDeleteLinkId === link.id
                    ? deleteOverride === 'confirming'
                      ? 'idle'
                      : deleteOverride === 'deleting'
                        ? 'deleting'
                        : 'failure'
                    : deletion.status;
                return (
                  <li key={link.id} className="pt-run-link-row">
                    <div className="pt-run-link-row__content">
                      <a href={link.url} target="_blank" rel="noreferrer">
                        {label}
                      </a>
                      {link.title?.trim() ? (
                        <span className="pt-link-list__url">{link.url}</span>
                      ) : null}
                      <span>
                        {LINK_TYPE_LABELS[link.type]} / {link.createdAt}
                      </span>
                    </div>
                    <button
                      ref={(node) => {
                        if (node) deleteButtonRefs.current.set(link.id, node);
                        else deleteButtonRefs.current.delete(link.id);
                      }}
                      className="pt-run-link-row__delete"
                      type="button"
                      aria-label={`${label}を削除`}
                      onClick={() => {
                        if (deleteOverride !== null) return;
                        if (deletion.status === 'deleting') return;
                        setDeleteSnapshot({
                          repository,
                          trailId,
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
                            disabled={displayedDeleteStatus === 'deleting'}
                            onClick={() => void deleteLink(link.id)}
                          >
                            {displayedDeleteStatus === 'deleting'
                              ? '削除中...'
                              : '削除する'}
                          </button>
                          <button
                            className="pt-button pt-button--secondary"
                            type="button"
                            disabled={displayedDeleteStatus === 'deleting'}
                            onClick={() => cancelDelete(link.id)}
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
          {deleteOverride === null && deletion.successNotice ? (
            <p className="pt-success-notice" role="status">
              関連リンクを削除しました。
            </p>
          ) : null}
        </PageSection>
      </div>
      <div className="prompt-trail-page__actions">
        <Link
          className="pt-button pt-button--secondary"
          to={routePaths.dashboard}
        >
          Dashboardへ戻る
        </Link>
      </div>
    </section>
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
function DetailMessage({
  variant,
  title,
  description,
}: {
  variant: 'loading' | 'empty' | 'error';
  title: string;
  description: string;
}) {
  return (
    <section className="prompt-trail-page">
      <PageHeader eyebrow="Run Detail" title="Run Detail" />
      <StateMessage variant={variant} title={title} description={description} />
      <div className="prompt-trail-page__actions">
        <Link
          className="pt-button pt-button--secondary"
          to={routePaths.dashboard}
        >
          Dashboardへ戻る
        </Link>
      </div>
    </section>
  );
}
