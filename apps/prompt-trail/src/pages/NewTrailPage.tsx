import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { buildRunDetailPath, routePaths } from '../app/routes';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageHeader, PageSection } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import { createDirectTrail } from '../trail-creation/create-direct-trail';
import {
  loadReusableRun,
  type ReusableRunState,
} from '../trail-creation/load-reusable-run';
export function NewTrailPage() {
  const repository = usePromptTrailRepository();
  const navigate = useNavigate();
  const location = useLocation();
  const reuseSessionKey = location.key;
  const [searchParams] = useSearchParams();
  const sourceRunId = searchParams.get('sourceRunId');
  const uiStateSnapshot = useDeveloperUiStateSnapshot();
  const [formSnapshot, setFormSnapshot] = useState(() => ({
    repository,
    sourceRunId,
    reuseSessionKey,
    body: '',
    dirty: false,
    status: 'idle' as 'idle' | 'submitting' | 'failure',
  }));
  const [retryVersion, setRetryVersion] = useState(0);
  const [reuseSnapshot, setReuseSnapshot] = useState<{
    repository: typeof repository;
    sourceRunId: string;
    reuseSessionKey: string;
    retryVersion: number;
    state: ReusableRunState | { status: 'loading' };
  } | null>(null);
  const form =
    formSnapshot.repository === repository &&
    formSnapshot.sourceRunId === sourceRunId &&
    formSnapshot.reuseSessionKey === reuseSessionKey
      ? formSnapshot
      : {
          repository,
          sourceRunId,
          reuseSessionKey,
          body: '',
          dirty: false,
          status: 'idle' as const,
        };
  const { body } = form;
  const valid = body.trim().length > 0;
  const reuseState =
    sourceRunId === null
      ? null
      : reuseSnapshot?.repository === repository &&
          reuseSnapshot.sourceRunId === sourceRunId &&
          reuseSnapshot.reuseSessionKey === reuseSessionKey &&
          reuseSnapshot.retryVersion === retryVersion
        ? reuseSnapshot.state
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
  useEffect(() => {
    if (sourceRunId === null) return;
    let active = true;
    void loadReusableRun(repository, sourceRunId).then((state) => {
      if (!active) return;
      setReuseSnapshot({
        repository,
        sourceRunId,
        reuseSessionKey,
        retryVersion,
        state,
      });
      if (state.status === 'data')
        setFormSnapshot((current) => {
          if (
            current.repository === repository &&
            current.sourceRunId === sourceRunId &&
            current.reuseSessionKey === reuseSessionKey &&
            current.dirty
          )
            return current;
          return {
            repository,
            sourceRunId,
            reuseSessionKey,
            body: state.run.promptSnapshot.body,
            dirty: false,
            status: 'idle',
          };
        });
    });
    return () => {
      active = false;
    };
  }, [repository, retryVersion, reuseSessionKey, sourceRunId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      formOverride !== null ||
      !valid ||
      form.status === 'submitting' ||
      reuseState?.status === 'loading'
    )
      return;
    setFormSnapshot({ ...form, status: 'submitting' });
    try {
      const run = await createDirectTrail(repository, { promptBody: body });
      navigate(buildRunDetailPath(run.id), {
        state: { trailCreated: true },
      });
    } catch {
      setFormSnapshot((current) =>
        current.repository === repository &&
        current.sourceRunId === sourceRunId &&
        current.reuseSessionKey === reuseSessionKey
          ? { ...current, status: 'failure' }
          : current,
      );
    }
  }
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="New Trail"
        title="新しいTrailを始める"
        description="AIに依頼する内容を入力してください。作業後に関連リンクを追加すると、依頼から成果までをTrailとして残せます。"
      />
      <div className="prompt-trail-page__sections">
        {reuseState === null ? null : (
          <PageSection title="再利用元">
            {reuseState.status === 'loading' ? (
              <p role="status">再利用元のRunを読み込んでいます...</p>
            ) : reuseState.status === 'data' ? (
              <div className="pt-reuse-source">
                <p>
                  「{reuseState.run.promptSnapshot.title}
                  」のPrompt本文を引き継ぎました。編集して新しいTrailを作成できます。
                </p>
                <Link to={buildRunDetailPath(reuseState.run.id)}>
                  元のTrailを確認
                </Link>
              </div>
            ) : (
              <div className="pt-reuse-source" role="alert">
                <p>
                  {reuseState.status === 'not-found'
                    ? '再利用元のRunが見つかりません。'
                    : '再利用元のRunを読み込めませんでした。'}
                  空のPromptから通常のTrailを作成できます。
                </p>
                <div className="prompt-trail-page__actions">
                  {reuseState.status === 'failure' ? (
                    <button
                      className="pt-button pt-button--secondary"
                      type="button"
                      onClick={() => setRetryVersion((value) => value + 1)}
                    >
                      再試行
                    </button>
                  ) : null}
                  <Link
                    className="pt-button pt-button--secondary"
                    to={routePaths.newTrail}
                  >
                    空のPromptから始める
                  </Link>
                </div>
              </div>
            )}
          </PageSection>
        )}
        <PageSection
          title="Prompt"
          description="Promptの最初の行がTrailタイトルになります。"
        >
          <p>
            入力内容はActive Prompt資産として保存され、Prompt
            Libraryから再利用できます。
          </p>
          <form className="pt-form" onSubmit={submit}>
            <label htmlFor="prompt-body">Prompt本文</label>
            <textarea
              id="prompt-body"
              value={body}
              onChange={(event) => {
                setFormSnapshot({
                  ...form,
                  body: event.target.value,
                  dirty: true,
                  status: 'idle',
                });
              }}
              rows={12}
              disabled={displayedStatus === 'submitting'}
            />
            {!valid && body.length > 0 ? (
              <p className="pt-form__error">Prompt本文を入力してください。</p>
            ) : null}
            {displayedStatus === 'failure' ? (
              <p className="pt-form__error">
                保存に失敗しました。内容を確認して再試行してください。
              </p>
            ) : null}
            <div className="prompt-trail-page__actions">
              <button
                className="pt-button pt-button--primary"
                disabled={
                  !valid ||
                  displayedStatus === 'submitting' ||
                  reuseState?.status === 'loading'
                }
              >
                {displayedStatus === 'submitting' ? '作成中...' : 'Trailを作成'}
              </button>
              <Link
                className="pt-button pt-button--secondary"
                to={routePaths.dashboard}
              >
                Dashboardへ戻る
              </Link>
            </div>
          </form>
        </PageSection>
      </div>
    </section>
  );
}
