export interface PromptEditorValues {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
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
  return errors;
}
