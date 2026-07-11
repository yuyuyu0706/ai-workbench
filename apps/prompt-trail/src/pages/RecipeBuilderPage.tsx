import { PageHeader, PageSection, StateMessage } from '../components/ui';

const recipeBuilderSections = [
  {
    title: 'Prompt選択',
    description: 'AIへ依頼する内容の候補をRecipeへ接続するための領域です。',
  },
  {
    title: 'Context選択',
    description:
      'AIへ渡す背景、制約、前提の候補をRecipeへ接続するための領域です。',
  },
  {
    title: 'Recipe組み立て',
    description:
      'PromptとContextを組み合わせ、再利用可能なAI作業手順として整理する領域です。',
  },
  {
    title: '実行準備',
    description:
      '組み立てたRecipeをRunへ渡す前に、入力や確認事項を見渡す領域です。',
  },
] as const;

export function RecipeBuilderPage() {
  return (
    <section className="prompt-trail-page">
      <PageHeader
        eyebrow="Recipe Builder"
        title="Recipe Builder"
        description="PromptとContextを組み合わせ、AI作業手順を組み立てる画面です。"
      />
      <StateMessage
        variant="empty"
        title="Recipeを組み立てる前の利用開始状態です。"
        description="まだRepositoryからPromptやContextを取得しないため、AI作業を組み立てる静的な骨格だけを示します。Prompt選択、Context選択、保存、実行の実動作はP0-5以降で扱います。"
      />
      <div className="prompt-trail-page__sections">
        {recipeBuilderSections.map((section) => (
          <PageSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            <p>
              この領域は後続Issueで実データや操作導線へ置き換えるための器です。CRUD、検索、タグ、フィルタ、保存、実行は実装していません。
            </p>
          </PageSection>
        ))}
      </div>
    </section>
  );
}
