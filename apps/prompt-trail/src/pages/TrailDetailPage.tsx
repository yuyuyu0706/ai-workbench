import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { routePaths } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { TrailKind, UtcDateTimeString } from '../domain';
import { TRAIL_KINDS } from '../domain';
import {
  loadTrailDetailDataState,
  type TrailDetailDataState,
} from '../trail-detail/trail-detail-data-state';
import { updateRunTrailMetadata } from '../trail-detail/update-trail-metadata';
import {
  normalizeTrailTitle,
  TRAIL_KIND_LABELS,
  TRAIL_TITLE_MAX_LENGTH,
  validateTrailMetadata,
} from '../trail-metadata';
import { RunStepSection } from './RunStepSection';
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
  const trailCreated =
    (location.state as { trailCreated?: boolean } | null)?.trailCreated ===
    true;
  const [createdNoticeRunId] = useState(trailCreated ? trailId : null);
  const [snapshot, setSnapshot] = useState<{
    repository: typeof repository;
    trailId: string;
    state: TrailDetailDataState | { status: 'loading' };
  }>({ repository, trailId, state: { status: 'loading' } });
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
      if (active) setSnapshot({ repository, trailId, state: next });
    });
    return () => {
      active = false;
    };
  }, [repository, trailId]);
  useEffect(() => {
    if (displayedMetadataStatus === 'editing')
      metadataInputRef.current?.focus();
  }, [displayedMetadataStatus]);
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
    setSnapshot({ repository, trailId, state: latest });
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
  const firstRun = runs[0];
  if (firstRun === undefined)
    return (
      <DetailMessage
        variant="empty"
        title="指定されたRunが見つかりません。"
        description="Dashboardから別のRunを選択してください。"
      />
    );
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Run Detail"
        title="Run Detail"
        description={`${firstRun.project.name} のTrail: ${trail.title}`}
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
            firstRun.run.deletedAt === null &&
            displayedMetadataStatus === 'view' ? (
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
        {runs.map((runItem) => (
          <RunStepSection
            key={runItem.run.id}
            run={runItem}
            onRunChanged={() => void reloadLatestMetadata()}
          />
        ))}
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
