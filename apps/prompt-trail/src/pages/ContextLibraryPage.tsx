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
        title="Context資産を登録する前の利用開始状態です。"
        description="まだRepositoryからContextを取得しないため、AI作業へ渡す背景・制約・前提を整理する場所だけを静的に示します。P0-5以降でRepository連携後のempty stateと作成導線へ置き換えます。"
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
