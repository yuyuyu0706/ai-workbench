# AI Workbench / PromptTrail

## 機能要件・リポジトリ構成・実装ロードマップ（更新版）

## 1. プロダクト全体像

| 項目              | 内容                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| GitHubリポジトリ  | `ai-workbench`                                                                     |
| 最初のアプリ      | `PromptTrail`                                                                      |
| 配置先            | `apps/prompt-trail`                                                                |
| コンセプト        | AIを活用した知的生産・開発作業を、設計し、実行し、追跡し、再利用するためのツール群 |
| PromptTrailの役割 | Prompt・Context・Runを管理し、Chat・Issue・PR・成果物までの足跡を辿れるようにする  |

PromptTrailは、単なるプロンプト集ではない。

AIへの依頼を起点に、設計相談、GitHub Issue、Codexへの実装依頼、Pull Request、リリース成果までをつなぎ、再利用可能な作業資産として蓄積する。

```text
Prompt / Context
      ↓
    Recipe
      ↓
      Run
      ↓
Chat → Issue → PR → Commit / Release
```

---

## 2. リポジトリ方針

### 2-1. AI Workbenchを母艦とする

`ai-workbench` は、AIを使った開発・設計・業務効率化に関するアプリを育てるためのモノレポとする。

ただし、初期段階では共通パッケージや複雑なビルド最適化を作らない。

```text
ai-workbench/
├─ apps/
│  └─ prompt-trail/
│
├─ docs/
│  ├─ product/
│  │  └─ prompt-trail/
│  ├─ architecture/
│  └─ adr/
│
├─ .github/
│  ├─ ISSUE_TEMPLATE/
│  └─ workflows/
│
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
└─ README.md
```

### 2-2. 共通パッケージは後から作る

次のような重複が、2アプリ以上で実際に生じた時点で初めて切り出す。

```text
packages/
├─ ui/
├─ storage/
├─ github-client/
└─ test-kit/
```

現時点では、`apps/prompt-trail` の中に閉じた構成とする。

---

## 3. 技術スタック方針

### 3-1. 採用方針

| 領域           | 採用候補                 | 方針                                                                         |
| -------------- | ------------------------ | ---------------------------------------------------------------------------- |
| 言語           | TypeScript               | ドメインモデル、データ移行、外部リンク管理の型安全性を確保する               |
| UI             | React                    | 複数画面、フォーム、状態遷移、一覧・詳細画面に適したコンポーネント設計を学ぶ |
| ビルド         | Vite                     | 軽量なSPAとして開発・配布する                                                |
| パッケージ管理 | pnpm Workspace           | 将来の複数アプリ構成に備える                                                 |
| ローカルDB     | IndexedDB + Dexie        | Prompt、Run、Linkなどの構造化データをローカルファーストで保持する            |
| 画面遷移       | React Router             | Library、Builder、Run Detailなどの画面をURLで扱う                            |
| 単体テスト     | Vitest + Testing Library | ドメインロジック、データ変換、画面コンポーネントを検証する                   |
| E2Eテスト      | Playwright               | 実際の利用フローを回帰テストする                                             |
| 静的解析・整形 | ESLint + Prettier        | TypeScript／React開発の品質基盤とする                                        |
| 配布           | 静的ホスティング         | MVPはバックエンドなしで公開・利用可能にする                                  |

DexieはIndexedDB上のテーブルとインデックスを定義でき、React向けのライブクエリも提供しているため、PromptTrailのローカルファーストなデータ管理と相性がよい。

### 3-2. 意図的に採用しないもの

| 対象                     | 当面採用しない理由                                         |
| ------------------------ | ---------------------------------------------------------- |
| バックエンドAPI          | MVPでは個人利用・ローカル保存を優先する                    |
| 認証基盤                 | GitHub API連携が必要になるPhase 4まで見送る                |
| クラウドDB               | 個人のPromptやChatリンクを不用意に外部保存しない           |
| Turborepo等の追加基盤    | アプリが1本の間はpnpm Workspaceで十分                      |
| 共通UIパッケージ         | 2本目のアプリが生まれるまで不要                            |
| ChatGPT／Codexの直接実行 | 認証・監査・ログ管理が重く、まず依頼品質と追跡性に集中する |

