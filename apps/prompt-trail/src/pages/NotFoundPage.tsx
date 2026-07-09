import { Link } from 'react-router-dom';

import { routePaths } from '../app/routes';
import { PageHeader, StateMessage } from '../components/ui';

export function NotFoundPage() {
  return (
    <section className="placeholder-page">
      <PageHeader
        eyebrow="Not Found"
        title="Not Found"
        description="指定されたURLに対応する画面が見つかりませんでした。Dashboardから操作を再開できます。"
      />
      <StateMessage
        variant="error"
        title="未知のURLです。"
        description="URLを確認するか、Dashboardへ戻ってPromptTrailの操作を続けてください。"
      />
      <div className="placeholder-page__actions">
        <Link
          className="pt-button pt-button--primary"
          to={routePaths.dashboard}
        >
          Dashboardへ戻る
        </Link>
      </div>
    </section>
  );
}
