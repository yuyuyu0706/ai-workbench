export const DEVELOPER_UI_STATE_CATALOG = [
  {
    target: 'dashboard-page',
    label: 'Dashboard Page',
    states: [
      { state: 'loading', label: 'Loading' },
      { state: 'empty', label: 'Empty' },
      { state: 'failure', label: 'Failure' },
    ],
  },
  {
    target: 'prompt-library-page',
    label: 'Prompt Library Page',
    states: [
      { state: 'loading', label: 'Loading' },
      { state: 'empty', label: 'Empty' },
      { state: 'failure', label: 'Failure' },
    ],
  },
  {
    target: 'prompt-editor-page',
    label: 'Prompt Editor Page',
    states: [
      { state: 'loading', label: 'Loading' },
      { state: 'not-found', label: 'Not found' },
      { state: 'failure', label: 'Failure' },
      { state: 'submitting', label: 'Submitting' },
      { state: 'save-failure', label: 'Save failure' },
    ],
  },
  {
    target: 'new-trail-form',
    label: 'New Trail Form',
    states: [
      { state: 'submitting', label: 'Submitting' },
      { state: 'save-failure', label: 'Save failure' },
    ],
  },
  {
    target: 'run-detail-page',
    label: 'Run Detail Page',
    states: [
      { state: 'loading', label: 'Loading' },
      { state: 'not-found', label: 'Not found' },
      { state: 'failure', label: 'Failure' },
    ],
  },
  {
    target: 'run-detail-link-form',
    label: 'Run Detail Link Form',
    states: [
      { state: 'submitting', label: 'Submitting' },
      { state: 'save-failure', label: 'Save failure' },
    ],
  },
  {
    target: 'run-detail-link-delete',
    label: 'Run Detail Link Delete',
    states: [
      { state: 'confirming', label: 'Confirming' },
      { state: 'deleting', label: 'Deleting' },
      { state: 'delete-failure', label: 'Delete failure' },
    ],
  },
] as const;

type CatalogEntry = (typeof DEVELOPER_UI_STATE_CATALOG)[number];

export type DeveloperUiStateOverride = CatalogEntry extends infer Entry
  ? Entry extends CatalogEntry
    ? {
        readonly target: Entry['target'];
        readonly state: Entry['states'][number]['state'];
      }
    : never
  : never;

export function isDeveloperUiStateOverride(
  value: unknown,
): value is DeveloperUiStateOverride {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.target !== 'string' ||
    typeof candidate.state !== 'string'
  ) {
    return false;
  }

  return DEVELOPER_UI_STATE_CATALOG.some(
    (entry) =>
      entry.target === candidate.target &&
      entry.states.some(({ state }) => state === candidate.state),
  );
}
