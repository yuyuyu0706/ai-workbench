import { Link, useParams } from 'react-router-dom';

import { routePaths } from '../app/routes';
import { PageHeader, StateMessage } from '../components/ui';

export function RunDetailPage() {
  const { runId } = useParams();
  const normalizedRunId = runId ?? 'unknown';

  return (
    <section className="placeholder-page">
      <PageHeader
        eyebrow="Run Detail"
        title="Run Detail"
        description={`Run ${normalizedRunId} の詳細導線です。詳細表示は後続Issueで実装します。`}
      />
      <StateMessage
        variant="empty"
        title={`Run ${normalizedRunId} の詳細placeholderです。`}
        description="Snapshot、成果物、評価、Timelineなどの本格表示は後続Issueで扱います。"
      />
      <div className="placeholder-page__actions">
        <Link
          className="pt-button pt-button--secondary"
          to={routePaths.dashboard}
        >
          Dashboardへ戻る
        </Link>
      </div>
    </section>
  );
}