---

## 4. PromptTrailの管理モデル

| 管理単位 | 役割                                    | 例                                  |
| -------- | --------------------------------------- | ----------------------------------- |
| Project  | 作業資産を束ねる単位                    | `quiz-practice`、`Azure Databricks` |
| Prompt   | 再利用可能な依頼テンプレート            | Codex向け開発依頼書                 |
| Context  | 背景、制約、設計原則                    | リポジトリ構成、Issue粒度方針       |
| Recipe   | PromptとContextを組み合わせた作業レシピ | Lv3 Issue作成                       |
| Run      | 実際に生成・利用した依頼の記録          | Issue #123向け開発依頼              |
| Link     | Chat、Issue、PR、資料などの外部接続     | ChatGPT会話、GitHub PR              |

### 4-1. データ関係

```text
Project
 ├─ Prompts
 ├─ Contexts
 ├─ Recipes
 │   ├─ Prompt × 1
 │   └─ Contexts × N
 └─ Runs
     ├─ Recipe × 1
     ├─ Prompt Snapshot
     ├─ Context Snapshots × N
     ├─ Input Values
     └─ Links × N
```

### 4-2. Runを証跡の中心に置く

PromptやContextは更新されるため、Runには実行時点の内容をスナップショットとして保存する。

これにより、後からPromptが改善されても、過去のIssueやPRがどの依頼内容を基に生まれたかを再現できる。

---

## 5. 機能要件

### 5-1. Project管理

| 機能        | 要件                                                      |
| ----------- | --------------------------------------------------------- |
| Project作成 | 名前、説明、タグ、関連リポジトリURLを登録できる           |
| Project切替 | Project単位でPrompt、Context、Recipe、Runを切り替えられる |
| 共通資産    | 全Projectで利用可能なPrompt・Contextを管理できる          |
| アーカイブ  | 終了済みProjectを削除せず、閲覧専用として保持できる       |
| Project検索 | 名前、タグ、リポジトリ名で絞り込める                      |

---

### 5-2. Prompt管理

| 機能       | 要件                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| 作成・編集 | Markdown形式でPromptを作成・更新できる                                 |
| 種別       | Chat相談、Codex依頼、Issue作成、設計レビュー、障害解析などを設定できる |
| 変数       | `{{background}}` のような入力変数を定義できる                          |
| タグ       | 技術領域、対象AI、用途、重要度などで分類できる                         |
| 状態       | Draft / Active / Deprecated を設定できる                               |
| 複製       | 既存Promptから派生版を作れる                                           |
| 版管理     | 更新履歴を保持し、過去版を閲覧・復元できる                             |
| 検索       | タイトル、本文、タグ、種別で検索できる                                 |

```md
# 開発依頼

## 背景

{{background}}

## 実装対象

{{scope}}

## 完了条件

{{definition_of_done}}

## テスト要件

{{test_requirements}}

## 制約事項

{{constraints}}
```

---

### 5-3. Context管理

| 機能        | 要件                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| 作成・編集  | Markdown形式で背景・制約・ルールを登録できる                               |
| 種別        | プロジェクト概要、技術構成、開発ルール、用語集、出力ルールなどで分類できる |
| 適用範囲    | 共通、Project共通、Recipe専用を設定できる                                  |
| 適用順序    | 複数Contextの差し込み順を制御できる                                        |
| 有効・無効  | 古いContextを削除せず、利用停止にできる                                    |
| 使用量表示  | 文字数・推定トークン数を表示できる                                         |
| Run固定保存 | Runでは利用時点のContext本文をスナップショット保存する                     |

---

