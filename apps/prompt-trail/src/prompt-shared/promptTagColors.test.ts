import { describe, expect, it } from 'vitest';

import { PROMPT_TAG_COLOR_COUNT, promptTagColorIndex } from './promptTagColors';

describe('promptTagColorIndex', () => {
  it('returns the same index for the same tag name every time', () => {
    expect(promptTagColorIndex('チャット相談')).toBe(
      promptTagColorIndex('チャット相談'),
    );
    expect(promptTagColorIndex('note')).toBe(promptTagColorIndex('note'));
  });

  it('always returns a value in 0..PROMPT_TAG_COLOR_COUNT - 1', () => {
    const tags = [
      'a',
      'ab',
      'ba',
      'チャット相談',
      '計設',
      '設計',
      '',
      'z'.repeat(50),
    ];
    for (const tag of tags) {
      const index = promptTagColorIndex(tag);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(PROMPT_TAG_COLOR_COUNT);
    }
  });

  it('can change the index when characters are reordered, unlike a sum-of-char-codes hash', () => {
    // "ab" and "ba" share the same character codes, so a naive
    // sum-of-char-codes hash would collide on them. FNV-1a is
    // order-sensitive, so they resolve to different indices here.
    expect(promptTagColorIndex('ab')).not.toBe(promptTagColorIndex('ba'));
  });

  it('does not throw for an empty string', () => {
    expect(() => promptTagColorIndex('')).not.toThrow();
    const index = promptTagColorIndex('');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(PROMPT_TAG_COLOR_COUNT);
  });
});
