import { describe, expect, it } from 'vitest';
import {
  addPromptTag,
  isValidPromptTagLength,
  normalizePromptTag,
  PROMPT_TAG_MAX_COUNT,
  PROMPT_TAG_MAX_LENGTH,
  removePromptTag,
} from './promptTags';

describe('normalizePromptTag', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizePromptTag('  foo  ')).toBe('foo');
  });
});

describe('isValidPromptTagLength', () => {
  it('rejects empty and too-long tags', () => {
    expect(isValidPromptTagLength('   ')).toBe(false);
    expect(isValidPromptTagLength('a'.repeat(PROMPT_TAG_MAX_LENGTH))).toBe(
      true,
    );
    expect(isValidPromptTagLength('a'.repeat(PROMPT_TAG_MAX_LENGTH + 1))).toBe(
      false,
    );
  });
});

describe('addPromptTag', () => {
  it('adds a trimmed tag, preserving original casing and order', () => {
    expect(addPromptTag(['a'], '  b  ')).toEqual(['a', 'b']);
  });

  it('does not add an empty or whitespace-only tag', () => {
    expect(addPromptTag(['a'], '   ')).toEqual(['a']);
  });

  it('does not add a tag longer than the max length', () => {
    expect(addPromptTag([], 'a'.repeat(PROMPT_TAG_MAX_LENGTH + 1))).toEqual([]);
  });

  it('rejects duplicates case-insensitively while keeping existing casing', () => {
    expect(addPromptTag(['Foo'], 'foo')).toEqual(['Foo']);
  });

  it('rejects adding beyond the max tag count', () => {
    const full = Array.from(
      { length: PROMPT_TAG_MAX_COUNT },
      (_, i) => `tag-${i}`,
    );
    expect(addPromptTag(full, 'new')).toEqual(full);
  });
});

describe('removePromptTag', () => {
  it('removes the exact tag by value', () => {
    expect(removePromptTag(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});
