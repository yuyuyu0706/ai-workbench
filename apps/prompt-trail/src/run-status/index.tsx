import type { RunStatus } from '../domain';

import { RUN_STATUS_LABELS } from './run-status-labels';

export { RUN_STATUS_LABELS } from './run-status-labels';

export function RunStatusPin({ status }: { status: RunStatus }) {
  return (
    <span className={`pt-status-pin pt-status-pin--${status}`}>
      {RUN_STATUS_LABELS[status]}
    </span>
  );
}
