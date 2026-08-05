import { PROMPT_KINDS, type PromptKind } from '../domain';

export interface PromptEditorValues {
  readonly title: string;
  readonly body: string;
  readonly kind: string;
}

export type PromptEditorErrors = Partial<
  Record<keyof PromptEditorValues, string>
>;

export function validatePromptBody(body: string): string | undefined {
  return body.trim().length === 0
    ? 'Prompt本文を入力してください。'
    : undefined;
}

export function validatePromptEditorValues(
  values: PromptEditorValues,
): PromptEditorErrors {
  const errors: PromptEditorErrors = {};
  const title = values.title.trim();
  if (title.length === 0) errors.title = 'Promptタイトルを入力してください。';
  else if (title.length > 80)
    errors.title = 'Promptタイトルは80文字以内で入力してください。';
  const bodyError = validatePromptBody(values.body);
  if (bodyError !== undefined) errors.body = bodyError;
  if (!PROMPT_KINDS.includes(values.kind as PromptKind))
    errors.kind = 'Prompt種別を選択してください。';
  return errors;
}
