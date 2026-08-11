import { describe, expect, it } from 'vitest';

import {
  DEVELOPER_UI_STATE_CATALOG,
  isDeveloperUiStateOverride,
} from './catalog';

describe('developer UI state catalog', () => {
  it('contains unique targets, states, and every supported combination', () => {
    expect(DEVELOPER_UI_STATE_CATALOG).toHaveLength(10);
    expect(
      new Set(DEVELOPER_UI_STATE_CATALOG.map(({ target }) => target)).size,
    ).toBe(DEVELOPER_UI_STATE_CATALOG.length);

    for (const entry of DEVELOPER_UI_STATE_CATALOG) {
      expect(new Set(entry.states.map(({ state }) => state)).size).toBe(
        entry.states.length,
      );
      for (const { state } of entry.states) {
        expect(
          isDeveloperUiStateOverride({ target: entry.target, state }),
        ).toBe(true);
      }
    }
  });

  it('rejects malformed values and unsupported target/state combinations', () => {
    expect(isDeveloperUiStateOverride(null)).toBe(false);
    expect(isDeveloperUiStateOverride({})).toBe(false);
    expect(
      isDeveloperUiStateOverride({ target: 'unknown', state: 'loading' }),
    ).toBe(false);
    expect(
      isDeveloperUiStateOverride({
        target: 'new-trail-form',
        state: 'loading',
      }),
    ).toBe(false);
  });
});
