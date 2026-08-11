import { Link as RouterLink } from 'react-router-dom';

import { buildRunDetailPath } from '../app/routes';
import type { DashboardRecentRun } from '../dashboard';
import type { RunStatus } from '../domain';

import { formatDateTime } from './date-time';

export function RunTable({ runs }: { runs: readonly DashboardRecentRun[] }) {
  return (
    <table className="pt-dashboard-runs">
      <thead>
        <tr>
          <th className="pt-dashboard-run-row__trail" scope="col">
            Trail名
          </th>
          <th className="pt-dashboard-run-row__status" scope="col">
            ステータス
          </th>
          <th className="pt-dashboard-run-row__updated-at" scope="col">
            更新日時
          </th>
          <th className="pt-dashboard-run-row__links" scope="col">
            関連リンク
          </th>
        </tr>
      </thead>
      <tbody>
        {runs.map((recentRun) => (
          <RunTableRow key={recentRun.run.id} recentRun={recentRun} />
        ))}
      </tbody>
    </table>
  );
}

function RunTableRow({ recentRun }: { recentRun: DashboardRecentRun }) {
  const { run, links } = recentRun;

  return (
    <tr className="pt-dashboard-run-row">
      <th className="pt-dashboard-run-row__trail" scope="row">
        <h3 className="pt-dashboard-run-row__title">
          <RouterLink
            className="pt-dashboard-run-row__title-link"
            to={buildRunDetailPath(run.id)}
          >
            {run.promptSnapshot.title}
          </RouterLink>
        </h3>
      </th>
      <td className="pt-dashboard-run-row__status">
        <span className="pt-dashboard-run-row__mobile-label">ステータス</span>
        <RunStatusPin status={run.status} />
      </td>
      <td className="pt-dashboard-run-row__updated-at">
        <span className="pt-dashboard-run-row__mobile-label">更新日時</span>
        <time dateTime={run.updatedAt}>{formatDateTime(run.updatedAt)}</time>
      </td>
      <td className="pt-dashboard-run-row__links">
        <span className="pt-dashboard-run-row__mobile-label">関連リンク</span>
        <span>{links.length}件</span>
      </td>
    </tr>
  );
}

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  draft: '下書き',
  prepared: '準備済み',
  'in-progress': '実行中',
  executed: '実行済み',
  done: '完了',
};

function RunStatusPin({ status }: { status: RunStatus }) {
  return (
    <span className={`pt-status-pin pt-status-pin--${status}`}>
      {RUN_STATUS_LABELS[status]}
    </span>
  );
}
