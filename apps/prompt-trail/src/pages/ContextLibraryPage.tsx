import { PageHeader, PageSection, StateMessage } from '../components/ui';

const contextLibrarySections = [
  {
    title: 'Context資産',
    description:
      'AIへ渡す背景、制約、前提を再利用可能な資産として置く領域です。',
  },
  {
    title: '背景・制約・前提の整理',
    description:
      '単なるメモではなく、AI作業の入力として再利用する情報の種類を整理する領域です。',
  },
  {
    title: '分類・検索予定',
    description:
      'Contextを探しやすくする分類、検索、タグ、フィルタは後続Issueで検討します。',
  },
  {
    title: 'Recipeへの接続',
    description:
      'Context資産をRecipe BuilderやRunへ渡すための接続点を示す領域です。',
  },
] as const;

export function ContextLibraryPage() {
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Context Library"
        title="Context Library"
        description="AIへ渡す背景、制約、前提を再利用可能な資産として整理する画面です。"
      />
      <StateMessage
        variant="empty"
        title="まだContext資産は表示しません。"
        description="この画面では、AI作業に渡す背景情報を整理する場所だけを静的に示します。実データ表示、作成、編集、検索はP0-5以降で扱います。"
      />
      <div className="prompt-trail-page__sections">
        {contextLibrarySections.map((section) => (
          <PageSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            <p>
              この領域は後続Issueで具体的なContext管理機能へ置き換えるための器です。CRUD、検索、タグ、フィルタは実装していません。
            </p>
          </PageSection>
        ))}
      </div>
    </section>
  );
}
