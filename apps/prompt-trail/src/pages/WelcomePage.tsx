import { Link } from 'react-router-dom';

import { publicAlphaFeedbackUrl } from '../app/public-alpha';
import { routePaths } from '../app/routes';

const steps = [
  {
    title: '1. Trailを作る',
    description: 'AIへ渡したPromptと実行結果を、ひとつのRunとして記録します。',
  },
  {
    title: '2. Linkを残す',
    description:
      'Chat、Issue、PR、成果物のURLをRunへ結び、経緯をたどれるようにします。',
  },
  {
    title: '3. Promptを再利用する',
    description:
      '過去のRunを出発点にPromptを引き継ぎ、新しいTrailとして改善を続けます。',
  },
];

export function WelcomePage() {
  return (
    <div className="welcome-page" aria-labelledby="welcome-title">
      <section className="welcome-hero" aria-describedby="welcome-lead">
        <p className="welcome-eyebrow">PromptTrail · Public Alpha</p>
        <h1 id="welcome-title">
          AIへの依頼から成果までを、次の仕事に活かせるTrailへ。
        </h1>
        <p id="welcome-lead" className="welcome-lead">
          PromptTrailは、Prompt、実行結果、関連リンクをひとつの流れとして記録し、うまくいった依頼を再利用するためのLocal-firstワークベンチです。
        </p>
        <div className="welcome-actions">
          <Link
            className="pt-button pt-button--primary"
            to={routePaths.dashboard}
          >
            PromptTrailを試す
          </Link>
          <a
            className="pt-button pt-button--secondary"
            href={publicAlphaFeedbackUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Feedbackを送る
          </a>
        </div>
        <p className="welcome-feedback-note">
          Feedbackの送信にはGitHubアカウントが必要です。アプリ内のPrompt、Run、Link、保存データが自動送信されることはありません。
        </p>
      </section>

      <section className="welcome-section" aria-labelledby="steps-title">
        <div className="section-heading">
          <p className="section-kicker">Core flow</p>
          <h2 id="steps-title">3ステップでTrailを育てる</h2>
        </div>
        <ol className="model-list" aria-label="PromptTrailの使い方">
          {steps.map((step) => (
            <li className="pt-card model-card" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="welcome-section" aria-labelledby="storage-title">
        <article className="pt-card info-card welcome-storage">
          <p className="section-kicker">保存とセキュリティ</p>
          <h2 id="storage-title">Public Alphaを試す前にご確認ください</h2>
          <ul>
            <li>
              データは、現在のbrowser origin単位のIndexedDBに保存されます。
            </li>
            <li>browser、端末、originをまたいだ同期は行われません。</li>
            <li>
              browser
              storageの削除や環境の変更により、データを失う可能性があります。
            </li>
            <li>Backup、Restore、Cloud Syncには対応していません。</li>
            <li>機密情報、個人情報、API Key、Tokenを入力しないでください。</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
