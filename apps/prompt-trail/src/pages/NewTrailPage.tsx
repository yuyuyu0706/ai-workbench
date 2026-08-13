import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  buildPromptEditPath,
  buildRunDetailPath,
  routePaths,
} from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import { TRAIL_KINDS, type Run, type TrailKind } from '../domain';
import { TRAIL_KIND_LABELS, validateTrailMetadata } from '../trail-metadata';
import {
  createDirectTrail,
  createPromptTitle,
} from '../trail-creation/create-direct-trail';
import {
  loadReusableRun,
  type ReusableRunState,
} from '../trail-creation/load-reusable-run';
import { createTrailFromPrompt } from '../trail-creation/create-trail-from-prompt';
import {
  loadReusablePrompt,
  type ReusablePromptState,
} from '../trail-creation/load-reusable-prompt';
import { resolveNewTrailSource } from '../trail-creation/resolve-new-trail-source';
import { resolvePromptVariables } from '../prompt-shared/promptVariables';

type FormState = {
  repository: ReturnType<typeof usePromptTrailRepository>;
  identity: string;
  body: string;
  trailTitle: string;
  trailKind: TrailKind;
  bodyDirty: boolean;
  titleDirty: boolean;
  kindDirty: boolean;
  titleOrigin: 'auto' | 'source' | 'manual';
  status: 'idle' | 'submitting' | 'failure';
};

