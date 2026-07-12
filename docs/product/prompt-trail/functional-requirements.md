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

詳細な実装順序とPhase 0のP0-1〜P0-6再同期は [Roadmap](roadmap.md) を正本とする。ここでは機能要件との対応を保つため、Phase 0〜5の要約を記載する。

### Phase 0：AI Workbench基盤・PromptTrailの起動

**目的：** モノレポとアプリの技術基盤を作り、開発を継続できる状態にする。

| 項目           | 内容                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| リポジトリ作成 | `ai-workbench` を新規作成する                                                                     |
| Workspace構成  | pnpm Workspaceと`apps/prompt-trail`を作成する                                                     |
| React基盤      | React + TypeScript + Viteで起動できるようにする                                                   |
| 画面骨組み     | Dashboard、Prompt Library、Context Library、Recipe Builder、Run Detailの基本導線を置く            |
| DB設計         | Project、Prompt、Context、Recipe、Run、Linkの型とIndexedDBスキーマを定義する                      |
| 品質基盤       | ESLint、Prettier、Vitest、Playwright、GitHub Actionsを導入する                                    |
| ドキュメント   | README、ADR、アーキテクチャ方針を整備し、P0-6でローカル開発手順と技術基盤図の整備対象を正式化する |

**完了条件**

- `pnpm install` と `pnpm dev` でPromptTrailを起動できる
- `pnpm test` とE2Eテストを実行できる
- IndexedDBの初期化とサンプルデータ表示ができる
- リポジトリ構成と技術方針がREADMEに明記されている

---

### Phase 1：Project・Prompt・Contextライブラリ

**目的：** 再利用する知識資産を登録・整理・検索できるようにする。

| 項目              | 内容                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| Project Workspace | 作成、編集、Current Project、切替、アーカイブ、左サイドバー型AppShell進化 |
| Prompt管理        | 作成、編集、複製、タグ、状態管理、最小版管理                              |
| Context管理       | 作成、分類、適用範囲、有効・無効管理                                      |
| 検索              | Prompt・Contextを検索・絞り込み                                           |
| データ保護        | ソフトデリート、JSON出力・復元、Settings最小骨格                          |
| 初期サンプル      | Codex依頼、Issue作成、設計レビューの例を登録                              |

**完了条件**

- PromptとContextをProject別または共通資産として管理できる
- Project WorkspaceとCurrent Projectにより作業対象を切り替えられる
- キーワード・タグ・Projectで必要な資産を探せる
- Promptの最小更新履歴を閲覧・復元できる
- JSONバックアップと復元ができる

---

### Phase 2：Recipe Builder・Prompt生成

**目的：** 依頼を安定した形式で組み立て、ChatGPTやCodexへ渡せるようにする。

| 項目       | 内容                                             |
| ---------- | ------------------------------------------------ |
| Recipe管理 | 作成、編集、複製、保存                           |
| 変数検出   | `{{variable}}` を自動検出して入力フォームを生成  |
| 入力検証   | 必須項目や未解決変数を検出                       |
| Prompt生成 | Prompt・Context・入力値から最終Promptを生成      |
| 出力       | コピー、Markdown出力、Issue本文向け出力          |
| 初期Recipe | Codex依頼、Bug Issue、設計レビュー、引き継ぎ資料 |

**完了条件**

- フォーム入力だけで最終Promptを生成できる
- 生成したPromptをコピー・Markdown出力できる
- 同じ作業パターンをRecipeとして再利用できる

---

### Phase 3：Run履歴・Trail Link管理

**目的：** AIへの依頼から実装成果までを、一本のTrailとして追跡できるようにする。

| 項目             | 内容                                                   |
| ---------------- | ------------------------------------------------------ |
| Run作成          | RecipeからRunを作成する                                |
| スナップショット | 実行時のPrompt、Context、入力値を固定保存する          |
| Link登録         | Chat、Issue、PR、Commit、Documentなどを複数登録する    |
| URL自動判別      | GitHub URLやChatURLをLink種別へ自動分類する            |
| Link役割         | Source、Reference、Execution、Output、Resultを設定する |
| Trail View       | Linkを時系列で確認できる                               |
| Run評価          | 成果評価と改善メモを記録する                           |
| 再実行           | 過去Runを複製して次の依頼を作る                        |

