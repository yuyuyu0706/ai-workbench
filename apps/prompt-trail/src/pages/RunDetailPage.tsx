import { useParams } from 'react-router-dom';

import { PlaceholderPage } from './PlaceholderPage';

export function RunDetailPage() {
  const { runId } = useParams();

  return (
    <PlaceholderPage
      eyebrow="Run Detail"
      title="Run Detail"
      description={`Run ${runId ?? ''} の詳細導線です。詳細表示は後続Issueで実装します。`}
    />
  );
}
