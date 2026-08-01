import { describe, expect, it } from 'vitest';
import { PROMPT_KINDS } from '../domain';
import { validatePromptEditorValues } from './prompt-editor-validation';

describe('validatePromptEditorValues', () => {
  it('accepts every supported kind and preserves Markdown whitespace', () => {
    for (const kind of PROMPT_KINDS)
      expect(
        validatePromptEditorValues({
          title: ' title ',
          body: '\n  body\n',
          kind,
        }),
      ).toEqual({});
  });

  it('rejects blank values, unsupported kinds, and titles over 80 characters', () => {
    expect(
      validatePromptEditorValues({ title: ' ', body: '\n ', kind: '' }),
    ).toEqual({
      title: 'Promptタイトルを入力してください。',
      body: 'Prompt本文を入力してください。',
      kind: 'Prompt種別を選択してください。',
    });
    expect(
      validatePromptEditorValues({
        title: 'a'.repeat(81),
        body: 'body',
        kind: 'invalid',
      }),
    ).toMatchObject({ title: expect.any(String), kind: expect.any(String) });
    expect(
      validatePromptEditorValues({
        title: 'a'.repeat(80),
        body: 'body',
        kind: 'other',
      }),
    ).toEqual({});
  });
});
