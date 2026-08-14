import { Link as RouterLink } from 'react-router-dom';

import { buildTrailDetailPath } from '../app/routes';
import { RunStatusPin } from '../run-status';
import type { TrailListItem } from '../trail-list';
import { TRAIL_KIND_LABELS } from '../trail-metadata';

import { formatDateTime } from './date-time';

export function TrailTable({ trails }: { trails: readonly TrailListItem[] }) {
  return (
    <table className="pt-dashboard-runs">
      <thead>
        <tr>
          <th className="pt-dashboard-run-row__trail" scope="col">
            Trail名
          </th>
          <th className="pt-dashboard-run-row__kind" scope="col">
            Trail種別
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
        {trails.map((trailListItem) => (
          <TrailTableRow
            key={trailListItem.trail.id}
            trailListItem={trailListItem}
          />
        ))}
      </tbody>
    </table>
  );
}

function TrailTableRow({ trailListItem }: { trailListItem: TrailListItem }) {
  const { trail, kind, status, updatedAt, linkCount } = trailListItem;

  return (
    <tr className="pt-dashboard-run-row">
      <th className="pt-dashboard-run-row__trail" scope="row">
        <h3 className="pt-dashboard-run-row__title">
          <RouterLink
            className="pt-dashboard-run-row__title-link"
            to={buildTrailDetailPath(trail.id)}
          >
            {trailListItem.trail.title}
          </RouterLink>
        </h3>
      </th>
      <td className="pt-dashboard-run-row__kind">
        <span className="pt-dashboard-run-row__mobile-label">Trail種別</span>
        <span>{TRAIL_KIND_LABELS[kind]}</span>
      </td>
      <td className="pt-dashboard-run-row__status">
        <span className="pt-dashboard-run-row__mobile-label">ステータス</span>
        <RunStatusPin status={status} />
      </td>
      <td className="pt-dashboard-run-row__updated-at">
        <span className="pt-dashboard-run-row__mobile-label">更新日時</span>
        <time dateTime={updatedAt}>{formatDateTime(updatedAt)}</time>
      </td>
      <td className="pt-dashboard-run-row__links">
        <span className="pt-dashboard-run-row__mobile-label">関連リンク</span>
        <span>{linkCount}件</span>
      </td>
    </tr>
  );
}
