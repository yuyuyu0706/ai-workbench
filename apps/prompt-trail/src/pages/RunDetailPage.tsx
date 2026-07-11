import { Link, useParams } from 'react-router-dom';

import { routePaths } from '../app/routes';
import { PageHeader, PageSection, StateMessage } from '../components/ui';

const runDetailSections = [
  {
    title: '実行サマリ',
    description:
      '実行したAI作業の目的、状態、確認すべき観点を振り返る領域です。',
  },
  {
    title: '使用したRecipe',
    description: 'Runで利用したRecipeの構成を確認するための領域です。',
  },
  {
    title: 'Prompt Snapshot',
    description: '実行時点でAIへ渡したPromptの内容を固定して振り返る領域です。',
  },
  {
    title: 'Context Snapshot',
    description:
      '実行時点でAIへ渡した背景、制約、前提を固定して振り返る領域です。',
  },
  {
    title: '成果物 / Link',
    description:
      'Runから得られた成果物や参照Linkを、Run Detail内で確認するための領域です。',
  },
  {
    title: '評価',
    description: '実行結果の良し悪しや再利用可否を記録するための領域です。',
  },
  {
    title: '改善メモ',
    description:
      '次回のPrompt、Context、Recipe改善につなげる気づきを置く領域です。',
  },
] as const;

export function RunDetailPage() {
  const { runId } = useParams();
  const normalizedRunId = runId ?? 'unknown';

  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Run Detail"
        title="Run Detail"
        description={`Run ${normalizedRunId} の入力、成果物、評価を含めて振り返る画面です。`}
      />
      <StateMessage
        variant="empty"
        title="Runを振り返る前の利用開始状態です。"
        description="まだRepositoryからRun履歴を取得しないため、振り返りに必要な領域だけを静的に示します。P0-5以降でRepository連携後のempty / failure stateと実データ表示へ置き換えます。"
      />
      <div className="prompt-trail-page__sections">
        {runDetailSections.map((section) => (
          <PageSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            <p>
              この領域は後続Issueで実データ表示へ差し替えるための器です。CRUD、検索、疑似データ表示はまだ提供しません。
            </p>
          </PageSection>
        ))}
      </div>
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
