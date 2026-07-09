import { PageHeader, StateMessage } from '../components/ui';

export interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section className="placeholder-page" aria-labelledby="placeholder-title">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <StateMessage
        variant="empty"
        title="P0-4-3で画面骨格を実装予定です。"
        description="このIssueでは共通レイアウトとルーティング導線を確認するための最小placeholderに留めています。"
      />
    </section>
  );
}
