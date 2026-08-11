import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { usePromptTrailDataRevision } from '../app/PromptTrailDataRevisionContext';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { routePaths } from '../app/routes';
import { PageHeader, PageSection, StateMessage } from '../components/ui';
import { useDeveloperUiStateSnapshot } from '../developer-tools/DeveloperToolsContext';
import { selectActiveDeveloperUiState } from '../developer-ui-state';
import type { Prompt, PromptId } from '../domain';
import {
  createPrompt,
  deletePrompt,
  loadPromptEditorDataState,
  PromptDeleteTargetError,
  PromptUpdateTargetError,
  updatePrompt,
  validatePromptEditorValues,
  type PromptEditorErrors,
  type PromptEditorValues,
} from '../prompt-editor';
import {
  extractPromptVariables,
  resolvePromptVariables,
} from '../prompt-shared/promptVariables';
import {
  addPromptTag,
  isValidPromptTagLength,
  PROMPT_TAG_MAX_COUNT,
  removePromptTag,
} from '../prompt-shared/promptTags';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'data'; readonly prompt: Prompt }
  | { readonly status: 'not-found' | 'unavailable' | 'failure' };

const EMPTY_VALUES: PromptEditorValues = { title: '', body: '', tags: [] };
const PROMPT_EDITOR_FORM_ID = 'prompt-editor-form';

