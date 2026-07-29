import { describe, expect, expectTypeOf, it } from 'vitest';

import { selectActiveDeveloperUiState } from './select-active-override';
import type { DeveloperUiStateSnapshot } from './store';

describe('selectActiveDeveloperUiState', () => {
  it('returns null when Developer Tools are disabled or no override is active', () => {
    expect(selectActiveDeveloperUiState(null, 'dashboard-page')).toBeNull();
    expect(
      selectActiveDeveloperUiState({ activeOverride: null }, 'dashboard-page'),
    ).toBeNull();
  });

  it('returns only a matching target state', () => {
    const snapshot: DeveloperUiStateSnapshot = {
      activeOverride: { target: 'new-trail-form', state: 'submitting' },
    };

    expect(selectActiveDeveloperUiState(snapshot, 'new-trail-form')).toBe(
      'submitting',
    );
    expect(selectActiveDeveloperUiState(snapshot, 'dashboard-page')).toBeNull();
  });

  it('preserves the target-specific state type', () => {
    const state = selectActiveDeveloperUiState(null, 'run-detail-link-delete');

    expectTypeOf(state).toEqualTypeOf<
      'confirming' | 'deleting' | 'delete-failure' | null
    >();
  });
});
