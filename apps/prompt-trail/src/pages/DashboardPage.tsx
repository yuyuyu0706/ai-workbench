import { PageHeader, PageSection, StateMessage } from '../components/ui';

const dashboardSections = [
  {
    title: '最近のRun',
    description:
      'AI作業の実行履歴を確認する領域です。P0-5以降でRepository経由の実データ表示に置き換えます。',
  },
  {
    title: '再開ポイント',
    description:
      '途中で止めた作業や次に確認したい作業の入口を整理する領域です。',
  },
  {
    title: '未整理Link',
    description:
      'RunやRecipeへ接続する前の参照情報を見失わないための領域です。',
  },
  {
    title: '次にやること',
    description: '作業再開時に確認すべき次の行動を示す領域です。',
  },
] as const;

export function DashboardPage() {
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description="AI作業の再開入口として、最近の活動・未整理事項・次の行動を確認する画面です。"
      />
      <StateMessage
        variant="empty"
        title="ここからAI作業を再開するための静的な画面骨格です。"
        description="現時点では実データを表示せず、P0-5以降でRepository経由のRun、Link、再開情報に置き換える予定です。"
      />
      <div className="prompt-trail-page__sections">
        {dashboardSections.map((section) => (
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
    </section>
  );
}