**完了条件**

- 1つのRunに複数のChat、Issue、PRを紐付けられる
- 「このPromptがどのIssue・PRにつながったか」を辿れる
- Chatの決定事項を要約付きで残せる
- 過去の成功Runを複製して次の依頼に使える

**MVP到達点：**
Phase 3完了時点で、PromptTrailを日常のAI活用・GitHub運用に投入する。

---

### Phase 4：GitHub Integration・AI Workbench拡張準備

**目的：** GitHubとの接続を深め、成果追跡と将来の複数アプリ化に備える。

| 項目           | 内容                                                 |
| -------------- | ---------------------------------------------------- |
| GitHub連携     | Issue、PR、Commitのタイトル・状態を取得する          |
| Settings拡張   | GitHub Integration設定を扱う                         |
| Link同期       | GitHub Linkの状態を手動または定期更新できる          |
| Issue作成支援  | RecipeからGitHub Issueのタイトル・本文を生成する     |
| PR状態表示     | Open / Merged / ClosedをRun画面に表示する            |
| Link補完       | URLからIssue番号、PR番号、タイトルを補完する         |
| Prompt改善支援 | Good評価のRunを候補としてPromptへ昇格しやすくする    |
| 共通化評価     | 第2アプリの着手時に`packages/`切り出し要否を判断する |

**完了条件**

- GitHubのIssue・PRをRunへ効率よく接続できる
- Runから実装の進捗・結果を確認できる
- 共通パッケージを作るべき重複があるか評価できる

---

### Phase 5：Productization & Administration

**目的：** 個人向けローカルワークベンチから、複数の利用者像・契約・権限・習熟度に対応できるプロダクトへ拡張する。

| 項目                     | 内容                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| Persona / Experience     | Simple / Standard / Advanced による段階的な体験設計                             |
| Identity / Authorization | User / Account、Authentication、Admin、Member                                   |
| Plan / Entitlement       | Guest / Plus / Pro、Feature Entitlement                                         |
| Administration           | Admin Console、User management、Plan / feature management、Operational settings |
| Settings拡張             | Account / Plan / Administration関連設定を扱う                                   |

Guest / Plus / Pro と Admin / Member は同一Roleとして扱わない。Experienceによる表示制御、Plan / Entitlementによる利用可否、Authorization Roleによる管理権限を分離し、Progressive Disclosureを将来阻害しない設計方針を維持する。

---

## 10. MVPで見送る機能

| 機能                     | 理由                                 |
| ------------------------ | ------------------------------------ |
| ChatGPT・Codexの直接実行 | 認証、会話ログ、監査、課金管理が重い |
| GitHub Issueの自動作成   | Phase 4までは出力・コピーで十分      |
| GitHubトークンの保存     | セキュリティ設計を固めてから扱う     |
| 複数人の共同編集         | 個人利用・小規模利用では優先度が低い |
| RAGによるContext自動検索 | データ資産が十分に増えてから導入する |
| クラウド同期             | まずローカルファーストで価値検証する |
| 共通UIパッケージ         | 第2アプリが生まれてから検討する      |

---

## 11. 結論

AI Workbenchは、AIを使った仕事の道具を育てるための母艦である。

PromptTrailはその最初のアプリとして、以下を実現する。

1. PromptとContextを再利用可能な資産として管理する
2. Recipeで依頼パターンを標準化する
3. Runで実際に使った依頼を証跡化する
4. Chat、Issue、PR、成果物をLinkでつなぐ
5. 成果を踏まえてPromptとContextを改善する

最初の実装目標はPhase 3までとする。
この段階で、ChatGPTによる構想整理、GitHub Issue化、Codexへの開発依頼、PR確認という流れを、PromptTrail上で一つのTrailとして管理できる。