export function NewTrailPage() {
  const repository = usePromptTrailRepository();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const source = resolveNewTrailSource(searchParams);
  const sourceRunId = source.kind === 'run' ? source.runId : null;
  const sourcePromptId = source.kind === 'prompt' ? source.promptId : null;
  const identity = `${location.key}:${source.kind}:${sourceRunId ?? sourcePromptId ?? ''}`;
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [formSnapshot, setFormSnapshot] = useState<FormState>(() =>
    emptyForm(repository, identity),
  );
  const [retryVersion, setRetryVersion] = useState(0);
  const [reuseSnapshot, setReuseSnapshot] = useState<{
    repository: typeof repository;
    identity: string;
    retryVersion: number;
    state: ReusableRunState | { status: 'loading' };
  } | null>(null);
  const [promptSnapshot, setPromptSnapshot] = useState<{
    repository: typeof repository;
    identity: string;
    retryVersion: number;
    state: ReusablePromptState | { status: 'loading' };
  } | null>(null);
  const submissionRef = useRef<{
    token: symbol;
    repository: typeof repository;
    identity: string;
  } | null>(null);
  const latestReloadPendingRef = useRef(false);
  const activeSourceRef = useRef<{
    repository: typeof repository | null;
    identity: string | null;
  }>({ repository: null, identity: null });
  useLayoutEffect(() => {
    activeSourceRef.current = { repository, identity };
    submissionRef.current = null;
    latestReloadPendingRef.current = false;
    return () => {
      activeSourceRef.current = { repository: null, identity: null };
      submissionRef.current = null;
      latestReloadPendingRef.current = false;
    };
  }, [identity, repository]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const kindSelectRef = useRef<HTMLSelectElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const latestPromptButtonRef = useRef<HTMLButtonElement>(null);
  const sourcePromptSectionRef = useRef<HTMLDivElement>(null);
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    repository: typeof repository;
    identity: string;
    runId: Run['id'] | null;
  }>(() => ({ repository, identity, runId: null }));
  if (
    completionSnapshot.repository !== repository ||
    completionSnapshot.identity !== identity
  )
    setCompletionSnapshot({ repository, identity, runId: null });
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (completionSnapshot.runId === null) return;
    navigate(buildRunDetailPath(completionSnapshot.runId), {
      state: { trailCreated: true },
    });
  }, [completionSnapshot.runId, navigate]);

  const form =
    formSnapshot.repository === repository && formSnapshot.identity === identity
      ? formSnapshot
      : emptyForm(repository, identity);
  const metadataErrors = validateTrailMetadata(form);
  const bodyValid = form.body.trim().length > 0;
  const valid = bodyValid && metadataErrors.length === 0;
  const reuseState =
    sourceRunId === null
      ? null
      : reuseSnapshot?.repository === repository &&
          reuseSnapshot.identity === identity &&
          reuseSnapshot.retryVersion === retryVersion
        ? reuseSnapshot.state
        : ({ status: 'loading' } as const);
  const promptState =
    sourcePromptId === null
      ? null
      : promptSnapshot?.repository === repository &&
          promptSnapshot.identity === identity &&
          promptSnapshot.retryVersion === retryVersion
        ? promptSnapshot.state
        : ({ status: 'loading' } as const);
  const formOverride = selectActiveDeveloperUiState(
    uiStateSnapshot,
    'new-trail-form',
  );
  const displayedStatus =
    formOverride === 'submitting'
      ? 'submitting'
      : formOverride === 'save-failure'
        ? 'failure'
        : form.status;
  const disabled = displayedStatus === 'submitting';

  useEffect(() => {
    if (promptState?.status === 'stale') latestPromptButtonRef.current?.focus();
    if (promptState?.status === 'data' && latestReloadPendingRef.current) {
      latestReloadPendingRef.current = false;
      sourcePromptSectionRef.current?.focus();
    }
  }, [promptState?.status]);

  useEffect(() => {
    if (sourceRunId === null) return;
    let active = true;
    void loadReusableRun(repository, sourceRunId).then((state) => {
      if (!active) return;
      setReuseSnapshot({ repository, identity, retryVersion, state });
      if (state.status === 'data')
        setFormSnapshot((current) => {
          const target =
            current.repository === repository && current.identity === identity
              ? current
              : emptyForm(repository, identity);
          return {
            ...target,
            body: target.bodyDirty
              ? target.body
              : state.run.promptSnapshot.body,
            trailTitle: target.titleDirty
              ? target.trailTitle
              : state.trail.title,
            trailKind: target.kindDirty ? target.trailKind : state.trail.kind,
            titleOrigin: target.titleDirty ? target.titleOrigin : 'source',
          };
        });
    });
    return () => {
      active = false;
    };
  }, [identity, repository, retryVersion, sourceRunId]);

  useEffect(() => {
    if (sourcePromptId === null) return;
    let active = true;
    void loadReusablePrompt(repository, sourcePromptId).then((state) => {
      if (!active) return;
      setPromptSnapshot({ repository, identity, retryVersion, state });
      if (state.status === 'data')
        setFormSnapshot((current) => {
          const target =
            current.repository === repository && current.identity === identity
              ? current
              : emptyForm(repository, identity);
          return {
            ...target,
            body: resolvePromptVariables(
              state.prompt.body,
              state.prompt.variableValues,
            ),
            trailTitle: target.titleDirty
              ? target.trailTitle
              : state.prompt.title,
            titleOrigin: target.titleDirty ? target.titleOrigin : 'source',
          };
        });
    });
    return () => {
      active = false;
    };
  }, [identity, repository, retryVersion, sourcePromptId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      source.kind === 'invalid' ||
      (source.kind === 'prompt' && promptState?.status !== 'data')
    )
      return;
    const reusablePrompt =
      source.kind === 'prompt' && promptState?.status === 'data'
        ? promptState.prompt
        : null;
    if (!valid) {
      if (metadataErrors.some((error) => error.startsWith('trail-title')))
        titleInputRef.current?.focus();
      else if (metadataErrors.includes('trail-kind-invalid'))
        kindSelectRef.current?.focus();
      else bodyInputRef.current?.focus();
      return;
    }
    if (
      formOverride !== null ||
      form.status === 'submitting' ||
      reuseState?.status === 'loading' ||
      (submissionRef.current?.identity === identity &&
        submissionRef.current.repository === repository)
    )
      return;
    const token = Symbol('new-trail-submission');
    submissionRef.current = { token, repository, identity };
    setFormSnapshot({ ...form, status: 'submitting' });
    try {
      const result =
        reusablePrompt !== null
          ? await createTrailFromPrompt(repository, {
              sourcePrompt: reusablePrompt,
              trailTitle: form.trailTitle,
              trailKind: form.trailKind,
            })
          : {
              status: 'created' as const,
              run: await createDirectTrail(repository, {
                promptBody: form.body,
                trailTitle: form.trailTitle,
                trailKind: form.trailKind,
              }),
            };
      if (result.status !== 'created') {
        if (
          mountedRef.current &&
          activeSourceRef.current.repository === repository &&
          activeSourceRef.current.identity === identity &&
          submissionRef.current?.token === token &&
          submissionRef.current.repository === repository &&
          submissionRef.current.identity === identity
        ) {
          setFormSnapshot((current) =>
            current.repository === repository && current.identity === identity
              ? { ...current, status: 'idle' }
              : current,
          );
          if (result.status === 'invalid') return;
          setPromptSnapshot({
            repository,
            identity,
            retryVersion,
            state: {
              status: result.status,
            },
          });
        }
        return;
      }
      const run = result.run;
      if (mountedRef.current && submissionRef.current?.token === token)
        setCompletionSnapshot((current) =>
          current.repository === repository && current.identity === identity
            ? { ...current, runId: run.id }
            : current,
        );
    } catch {
      if (mountedRef.current && submissionRef.current?.token === token)
        setFormSnapshot((current) =>
          current.repository === repository && current.identity === identity
            ? { ...current, status: 'failure' }
            : current,
        );
    } finally {
      if (submissionRef.current?.token === token) submissionRef.current = null;
    }
  }

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="New Trail"
        title="新しいTrailを始める"
        description="Trailの名前と用途、AIに依頼する内容を設定してください。作業後に関連リンクを追加すると、依頼から成果までをTrailとして残せます。"
      />
      <div className="prompt-trail-page__sections">
        {source.kind === 'invalid' ? (
          <PageSection title="作成元を確認できません">
            <div role="alert">
              <p>作成元の指定が正しくありません。</p>
              <div className="prompt-trail-page__actions">
                <Link to={routePaths.promptLibrary}>Prompt Libraryへ戻る</Link>
                <Link to={routePaths.newTrail}>空のPromptから始める</Link>
              </div>
            </div>
          </PageSection>
        ) : null}
        {promptState === null ? null : (
          <PageSection title="再利用元Prompt">
            {promptState.status === 'loading' ? (
              <p role="status">Promptを読み込んでいます...</p>
            ) : promptState.status === 'data' ? (
              <div
                className="pt-reuse-source"
                ref={sourcePromptSectionRef}
                tabIndex={-1}
              >
                <dl>
                  <dt>Promptタイトル</dt>
                  <dd>{promptState.prompt.title}</dd>
                  <dt>Scope</dt>
                  <dd>
                    {promptState.prompt.scope === 'global'
                      ? 'Global'
                      : 'Default Project'}
                  </dd>
                </dl>
                <p>このPromptの現在内容を実行時Snapshotとして使用します。</p>
                {disabled ? (
                  <span aria-disabled="true">元のPromptを編集</span>
                ) : (
                  <Link to={buildPromptEditPath(promptState.prompt.id)}>
                    元のPromptを編集
                  </Link>
                )}
              </div>
            ) : (
              <PromptSourceError
                state={promptState.status}
                disabled={disabled}
                retry={() => setRetryVersion((value) => value + 1)}
                reloadLatest={() => {
                  latestReloadPendingRef.current = true;
                  setRetryVersion((value) => value + 1);
                }}
                latestPromptButtonRef={latestPromptButtonRef}
              />
            )}
          </PageSection>
        )}
        {reuseState === null ? null : (
          <PageSection title="再利用元">
            {reuseState.status === 'loading' ? (
              <p role="status">再利用元のRunを読み込んでいます...</p>
            ) : reuseState.status === 'data' ? (
              <div className="pt-reuse-source">
                <p>
                  「{reuseState.trail.title}
                  」のTrail名、Trail種別、Prompt本文を引き継ぎました。編集して新しいTrailを作成できます。
                </p>
                {disabled ? (
                  <span
                    className="pt-button pt-button--secondary"
                    aria-disabled="true"
                  >
                    元のTrailを確認
                  </span>
                ) : (
                  <Link to={buildRunDetailPath(reuseState.run.id)}>
                    元のTrailを確認
                  </Link>
                )}
              </div>
            ) : (
              <ReuseError
                state={reuseState.status}
                disabled={disabled}
                retry={() => setRetryVersion((value) => value + 1)}
              />
            )}
          </PageSection>
        )}
        <PageSection
          title="TrailとPrompt"
          description="Trail名は個別の作業名です。Prompt資産のタイトルはPrompt本文から別に生成されます。"
        >
          <form className="pt-form" onSubmit={submit} noValidate>
            <label htmlFor="trail-title">Trail名</label>
            <input
              ref={titleInputRef}
              id="trail-title"
              value={form.trailTitle}
              maxLength={81}
              onChange={(event) =>
                setFormSnapshot({
                  ...form,
                  trailTitle: event.target.value,
                  titleDirty: true,
                  titleOrigin: 'manual',
                  status: 'idle',
                })
              }
              disabled={disabled}
              aria-describedby="trail-title-help trail-title-error"
              aria-invalid={metadataErrors.some((error) =>
                error.startsWith('trail-title'),
              )}
            />
            <p id="trail-title-help" className="pt-form__help">
              必須・80文字以内。改行は使用できません。
            </p>
            <TrailTitleError errors={metadataErrors} />
            <label htmlFor="trail-kind">Trail種別</label>
            <select
              ref={kindSelectRef}
              id="trail-kind"
              value={form.trailKind}
              onChange={(event) =>
                setFormSnapshot({
                  ...form,
                  trailKind: event.target.value as TrailKind,
                  kindDirty: true,
                  status: 'idle',
                })
              }
              disabled={disabled}
              aria-describedby="trail-kind-error"
              aria-invalid={metadataErrors.includes('trail-kind-invalid')}
            >
              {TRAIL_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {TRAIL_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <p id="trail-kind-error" className="pt-form__error">
              {metadataErrors.includes('trail-kind-invalid')
                ? 'Trail種別を選択してください。'
                : null}
            </p>
            <label htmlFor="prompt-body">Prompt本文</label>
            <textarea
              ref={bodyInputRef}
              id="prompt-body"
              value={form.body}
              onChange={(event) => {
                const body = event.target.value;
                setFormSnapshot({
                  ...form,
                  body,
                  bodyDirty: true,
                  trailTitle:
                    form.titleOrigin === 'auto'
                      ? createPromptTitle(body)
                      : form.trailTitle,
                  status: 'idle',
                });
              }}
              rows={12}
              disabled={disabled}
              readOnly={source.kind === 'prompt'}
              aria-describedby={
                source.kind === 'prompt'
                  ? 'prompt-body-help prompt-body-error'
                  : 'prompt-body-error'
              }
              aria-invalid={!bodyValid}
            />
            <p id="prompt-body-error" className="pt-form__error">
              {!bodyValid ? 'Prompt本文を入力してください。' : null}
            </p>
            {source.kind === 'prompt' ? (
              <p id="prompt-body-help" className="pt-form__help">
                Prompt本文は元の資産を変更せずSnapshotに保存するため、この画面では編集できません。
              </p>
            ) : null}
            {displayedStatus === 'failure' ? (
              <p className="pt-form__error" role="alert">
                保存に失敗しました。入力内容を保持しています。再試行してください。
              </p>
            ) : null}
            <div className="prompt-trail-page__actions">
              <button
                className="pt-button pt-button--primary"
                disabled={
                  disabled ||
                  source.kind === 'invalid' ||
                  reuseState?.status === 'loading' ||
                  (promptState?.status !== 'data' && promptState !== null)
                }
              >
                {disabled ? '作成中...' : 'Trailを作成'}
              </button>
              {disabled ? (
                <span
                  className="pt-button pt-button--secondary"
                  aria-disabled="true"
                >
                  Dashboardへ戻る
                </span>
              ) : (
                <Link
                  className="pt-button pt-button--secondary"
                  to={routePaths.dashboard}
                >
                  Dashboardへ戻る
                </Link>
              )}
            </div>
          </form>
        </PageSection>
      </div>
    </section>
  );
}

