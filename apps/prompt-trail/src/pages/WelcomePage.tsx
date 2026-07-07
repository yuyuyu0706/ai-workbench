const trailModels = [
  {
    name: 'Prompt',
    description: 'AIへ何を依頼したのかを、再利用できる入力資産として残します。',
  },
  {
    name: 'Context',
    description:
      'Issue、仕様、制約、判断材料など、依頼の背景をひとまとまりで扱います。',
  },
  {
    name: 'Recipe',
    description:
      '成果につながった依頼手順を、次回もたどれる作業テンプレートにします。',
  },
  {
    name: 'Run',
    description:
      '実行ごとの入力、結果、気づきを記録し、改善の履歴を追えるようにします。',
  },
  {
    name: 'Link',
    description:
      'Chat、Issue、PR、成果物を結び、AI作業の流れを一本のTrailとして見返します。',
  },
];

export function WelcomePage() {
  return (
    <main className="welcome-page" aria-labelledby="welcome-title">
      <section className="welcome-hero" aria-describedby="welcome-lead">
        <p className="welcome-eyebrow">AI Workbench / PromptTrail</p>
        <h1 id="welcome-title">
          AIへの依頼から成果までを、再利用できるTrailに。
        </h1>
        <p id="welcome-lead" className="welcome-lead">
          PromptTrailは、プロンプト、背景コンテキスト、実行結果、成果物へのリンクを整理し、
          チームが同じ成功パターンをもう一度たどれるようにするワークベンチです。
        </p>
      </section>

      <section className="welcome-section" aria-labelledby="model-title">
        <div className="section-heading">
          <p className="section-kicker">Management model</p>
          <h2 id="model-title">Trailを構成する5つの記録</h2>
          <p>
            Phase
            0では実データや操作機能を持たず、後続実装で扱う情報の単位を初期画面で共有します。
          </p>
        </div>
        <ul className="model-list" aria-label="PromptTrail management model">
          {trailModels.map((model) => (
            <li className="pt-card model-card" key={model.name}>
              <h3>{model.name}</h3>
              <p>{model.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="welcome-grid"
        aria-label="PromptTrail assumptions and current phase"
      >
        <article className="pt-card info-card">
          <p className="section-kicker">Local first</p>
          <h2>まずは手元の作業資産として安全に育てる</h2>
          <p>
            PromptTrailはローカルファーストを前提に、AI作業の試行錯誤を個人やチームの手元で扱える形へ整えます。
            共有や連携は、保存モデルと画面導線が定まった後続フェーズで検討します。
          </p>
        </article>
        <article className="pt-card info-card phase-card">
          <p className="section-kicker">Phase 0</p>
          <h2>現在地はアプリ基盤と初期画面の整備</h2>
          <p>
            この画面は、Router、状態管理、IndexedDB、CRUD、検索、AI実行をまだ含まない静的なWelcome
            Pageです。
            次の開発が迷わず進められるよう、最小構造と責務境界だけを先に整えています。
          </p>
        </article>
      </section>
    </main>
  );
}
