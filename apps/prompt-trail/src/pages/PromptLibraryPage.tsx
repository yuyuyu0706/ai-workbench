import { PageHeader, PageSection, StateMessage } from '../components/ui';

const promptLibrarySections = [
  {
    title: 'Prompt資産',
    description:
      'よく使うAIへの依頼パターンを再利用可能な資産として置く領域です。',
  },
  {
    title: '分類・検索予定',
    description:
      'Promptを探しやすくする分類、検索、タグ、フィルタは後続Issueで検討します。',
  },
  {
    title: '作成導線予定',
    description:
      '新規Prompt作成や編集導線はまだ動かさず、今後の実装予定として場所だけを示します。',
  },
  {
    title: 'Recipeへの接続',
    description:
      'Prompt資産をRecipe Builderで利用するための接続点を示す領域です。',
  },
] as const;

export function PromptLibraryPage() {
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Prompt Library"
        title="Prompt Library"
        description="よく使うAIへの依頼パターンを資産化し、再利用するための画面です。"
      />
      <StateMessage
        variant="empty"
        title="まだPrompt資産は表示しません。"
        description="この画面では、依頼テンプレートを蓄積する場所だけを静的に示します。実データ表示、作成、編集、検索はP0-5以降で扱います。"
      />
      <div className="prompt-trail-page__sections">
        {promptLibrarySections.map((section) => (
          <PageSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            <p>
              この領域は後続Issueで具体的なPrompt管理機能へ置き換えるための器です。CRUD、検索、タグ、フィルタは実装していません。
            </p>
          </PageSection>
        ))}
      </div>
    </section>
  );
}
