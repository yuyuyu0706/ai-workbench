# PromptTrail Overview

PromptTrail は、AI を活用した知的生産・開発作業における Project、Prompt、Context、Recipe、Run、Link の 6 モデルを管理し、依頼から成果物までの Trail を追跡するためのローカルファーストなワークベンチです。

```text
Prompt / Context
      ↓
    Recipe
      ↓
      Run
      ↓
Chat → Issue → PR → Commit / Release
```

## 目的

PromptTrail の目的は、AI との会話、開発依頼、GitHub Issue、PR、成果物が分散しやすい課題を解決することです。

Prompt を保存するだけではなく、背景情報、制約、設計原則、実行履歴、成果へのつながりを再利用可能な作業資産として残します。これにより、ChatGPT による構想整理、GitHub Issue 化、Codex への実装依頼、PR 確認という流れを一本の Trail として辿れるようにします。

## 解決したい課題

- AI との会話、Issue、PR、Commit、資料が別々の場所に残り、後から関係性を追いにくい。
- 過去にうまくいった依頼文や背景情報を、次の作業で再利用しにくい。
- Prompt の改善履歴だけでは、どの成果物につながったかを判断しにくい。
- GitHub 運用において、Chat で決めた内容と Issue／PR の対応関係が失われやすい。
- AI への依頼品質を高めるための Context や Recipe が個人の記憶に依存しやすい。

## 想定利用者

- ChatGPT や Codex を使って設計、実装、レビュー、ドキュメント作成を行う開発者。
- GitHub Issue や PR を中心に、AI 活用の履歴と成果を整理したい個人開発者。
- プロンプト、背景情報、依頼テンプレートを再利用可能な資産として育てたいユーザー。
- ローカルファーストに作業記録を管理し、必要に応じて外部リンクだけを紐付けたいユーザー。

## 基本コンセプト

PromptTrail は、AI への依頼を一回限りのテキストではなく、次の作業へ活かせる Trail として扱います。

- **Prompt / Context**: 依頼テンプレートと背景情報を分けて管理する。
- **Recipe**: Prompt と Context を組み合わせ、用途ごとの作業レシピとして保存する。
- **Run**: 実際に生成・利用した依頼を、実行時点のスナップショットとして残す。
- **Link**: Chat、Issue、PR、Commit、Document などの外部接続を Run に紐付ける。
- **Trail**: Chat → Issue → PR → Commit / Release の流れを後から辿れるようにする。

### 再利用資産と作業証跡の境界

- **Prompt** は現在利用可能な再利用資産であり、タイトル、本文、Prompt 種別を編集し、不要になれば論理削除できます。
- **Run の Prompt Snapshot** は実行時点の証跡です。元の Prompt を編集・削除しても変更・削除しません。
- **Prompt タイトル**は再利用する依頼資産の名前、**Trail 名**は個別作業記録の名前です。
- **Prompt 種別**は AI への依頼内容、**Trail 種別**は今回行った作業の用途を表します。
- Prompt Library からの利用は同じ Prompt 資産の反復利用です。過去 Run からの再利用は、過去 Snapshot を初期値として新しい Prompt 資産と Run を派生させる別の体験です。

## 管理対象

| 管理対象 | 役割                                       |
| -------- | ------------------------------------------ |
| Project  | 作業資産を束ねる単位                       |
| Prompt   | 再利用可能な依頼テンプレート               |
| Context  | 背景、制約、設計原則                       |
| Recipe   | Prompt と Context を組み合わせた作業レシピ |
| Run      | 実際に生成・利用した依頼の記録             |
| Link     | Chat、Issue、PR、資料などの外部接続        |

## Public Alpha の現在地

**Phase 1: Validation Release は完了済み**です。最小の Trail を作り再利用できる Public Alpha を Azure Static Web Apps Public Preview へ公開し、自己利用、初期利用者への案内、最初の Feedback 受領まで進みました。

- Project を選択する、または既定 Project を利用する。
- Prompt を入力、保存、表示、コピーする。
- Prompt から Run を作成し、実行時 Prompt をスナップショットとして保存する。
- Chat、Issue、PR、Commit、Document の URL を Link として手動登録する。
- Run 内で AI 依頼から成果物までの Trail を確認する。
- 過去 Run の Prompt Snapshot から新しい Prompt と Run を派生させる。
- Public Alpha Guide、Global Navigation、保存制約、Feedback Issue Form を提供する。
- Developer Data Scenario と UI State Override を開発・受入に利用し、通常 Production には露出しない。

Public Alpha は Local-first / IndexedDB の保存境界で動作します。origin ごとにデータは分かれ、端末間同期や Cloud Sync は行いません。この制約は利用者へ明示します。

## Phase 2: Validation Readiness & User Validation

Phase 2 は **`Validation Readiness → User Validation → Prioritize`** の順で進めます。前半では利用観察を妨げる不足を MVP の必須補完として実装し、Hosted 環境で統合受入します。

- Prompt Library の実データ一覧と簡易検索、Prompt の登録・編集・論理削除。
- 同じ Prompt 資産から複数の Run / Trail を作成する反復利用。
- Prompt 削除後も過去 Run、Link、不変な Prompt Snapshot を維持する契約。復元は Phase 3 候補とする。
- Run に独立した Trail 名・Trail 種別を追加し、既存 Run を `trailTitle = promptSnapshot.title`、`trailKind = other` 相当へ migration する。
- New Trail での Trail 情報設定と Run Detail での変更。
- Dashboard から 6 件目以降へ到達する導線と、Dashboard / Run Detail の Status、日時、見出し等の表示統一。
- Prompt Library を利用可能になった時点で主要 Navigation へ戻し、未完成の Context Library / Recipe Builder は主要 Navigation に表示しない。

Phase 2 後半では、Prompt の事前登録・改善・反復利用、同一 Prompt から複数 Trail を作る体験、過去 Run からの派生との違い、Trail の識別と再発見、Prompt 削除後の理解、初回・2 件目・離脱箇所を観察します。

## Public Alpha 後の進め方

Phase 3 は Prompt 復元・版管理・高度な検索・絞り込み、Context Library、Recipe Builder 等から、Phase 2 の利用証拠が示す対象だけを選択実装します。Phase 4 では GitHub Integration を深め、Phase 5 では Productization & Administration として複数の利用者像・契約・権限・習熟度に対応します。Guest / Plus / Pro の Plan / Entitlement、Admin / Member の Authorization Role、Simple / Standard / Advanced の Persona / Experience は別軸として扱います。

## 関連ドキュメント

- [Functional Requirements](functional-requirements.md)
- [Roadmap](roadmap.md)
- [PromptTrail Phase 0 Technical Baseline](../../architecture/prompt-trail/README.md)
- [Application Architecture](application-architecture.md)
- [PromptTrail Data Model](../../architecture/prompt-trail/data-model.md)
- [品質ゲートと開発運用](../../development/quality-gates.md)
- [Deployment and Hosted Preview](deployment-and-preview.md)
- [Screen Structure and User Flow](screen-transition.md)
- [ADR 0001: AI Workbench Monorepo](../../adr/0001-ai-workbench-monorepo.md)
