import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { routePaths } from '../app/routes';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import { PROMPT_KINDS, type Prompt, type PromptId } from '../domain';
import {
  createPrompt,
  loadPromptEditorDataState,
  PromptUpdateTargetError,
  updatePrompt,
  validatePromptEditorValues,
  type PromptEditorErrors,
  type PromptEditorValues,
} from '../prompt-editor';

const KIND_LABELS = {
  'chat-consultation': 'チャット相談',
  'codex-request': 'Codex依頼',
  'issue-creation': 'Issue作成',
  'design-review': '設計レビュー',
  'incident-analysis': '障害分析',
  other: 'その他',
} as const;

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'data'; readonly prompt: Prompt }
  | { readonly status: 'not-found' | 'unavailable' | 'failure' };

const EMPTY_VALUES: PromptEditorValues = { title: '', body: '', kind: '' };

export function PromptEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const repository = usePromptTrailRepository();
  const { notifyDataChanged } = usePromptTrailDataRevision();
  const navigate = useNavigate();
  const { promptId = '' } = useParams();
  const snapshot = useDeveloperUiStateSnapshot();
  const override = selectActiveDeveloperUiState(snapshot, 'prompt-editor-page');
  const routeKey = mode === 'create' ? 'new' : promptId;
  const activeIdentityRef = useRef({ repository, routeKey });
  const submissionRef = useRef<{
    repository: typeof repository;
    routeKey: string;
    token: symbol;
  } | null>(null);
  useLayoutEffect(() => {
    if (
      activeIdentityRef.current.repository !== repository ||
      activeIdentityRef.current.routeKey !== routeKey
    )
      submissionRef.current = null;
    activeIdentityRef.current = { repository, routeKey };
  }, [repository, routeKey]);
  const [loaded, setLoaded] = useState<{
    repository: typeof repository;
    routeKey: string;
    state: LoadState;
  }>(() => ({
    repository,
    routeKey,
    state:
      mode === 'create'
        ? { status: 'data', prompt: null as never }
        : { status: 'loading' },
  }));
  const [form, setForm] = useState<{
    repository: typeof repository;
    routeKey: string;
    values: PromptEditorValues;
    errors: PromptEditorErrors;
    status: 'idle' | 'submitting' | 'failure';
  }>(() => ({
    repository,
    routeKey,
    values: EMPTY_VALUES,
    errors: {},
    status: 'idle',
  }));
  const currentLoad =
    loaded.repository === repository && loaded.routeKey === routeKey
      ? loaded.state
      : mode === 'create'
        ? ({ status: 'data', prompt: null as never } as const)
        : ({ status: 'loading' } as const);
  const currentForm =
    form.repository === repository && form.routeKey === routeKey
      ? form
      : {
          repository,
          routeKey,
          values: EMPTY_VALUES,
          errors: {},
          status: 'idle' as const,
        };
  const displayedLoad: LoadState =
    override === 'loading' || override === 'not-found' || override === 'failure'
      ? { status: override }
      : currentLoad;
  const displayedStatus =
    override === 'submitting'
      ? 'submitting'
      : override === 'save-failure'
        ? 'failure'
        : currentForm.status;

  useEffect(() => {
    if (mode === 'create') return;
    let active = true;
    void loadPromptEditorDataState(repository, promptId as PromptId).then(
      (state) => {
        if (!active) return;
        setLoaded({ repository, routeKey, state });
        if (state.status === 'data')
          setForm({
            repository,
            routeKey,
            values: {
              title: state.prompt.title,
              body: state.prompt.body,
              kind: state.prompt.kind,
            },
            errors: {},
            status: 'idle',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [mode, promptId, repository, routeKey]);

  function change(field: keyof PromptEditorValues, value: string) {
    setForm({
      ...currentForm,
      values: { ...currentForm.values, [field]: value },
      errors: { ...currentForm.errors, [field]: undefined },
      status: 'idle',
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      override !== null ||
      displayedLoad.status !== 'data' ||
      currentForm.status === 'submitting' ||
      submissionRef.current !== null
    )
      return;
    const errors = validatePromptEditorValues(currentForm.values);
    if (Object.keys(errors).length > 0) {
      setForm({ ...currentForm, errors, status: 'idle' });
      return;
    }
    setForm({ ...currentForm, errors: {}, status: 'submitting' });
    const token = Symbol('prompt-submission');
    submissionRef.current = { repository, routeKey, token };
    const submissionIsCurrent = () =>
      submissionRef.current?.token === token &&
      activeIdentityRef.current.repository === repository &&
      activeIdentityRef.current.routeKey === routeKey;
    try {
      if (mode === 'create') await createPrompt(repository, currentForm.values);
      else
        await updatePrompt(
          repository,
          displayedLoad.prompt.id,
          currentForm.values,
        );
      if (!submissionIsCurrent()) return;
      notifyDataChanged();
      navigate(routePaths.promptLibrary, {
        state: { promptSaved: mode === 'create' ? 'created' : 'updated' },
      });
    } catch (error) {
      if (!submissionIsCurrent()) return;
      if (error instanceof PromptUpdateTargetError) {
        setLoaded({ repository, routeKey, state: { status: error.status } });
        return;
      }
      setForm((latest) =>
        latest.repository === repository && latest.routeKey === routeKey
          ? { ...latest, status: 'failure' }
          : latest,
      );
    } finally {
      if (submissionRef.current?.token === token) submissionRef.current = null;
    }
  }

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Prompt Editor"
        title={mode === 'create' ? 'Promptを新規登録' : 'Promptを編集'}
        description="再利用するPromptのタイトル、本文、種別を設定します。"
      />
      {displayedLoad.status === 'loading' ? (
        <StateMessage variant="loading" title="Promptを読み込んでいます..." />
      ) : null}
      {displayedLoad.status === 'not-found' ? (
        <StateMessage
          variant="error"
          title="Promptが見つかりません。"
          description="Prompt Libraryから対象を選び直してください。"
        />
      ) : null}
      {displayedLoad.status === 'unavailable' ? (
        <StateMessage
          variant="error"
          title="このPromptは編集できません。"
          description="削除済みまたはActiveではないPromptです。"
        />
      ) : null}
      {displayedLoad.status === 'failure' ? (
        <StateMessage
          variant="error"
          title="Promptの読み込みに失敗しました。"
          description="時間をおいてページを再読み込みしてください。"
        />
      ) : null}
      {displayedLoad.status === 'data' ? (
        <PageSection title="Promptの内容">
          <form
            className="pt-form pt-prompt-editor"
            onSubmit={submit}
            noValidate
          >
            <label htmlFor="prompt-title">Promptタイトル</label>
            <input
              id="prompt-title"
              value={currentForm.values.title}
              maxLength={81}
              disabled={displayedStatus === 'submitting'}
              onChange={(event) => change('title', event.target.value)}
            />
            {currentForm.errors.title ? (
              <p className="pt-form__error">{currentForm.errors.title}</p>
            ) : null}
            <label htmlFor="prompt-body">Prompt本文</label>
            <textarea
              id="prompt-body"
              rows={14}
              value={currentForm.values.body}
              disabled={displayedStatus === 'submitting'}
              onChange={(event) => change('body', event.target.value)}
            />
            {currentForm.errors.body ? (
              <p className="pt-form__error">{currentForm.errors.body}</p>
            ) : null}
            <label htmlFor="prompt-kind">Prompt種別</label>
            <select
              id="prompt-kind"
              value={currentForm.values.kind}
              disabled={displayedStatus === 'submitting'}
              onChange={(event) => change('kind', event.target.value)}
            >
              <option value="">選択してください</option>
              {PROMPT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            {currentForm.errors.kind ? (
              <p className="pt-form__error">{currentForm.errors.kind}</p>
            ) : null}
            {displayedStatus === 'failure' ? (
              <p className="pt-form__error" role="alert">
                保存に失敗しました。入力内容を保持しています。再試行してください。
              </p>
            ) : null}
            <div className="prompt-trail-page__actions">
              <button
                className="pt-button pt-button--primary"
                disabled={displayedStatus === 'submitting'}
              >
                {displayedStatus === 'submitting' ? '保存中...' : '保存'}
              </button>
              {displayedStatus === 'submitting' ? (
                <button className="pt-button pt-button--secondary" disabled>
                  Prompt Libraryへ戻る
                </button>
              ) : (
                <Link
                  className="pt-button pt-button--secondary"
                  to={routePaths.promptLibrary}
                >
                  Prompt Libraryへ戻る
                </Link>
              )}
            </div>
          </form>
        </PageSection>
      ) : null}
    </section>
  );
}