const COPY_SVG = (
  <svg
    aria-hidden="true"
    className="pt-prompt-editor__copy-icon"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

const CHECK_SVG = (
  <svg
    aria-hidden="true"
    className="pt-prompt-editor__copy-icon pt-prompt-editor__copy-icon--check"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function PromptEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const repository = usePromptTrailRepository();
  const { notifyDataChanged } = usePromptTrailDataRevision();
  const navigate = useNavigate();
  const { promptId = '' } = useParams();
  const snapshot = useDeveloperUiStateSnapshot();
  const override = selectActiveDeveloperUiState(snapshot, 'prompt-editor-page');
  const deleteOverride = selectActiveDeveloperUiState(
    snapshot,
    'prompt-editor-delete',
  );
  const routeKey = mode === 'create' ? 'new' : promptId;
  const activeIdentityRef = useRef({ repository, routeKey });
  const submissionRef = useRef<{
    repository: typeof repository;
    routeKey: string;
    token: symbol;
  } | null>(null);
  const deletionRef = useRef<{
    repository: typeof repository;
    routeKey: string;
    promptId: PromptId;
    token: symbol;
  } | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const varPanelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    activeIdentityRef.current = { repository, routeKey };
    return () => {
      submissionRef.current = null;
      deletionRef.current = null;
    };
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
  const [deletion, setDeletion] = useState<{
    repository: typeof repository;
    routeKey: string;
    status: 'idle' | 'confirming' | 'deleting' | 'failure';
  }>(() => ({ repository, routeKey, status: 'idle' }));
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
  const currentDeletion =
    deletion.repository === repository && deletion.routeKey === routeKey
      ? deletion.status
      : 'idle';
  const displayedDeletion =
    deleteOverride === 'confirming'
      ? 'confirming'
      : deleteOverride === 'deleting'
        ? 'deleting'
        : deleteOverride === 'delete-failure'
          ? 'failure'
          : currentDeletion;
  const deletionOpen = displayedDeletion !== 'idle';
  const saveDisabled = displayedStatus === 'submitting' || deletionOpen;
  const saveLabel = displayedStatus === 'submitting' ? '保存中...' : '保存';
  const [copyState, setCopyState] = useState<'success' | 'error' | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const focusInPanelRef = useRef(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagError, setTagError] = useState<string | undefined>(undefined);

  function addTagFromDraft() {
    const draft = tagDraft;
    if (draft.trim().length === 0) {
      setTagDraft('');
      setTagError(undefined);
      return;
    }
    if (!isValidPromptTagLength(draft)) {
      setTagError('タグは1〜24文字で入力してください。');
      return;
    }
    if (currentForm.values.tags.length >= PROMPT_TAG_MAX_COUNT) {
      setTagError(`タグは${PROMPT_TAG_MAX_COUNT}個まで追加できます。`);
      return;
    }
    const nextTags = addPromptTag(currentForm.values.tags, draft);
    if (nextTags === currentForm.values.tags) {
      setTagError('同じタグが既に追加されています。');
      return;
    }
    setForm({
      ...currentForm,
      values: { ...currentForm.values, tags: nextTags },
      status: 'idle',
    });
    setTagDraft('');
    setTagError(undefined);
  }

  function handleTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTagFromDraft();
    }
  }

  function removeTag(tag: string) {
    setForm({
      ...currentForm,
      values: {
        ...currentForm.values,
        tags: removePromptTag(currentForm.values.tags, tag),
      },
      status: 'idle',
    });
  }

  const detectedVars = useMemo(
    () => extractPromptVariables(currentForm.values.body),
    [currentForm.values.body],
  );

  const effectiveVarPanelOpen = detectedVars.length > 0;

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
    const copyButton = copyButtonRef.current;
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      if (focusInPanelRef.current) copyButton?.focus();
      focusInPanelRef.current = false;
    };
  }, [effectiveVarPanelOpen]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null)
        clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  async function copyBody() {
    if (copyResetTimerRef.current !== null) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(currentForm.values.body);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  function startCopyResetTimer() {
    if (copyState !== 'success') return;
    copyResetTimerRef.current = setTimeout(() => {
      setCopyState(null);
      copyResetTimerRef.current = null;
    }, 2000);
  }

  function handleCopyMouseLeave() {
    startCopyResetTimer();
  }

  function handleCopyBlur() {
    startCopyResetTimer();
  }

  function handleCopyMouseEnter() {
    if (copyResetTimerRef.current !== null) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
  }

  function handleCopyButtonClick() {
    if (detectedVars.length === 0) {
      void copyBody();
      return;
    }
    void copyResolved();
  }

  async function copyResolved() {
    if (copyResetTimerRef.current !== null) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
    const resolved = resolvePromptVariables(currentForm.values.body, varValues);
    try {
      await navigator.clipboard.writeText(resolved);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  useEffect(() => {
    if (mode === 'create') return;
    let active = true;
    void loadPromptEditorDataState(repository, promptId as PromptId).then(
      (state) => {
        if (!active) return;
        setLoaded({ repository, routeKey, state });
        if (state.status === 'data') {
          setForm({
            repository,
            routeKey,
            values: {
              title: state.prompt.title,
              body: state.prompt.body,
              tags: state.prompt.tags,
            },
            errors: {},
            status: 'idle',
          });
          setVarValues({ ...state.prompt.variableValues });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [mode, promptId, repository, routeKey]);

  useEffect(() => {
    if (deletionOpen) confirmDeleteButtonRef.current?.focus();
  }, [deletionOpen]);

  useEffect(() => {
    if (!deletionOpen || displayedDeletion === 'deleting') return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelDeletion();
    };
    document.addEventListener('keydown', cancelOnEscape);
    return () => document.removeEventListener('keydown', cancelOnEscape);
  });

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
      submissionRef.current !== null ||
      displayedDeletion !== 'idle'
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
    const persistedVariableValues = Object.fromEntries(
      detectedVars.filter((v) => v in varValues).map((v) => [v, varValues[v]]),
    );
    try {
      if (mode === 'create')
        await createPrompt(
          repository,
          currentForm.values,
          {},
          persistedVariableValues,
        );
      else
        await updatePrompt(
          repository,
          displayedLoad.prompt.id,
          currentForm.values,
          {},
          persistedVariableValues,
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

  function startDeletion() {
    if (
      mode !== 'edit' ||
      displayedStatus === 'submitting' ||
      displayedDeletion !== 'idle'
    )
      return;
    setDeletion({ repository, routeKey, status: 'confirming' });
  }

  function cancelDeletion() {
    if (deleteOverride !== null || displayedDeletion === 'deleting') return;
    setDeletion({ repository, routeKey, status: 'idle' });
    requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }

  async function confirmDeletion() {
    if (
      mode !== 'edit' ||
      deleteOverride !== null ||
      displayedLoad.status !== 'data' ||
      displayedDeletion === 'deleting' ||
      displayedDeletion === 'idle' ||
      deletionRef.current !== null ||
      submissionRef.current !== null
    )
      return;
    const targetId = displayedLoad.prompt.id;
    const token = Symbol('prompt-deletion');
    deletionRef.current = { repository, routeKey, promptId: targetId, token };
    setDeletion({ repository, routeKey, status: 'deleting' });
    const deletionIsCurrent = () =>
      deletionRef.current?.token === token &&
      deletionRef.current.promptId === targetId &&
      activeIdentityRef.current.repository === repository &&
      activeIdentityRef.current.routeKey === routeKey;
    try {
      await deletePrompt(repository, targetId);
      if (!deletionIsCurrent()) return;
      notifyDataChanged();
      navigate(routePaths.promptLibrary, { state: { promptDeleted: true } });
    } catch (error) {
      if (!deletionIsCurrent()) return;
      if (error instanceof PromptDeleteTargetError) {
        setLoaded({ repository, routeKey, state: { status: error.status } });
        return;
      }
      setDeletion({ repository, routeKey, status: 'failure' });
    } finally {
      if (deletionRef.current?.token === token) deletionRef.current = null;
    }
  }

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Prompt Editor"
        title={mode === 'create' ? 'Promptを新規登録' : 'Promptを編集'}
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
        <PageSection
          title="Promptの内容"
          actions={
            <button
              className="pt-button pt-button--primary"
              type="submit"
              form={PROMPT_EDITOR_FORM_ID}
              disabled={saveDisabled}
            >
              {saveLabel}
            </button>
          }
        >
          <form
            id={PROMPT_EDITOR_FORM_ID}
            className="pt-form pt-prompt-editor"
            onSubmit={submit}
            noValidate
          >
            <div className="pt-prompt-editor__meta-field">
              <label htmlFor="prompt-title">タイトル</label>
              <input
                id="prompt-title"
                value={currentForm.values.title}
                maxLength={81}
                disabled={
                  displayedStatus === 'submitting' ||
                  displayedDeletion === 'deleting'
                }
                onChange={(event) => change('title', event.target.value)}
              />
              {currentForm.errors.title ? (
                <p className="pt-form__error">{currentForm.errors.title}</p>
              ) : null}
            </div>
            <div className="pt-prompt-editor__meta-row">
              <div className="pt-prompt-editor__meta-field">
                <label htmlFor="prompt-tag-input">タグ</label>
                <div className="pt-prompt-editor__tag-list">
                  {currentForm.values.tags.map((tag) => (
                    <span key={tag} className="pt-prompt-editor__tag-chip">
                      {tag}
                      <button
                        type="button"
                        className="pt-prompt-editor__tag-chip-remove"
                        aria-label={`タグ「${tag}」を削除`}
                        disabled={
                          displayedStatus === 'submitting' ||
                          displayedDeletion === 'deleting'
                        }
                        onClick={() => removeTag(tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="prompt-tag-input"
                    type="text"
                    value={tagDraft}
                    maxLength={24}
                    placeholder="タグを入力してEnter"
                    disabled={
                      displayedStatus === 'submitting' ||
                      displayedDeletion === 'deleting' ||
                      currentForm.values.tags.length >= PROMPT_TAG_MAX_COUNT
                    }
                    onChange={(event) => {
                      setTagDraft(event.target.value);
                      setTagError(undefined);
                    }}
                    onKeyDown={handleTagInputKeyDown}
                  />
                </div>
                {tagError ? <p className="pt-form__error">{tagError}</p> : null}
              </div>
            </div>
            <div className="pt-prompt-editor__body-label-row">
              <label htmlFor="prompt-body">Prompt本文</label>
              <span className="pt-prompt-editor__copy-wrap">
                <button
                  ref={copyButtonRef}
                  aria-label="Prompt本文をコピー"
                  aria-expanded={
                    detectedVars.length > 0 ? effectiveVarPanelOpen : undefined
                  }
                  className={`pt-prompt-editor__copy${copyState === 'success' ? ' pt-prompt-editor__copy--copied' : ''}`}
                  type="button"
                  onClick={handleCopyButtonClick}
                  onMouseLeave={handleCopyMouseLeave}
                  onMouseEnter={handleCopyMouseEnter}
                  onBlur={handleCopyBlur}
                >
                  {copyState === 'success' ? CHECK_SVG : COPY_SVG}
                </button>
                <span className="pt-prompt-editor__copy-tooltip" role="tooltip">
                  Prompt本文をコピー
                </span>
              </span>
            </div>
            {effectiveVarPanelOpen && (
              <div
                ref={varPanelRef}
                className="pt-prompt-editor__var-panel"
                role="dialog"
                aria-label="変数に値を入力してコピー"
              >
                <div className="pt-prompt-editor__var-panel-fields">
                  {detectedVars.map((v) => (
                    <div key={v} className="pt-prompt-editor__var-panel-field">
                      <label
                        className="pt-prompt-editor__var-badge"
                        htmlFor={`var-input-${v}`}
                      >{`\${${v}}`}</label>
                      <input
                        id={`var-input-${v}`}
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
            )}
            <p aria-live="polite" className="pt-prompt-editor__copy-status">
              {copyState === 'success'
                ? 'コピーしました'
                : copyState === 'error'
                  ? 'コピーできませんでした'
                  : null}
            </p>
            <textarea
              id="prompt-body"
              rows={14}
              value={currentForm.values.body}
              disabled={
                displayedStatus === 'submitting' ||
                displayedDeletion === 'deleting'
              }
              onChange={(event) => change('body', event.target.value)}
            />
            {currentForm.errors.body ? (
              <p className="pt-form__error">{currentForm.errors.body}</p>
            ) : null}
            {displayedStatus === 'failure' ? (
              <p className="pt-form__error" role="alert">
                保存に失敗しました。入力内容を保持しています。再試行してください。
              </p>
            ) : null}
            <div className="prompt-trail-page__actions">
              <button
                className="pt-button pt-button--primary"
                type="submit"
                disabled={saveDisabled}
              >
                {saveLabel}
              </button>
              {displayedStatus === 'submitting' ||
              displayedDeletion === 'deleting' ? (
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
      {mode === 'edit' && displayedLoad.status === 'data' ? (
        <PageSection title="Danger Zone">
          <div className="pt-prompt-danger-zone">
            {deletionOpen ? (
              <>
                <p>
                  <strong>
                    「{displayedLoad.prompt.title}」を削除しますか？
                  </strong>
                </p>
                <p>
                  Prompt
                  Libraryと今後のPrompt資産からのTrail作成対象から除外されます。過去Run、関連Link、実行時のPrompt内容は残ります。
                </p>
                {displayedDeletion === 'failure' ? (
                  <p className="pt-form__error" role="alert">
                    削除に失敗しました。入力内容を保持しています。再試行してください。
                  </p>
                ) : null}
                <div className="pt-prompt-danger-zone__actions">
                  <button
                    ref={confirmDeleteButtonRef}
                    className="pt-button pt-button--danger"
                    disabled={displayedDeletion === 'deleting'}
                    onClick={() => void confirmDeletion()}
                  >
                    {displayedDeletion === 'deleting'
                      ? '削除中...'
                      : '削除する'}
                  </button>
                  <button
                    className="pt-button pt-button--secondary"
                    disabled={displayedDeletion === 'deleting'}
                    onClick={cancelDeletion}
                  >
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>このPromptを今後の利用対象から除外します。</p>
                <button
                  ref={deleteButtonRef}
                  className="pt-button pt-button--danger"
                  disabled={displayedStatus === 'submitting'}
                  onClick={startDeletion}
                >
                  Promptを削除
                </button>
              </>
            )}
          </div>
        </PageSection>
      ) : null}
    </section>
  );
}