function emptyForm(
  repository: ReturnType<typeof usePromptTrailRepository>,
  identity: string,
): FormState {
  return {
    repository,
    identity,
    body: '',
    trailTitle: '',
    trailKind: 'other',
    bodyDirty: false,
    titleDirty: false,
    kindDirty: false,
    titleOrigin: 'auto',
    status: 'idle',
  };
}

function TrailTitleError({
  errors,
}: {
  errors: ReturnType<typeof validateTrailMetadata>;
}) {
  const message = errors.includes('trail-title-newline')
    ? 'Trail名に改行は使用できません。'
    : errors.includes('trail-title-too-long')
      ? 'Trail名は80文字以内で入力してください。'
      : errors.includes('trail-title-required')
        ? 'Trail名を入力してください。'
        : null;
  return (
    <p id="trail-title-error" className="pt-form__error">
      {message}
    </p>
  );
}

function ReuseError({
  state,
  disabled,
  retry,
}: {
  state: 'not-found' | 'failure';
  disabled: boolean;
  retry: () => void;
}) {
  return (
    <div className="pt-reuse-source" role="alert">
      <p>
        {state === 'not-found'
          ? '再利用元のRunが見つかりません。'
          : '再利用元のRunを読み込めませんでした。'}
        空のPromptから通常のTrailを作成できます。
      </p>
      <div className="prompt-trail-page__actions">
        {state === 'failure' ? (
          <button
            className="pt-button pt-button--secondary"
            type="button"
            onClick={retry}
            disabled={disabled}
          >
            再試行
          </button>
        ) : null}
        {disabled ? (
          <span className="pt-button pt-button--secondary" aria-disabled="true">
            空のPromptから始める
          </span>
        ) : (
          <Link
            className="pt-button pt-button--secondary"
            to={routePaths.newTrail}
          >
            空のPromptから始める
          </Link>
        )}
      </div>
    </div>
  );
}

