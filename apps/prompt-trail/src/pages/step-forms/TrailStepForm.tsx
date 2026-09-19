import { useId } from 'react';
import {
  TRAIL_STEP_KINDS,
  type Prompt,
  type TrailStepKind,
} from '../../domain';
import {
  TRAIL_STEP_KIND_LABELS,
  TRAIL_STEP_TITLE_MAX_LENGTH,
} from '../../trail-step-metadata';

export type TrailStepFormValues = {
  readonly title: string;
  readonly kind: TrailStepKind;
  readonly promptId: string | null;
};

/**
 * The current Prompt referenced by an edited Step, supplied separately so
 * it can be shown in the `<select>` even when it is no longer `active` (and
 * so no longer present in `prompts`). See issue #340 5.5.
 */
export type TrailStepFormCurrentPrompt = Pick<Prompt, 'id' | 'title'>;

const VALIDATION_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'step-title-required':
    'Step名は必須・80文字以内で、改行を含めないでください。',
  'step-title-too-long':
    'Step名は必須・80文字以内で、改行を含めないでください。',
  'step-title-newline':
    'Step名は必須・80文字以内で、改行を含めないでください。',
  'step-kind-invalid': '種別を選択してください。',
  'step-prompt-id-required': 'Promptを選択してください。',
  'step-prompt-id-not-allowed': '人手の工程ではPromptを選択できません。',
};

export function TrailStepForm({
  mode,
  values,
  prompts,
  currentPrompt = null,
  status,
  validationErrors,
  staleNotice,
  isDirty,
  onChange,
  onSubmit,
  onCancel,
  titleInputRef,
}: {
  mode: 'add' | 'edit';
  values: TrailStepFormValues;
  prompts: readonly Prompt[];
  currentPrompt?: TrailStepFormCurrentPrompt | null;
  status: 'editing' | 'submitting' | 'failure' | 'stale';
  validationErrors: readonly string[];
  staleNotice: 'none' | 'refreshed' | 'conflicted';
  isDirty: boolean;
  onChange: (next: TrailStepFormValues) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const noPromptsAvailable = prompts.length === 0 && values.kind === 'prompt';
  const interactionDisabled = status === 'submitting';
  const submitDisabled = interactionDisabled || !isDirty || noPromptsAvailable;
  const titleId = useId();
  const kindId = useId();
  const promptId = useId();
  const validationMessages = Array.from(new Set(validationErrors)).map(
    (code) => VALIDATION_ERROR_MESSAGES[code] ?? code,
  );

  const showCurrentPromptOption =
    currentPrompt !== null &&
    !prompts.some((prompt) => prompt.id === currentPrompt.id);

  return (
    <form className="pt-form" onSubmit={onSubmit}>
      <label htmlFor={titleId}>Step名</label>
      <input
        ref={titleInputRef}
        id={titleId}
        value={values.title}
        maxLength={TRAIL_STEP_TITLE_MAX_LENGTH + 1}
        disabled={interactionDisabled}
        onChange={(event) => onChange({ ...values, title: event.target.value })}
      />
      <span className="pt-form__hint">必須・80文字以内・改行不可</span>
      <label htmlFor={kindId}>種別</label>
      <select
        id={kindId}
        value={values.kind}
        disabled={interactionDisabled}
        onChange={(event) =>
          onChange({
            ...values,
            kind: event.target.value as TrailStepKind,
            promptId: event.target.value === 'manual' ? null : values.promptId,
          })
        }
      >
        {TRAIL_STEP_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {TRAIL_STEP_KIND_LABELS[kind]}
          </option>
        ))}
      </select>
      {values.kind === 'prompt' ? (
        <>
          <label htmlFor={promptId}>Prompt</label>
          <select
            id={promptId}
            value={values.promptId ?? ''}
            disabled={interactionDisabled}
            onChange={(event) =>
              onChange({
                ...values,
                promptId: event.target.value === '' ? null : event.target.value,
              })
            }
          >
            <option value="" />
            {showCurrentPromptOption ? (
              <option value={currentPrompt.id}>
                {currentPrompt.title}（現在の設定）
              </option>
            ) : null}
            {prompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.title}
              </option>
            ))}
          </select>
          {noPromptsAvailable ? (
            <p className="pt-form__error" role="alert">
              Promptが登録されていません。先にPrompt
              Libraryで登録するか、種別を「人手の工程」に変更してください。
            </p>
          ) : null}
        </>
      ) : null}
      {validationMessages.map((message) => (
        <p className="pt-form__error" role="alert" key={message}>
          {message}
        </p>
      ))}
      {status === 'failure' && validationErrors.length === 0 ? (
        <p className="pt-form__error" role="alert">
          保存できませんでした。入力内容を保持しています。もう一度お試しください。
        </p>
      ) : null}
      {staleNotice === 'refreshed' ? (
        <p role="status">
          他の操作でTrailが更新されたため最新の状態を読み込みました。入力内容はそのままです
        </p>
      ) : null}
      {staleNotice === 'conflicted' ? (
        <p className="pt-form__error" role="alert">
          別の場所でこのStepが変更されました。保存すると上書きされます
        </p>
      ) : null}
      <div className="pt-trail-metadata-form__actions">
        <button
          className="pt-button pt-button--primary"
          disabled={submitDisabled}
        >
          {status === 'submitting'
            ? '保存中...'
            : mode === 'add'
              ? '追加する'
              : '変更を保存'}
        </button>
        <button
          className="pt-button pt-button--secondary"
          type="button"
          disabled={interactionDisabled}
          onClick={onCancel}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