### 5-4. Recipe Builder

| 機能         | 要件                                                            |
| ------------ | --------------------------------------------------------------- |
| Prompt選択   | RecipeにベースとなるPromptを設定できる                          |
| Context選択  | 複数のContextを選択・並び替えできる                             |
| 変数フォーム | Prompt内の変数をフォーム入力できる                              |
| 入力形式     | 一行、複数行、Markdown、選択肢、URL、チェックボックスを扱える   |
| 初期値       | 完了条件やテスト要件などに既定値を設定できる                    |
| 入力検証     | 必須変数の未入力を警告できる                                    |
| プレビュー   | 最終Promptをリアルタイムで確認できる                            |
| 出力         | コピー、Markdown出力、Issue向けタイトル・本文分割出力を提供する |
| 保存・複製   | Recipeを保存し、別用途に派生できる                              |

### Recipe Builderの基本レイアウト

```text
左：Prompt / Contextの選択
中央：変数入力フォーム
右：最終Promptのプレビュー
下：関連Link、Run保存、コピー、Markdown出力
```

---

### 5-5. Run管理

| 機能             | 要件                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| Run作成          | Recipeから実行記録を作成できる                                           |
| スナップショット | Prompt、Context、入力値、最終Promptを固定保存できる                      |
| 状態             | Draft / Prepared / Executed / In Progress / Done / Archived を設定できる |
| 成果評価         | Good / Needs Improvement / Failed を記録できる                           |
| 改善メモ         | Prompt・Context・Recipeの改善点を残せる                                  |
| 再実行           | 過去Runを複製して新しい依頼を作れる                                      |
| タイムライン     | 作成、出力、Link追加、状態変更を時系列で確認できる                       |

---

## 6. Link機能

LinkはPromptTrailの主要機能であり、単なるURLメモではない。

「何を起点にしたか」「どこで実行したか」「どの成果につながったか」を表す関係データとして扱う。

### 6-1. Link種別

| 種別         | 対象                              | 主な用途                        |
| ------------ | --------------------------------- | ------------------------------- |
| Chat         | ChatGPT共有会話、設計相談チャット | 検討経緯・意思決定の確認        |
| Issue        | GitHub Issue                      | 要求・受入条件・タスク管理      |
| Pull Request | GitHub Pull Request               | 実装結果・レビュー・マージ      |
| Commit       | GitHub Commit                     | 特定変更の確定点                |
| Release      | GitHub Release、Tag               | リリース記録                    |
| Document     | 設計書、Markdown、スライド、Wiki  | 補足資料・成果物                |
| External     | 任意URL                           | Teams、Notion、Azure DevOpsなど |

### 6-2. Linkの役割

| 役割      | 意味                | 例                                   |
| --------- | ------------------- | ------------------------------------ |
| Source    | 検討・依頼の起点    | 設計相談チャット、既存Issue          |
| Reference | 参考にした情報      | 公式ドキュメント、アーキテクチャ資料 |
| Execution | 実行先・作業管理先  | GitHub Issue、Codex依頼              |
| Output    | Runから生まれた成果 | 開発依頼書、仕様書                   |
| Result    | 実装・検証の結果    | PR、Commit、Release                  |

### 6-3. Linkデータ項目

| 項目         | 要件                                                     |
| ------------ | -------------------------------------------------------- |
| URL          | 外部URLを登録できる                                      |
| タイトル     | 表示名を任意設定できる                                   |
| 種別         | Chat、Issue、PR、Documentなどを設定できる                |
| 役割         | Source、Reference、Execution、Output、Resultを設定できる |
| 要約         | 「何のリンクか」「何を決めたか」を短く残せる             |
| 外部ID       | Issue番号、PR番号、Commit SHAなどを保持できる            |
| ステータス   | 手動登録またはGitHub同期で状態を保持できる               |
| 登録日時     | Link追加日時を記録できる                                 |
| 最終確認日時 | 外部情報を最後に確認した日時を記録できる                 |