function PromptSourceError({
  state,
  disabled,
  retry,
  reloadLatest,
  latestPromptButtonRef,
}: {
  state: 'not-found' | 'unavailable' | 'failure' | 'stale';
  disabled: boolean;
  retry: () => void;
  reloadLatest: () => void;
  latestPromptButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const message =
    state === 'not-found'
      ? '指定されたPromptが見つかりません。'
      : state === 'unavailable'
        ? '元のPromptは削除されたか、現在は利用できません。'
        : state === 'stale'
          ? '元のPromptが別の画面で更新されました。最新内容を読み込み、Snapshotへ保存する内容を確認してください。'
          : 'Promptの読み込みに失敗しました。時間をおいて再試行してください。';
  return (
    <div className="pt-reuse-source" role="alert">
      <p>{message}</p>
      <div className="prompt-trail-page__actions">
        {state === 'failure' || state === 'stale' ? (
          <button
            ref={state === 'stale' ? latestPromptButtonRef : undefined}
            type="button"
            disabled={disabled}
            onClick={state === 'stale' ? reloadLatest : retry}
          >
            {state === 'stale' ? '最新のPromptを読み込む' : '再試行'}
          </button>
        ) : null}
        <Link to={routePaths.promptLibrary}>Prompt Libraryへ戻る</Link>
        <Link to={routePaths.newTrail}>空のPromptから始める</Link>
      </div>
    </div>
  );
}
