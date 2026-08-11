import { describe, expect, it } from 'vitest';
import { validatePromptEditorValues } from './prompt-editor-validation';

describe('validatePromptEditorValues', () => {
  it('preserves Markdown whitespace', () => {
    expect(
      validatePromptEditorValues({
        title: ' title ',
        body: '\n  body\n',
      }),
    ).toEqual({});
  });

  it('rejects blank values and titles over 80 characters', () => {
    expect(validatePromptEditorValues({ title: ' ', body: '\n ' })).toEqual({
      title: 'Promptタイトルを入力してください。',
      body: 'Prompt本文を入力してください。',
    });
    expect(
      validatePromptEditorValues({
        title: 'a'.repeat(81),
        body: 'body',
      }),
    ).toMatchObject({ title: expect.any(String) });
    expect(
      validatePromptEditorValues({
        title: 'a'.repeat(80),
        body: 'body',
      }),
    ).toEqual({});
  });
});