### 6-4. URL自動判別

MVPでは、URLパターンからLink種別を判定する。

| URL例                         | 自動判別     |
| ----------------------------- | ------------ |
| `github.com/.../issues/...`   | Issue        |
| `github.com/.../pull/...`     | Pull Request |
| `github.com/.../commit/...`   | Commit       |
| `github.com/.../releases/...` | Release      |
| ChatGPT共有リンク             | Chat         |
| その他                        | External     |

初期段階では、タイトル・要約・状態は手動で入力する。

### 6-5. Chat Linkの扱い

ChatGPT会話は、URLだけでは後から文脈が分からなくなりやすい。

そのため、Chat Linkには必ず短い要約を残せるようにする。

```text
タイトル：PromptTrailのPhase 0設計相談
役割：Source
要約：AI Workbenchをモノレポとし、PromptTrailを最初のアプリとして実装する方針を決定。
```

### 6-6. Trail View

Runに紐づくLinkを、時系列または関係図で確認できる画面を提供する。

```text
[Source]
設計相談Chat
    ↓
[Execution]
GitHub Issue #12
    ↓
[Execution]
Codex向け開発依頼
    ↓
[Result]
Pull Request #18
    ↓
[Result]
Release v0.1.0
```

---

## 7. 画面構成

| 画面            | 主な役割                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Dashboard       | 最近利用したRecipe、進行中Run、未整理Linkを表示する                                                                      |
| Projects        | Project一覧、作成、切替、アーカイブを行う                                                                                |
| Prompt Library  | Prompt検索、作成、編集、版管理を行う                                                                                     |
| Context Library | Context登録、適用範囲設定、利用状況確認を行う                                                                            |
| Recipe Builder  | Prompt・Context・変数を組み立てる                                                                                        |
| Run Detail      | 実行内容、スナップショット、Link、評価、改善メモを確認する                                                               |
| Trail View      | Chat、Issue、PR、Releaseの関係を確認する                                                                                 |
| Settings        | Phase 1ではデータ出力・復元、Phase 4ではGitHub連携設定、Phase 5ではAccount / Plan / Administration関連設定を段階的に扱う |

---

## 8. 非機能要件

| 観点             | 要件                                                            |
| ---------------- | --------------------------------------------------------------- |
| 保存方式         | IndexedDBを主データストアとするローカルファースト設計           |
| データ移行       | DBスキーマのバージョン管理と移行処理を持つ                      |
| 可搬性           | JSONおよびMarkdownでエクスポート・インポートできる              |
| バックアップ     | 手動バックアップと復元を提供する                                |
| 削除保護         | Project、Prompt、Context、Recipe、Runは原則ソフトデリートとする |
| 機密情報警告     | APIキー、トークン、パスワードらしき文字列を検知・警告する       |
| 監査性           | Run時点のPrompt・Context・入力値を固定保存する                  |
| 検索性           | 日本語全文検索、タグ検索、Project絞り込みを提供する             |
| アクセシビリティ | キーボード操作、適切なラベル、十分なコントラストを確保する      |
| オフライン性     | MVPの主要操作はネットワークなしでも利用できる                   |
| 外部通信         | MVPでは外部URLへの自動アクセスを行わない                        |

---

## 9. 実装ロードマップ

実装順序、Phase 0 の P0-1〜P0-6、Public Alpha の詳細は [Roadmap](roadmap.md) を正本とします。本書では機能要件との対応を保つため、Phase 0〜5 を要約します。MVP 到達点は **Phase 1: Validation Release の Public Alpha 完了時点**です。

### Phase 0：Foundation

技術・品質・データ・基本導線・Hosted Preview 基盤を Public Alpha の Foundation として維持する。追加投資は Public Alpha を阻害する問題に限定し、P0-6 はアーキテクチャ、Local-first / IndexedDB 保存境界、Public Preview の利用方法、既知の制約、公開データの扱い、最小リリースチェックへ絞る。

### Phase 1：Validation Release

PromptTrail の中核価値を検証する最小の縦切りを Public Alpha として公開する。

| 項目       | 内容                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| Project    | 最小選択または既定 Project を利用する                                             |
| Prompt     | 入力、保存、表示、コピーを行う                                                    |
| Run        | Prompt から作成し、実行時 Prompt をスナップショット保存する                       |
| Link       | Chat、Issue、PR、Commit、Document の URL を手動登録し、最小の種別・役割を管理する |
| Trail      | Run 内で AI 依頼から成果物までを確認する                                          |
| Reuse      | 過去 Prompt のコピーまたは Run 複製で次の作業に使う                               |
| Onboarding | サンプル Trail または初回利用ガイド、Feedback 導線を提供する                      |

完了時には、新規利用者が Prompt と一つ以上の Link を含む最初の Run を作成し、Trail を確認して次の作業に再利用できる。Hosted 環境から主要操作を試せ、Local-first / IndexedDB の制約を利用者へ明示する。

### Phase 2：User Validation

初期利用者の利用観察とインタビューを行い、初回 Trail 作成、2 件目の Run、Prompt / Run の再利用、離脱・混乱箇所、既存のメモやブックマークとの比較を確認する。Library、Recipe、検索、GitHub 同期のどれへ投資するかを、定性フィードバックと最小限の利用指標から決定する。

### Phase 3：Evidence-driven Expansion

Phase 2 の利用証拠に基づき、以下の候補を選択的に実装する。すべてを一括実装せず、小さな Release / Learn 単位へ分割する。

- Project Workspace、Prompt / Context Library、Recipe Builder、変数検出と入力フォーム。
- タグ、検索、絞り込み、Prompt 版管理。
- JSON Export / Import / Backup / Restore、Settings 最小骨格。
- Trail、Run 評価、改善メモ、再実行支援の強化。

### Phase 4：Integration

GitHub API による Issue、PR、Commit の情報取得、Link の状態更新、URL からのメタデータ補完、Issue 本文生成支援、外部サービス Integration 設定を扱う。

### Phase 5：Productization & Administration

Persona / Experience、Identity / Authentication、Authorization Role、Plan / Entitlement、Admin Console、User management、Cloud Database、Cross-device synchronization、Operational settings を扱う。Experience による表示制御、Plan / Entitlement による利用可否、Authorization Role による管理権限は分離する。

## 10. Public Alpha で見送る機能

| 機能                                                              | 扱い                           |
| ----------------------------------------------------------------- | ------------------------------ |
| Context Library の完成、Prompt 更新履歴、高度な検索               | Phase 3 の利用証拠に基づく候補 |
| Recipe の変数自動検出・入力フォーム                               | Phase 3 の利用証拠に基づく候補 |
| JSON Backup / Restore、Settings 画面の完成                        | Phase 3 の利用証拠に基づく候補 |
| GitHub API 連携、Link 自動同期                                    | Phase 4                        |
| Authentication / Authorization、Plan / Entitlement、Admin Console | Phase 5                        |
| Cloud Sync / Cross-device synchronization                         | Phase 5                        |

## 11. Local-first / IndexedDB の制約

PromptTrail は Local-first で、IndexedDB に browser origin ごとにデータを保存する。localhost、GitHub Pages、Azure Static Web Apps のデータは共有されず、PC とスマートフォンの間でも同期しない。browser の変更や storage の削除によりデータを失う可能性があるため、Public Alpha は Cloud Sync 環境ではないことを利用者へ明示する。

## 12. 結論

PromptTrail は、AI への依頼、Chat、Issue、PR、成果物を Link でつなぎ、次の作業へ再利用する Trail を残すプロダクトである。最初の公開目標は Phase 1 の Public Alpha とし、Phase 2 の利用観察を通じて以後の開発優先順位を決定する。
