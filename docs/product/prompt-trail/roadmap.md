# PromptTrail Roadmap

このロードマップは、PromptTrail の実装フェーズを Phase 0 から Phase 4 まで整理したものです。機能要件の正本は [Functional Requirements](functional-requirements.md) とし、本ドキュメントはそのロードマップ記載と整合する形で要約します。

## 全体像

| Phase | 名称 | 目的 |
| --- | --- | --- |
| Phase 0 | Foundation | AI Workbench 基盤と PromptTrail の開発起動 |
| Phase 1 | Library | Project・Prompt・Context を再利用資産として管理 |
| Phase 2 | Recipe Builder | Prompt と Context を組み立て、出力可能にする |
| Phase 3 | Run & Trail | Run 履歴と Chat／Issue／PR リンクを追跡する |
| Phase 4 | GitHub Integration | GitHub 連携と AI Workbench 拡張準備 |

**MVP 到達点は Phase 3 完了時点**です。Phase 4 は MVP 後の拡張として、GitHub API 連携、Issue／PR 状態取得、Link 補完などを扱います。

---

## Phase 0: Foundation

### 目的

AI Workbench のモノレポ基盤と PromptTrail の技術基盤を整え、継続的に開発できる状態にします。

### 主なスコープ

- pnpm Workspace と `apps/prompt-trail` の作成。
- React + TypeScript + Vite によるアプリ起動基盤。
- IndexedDB を前提とした Project、Prompt、Context、Recipe、Run、Link の型と初期スキーマ設計。
- Dashboard、Library、Builder、Run Detail などの初期画面骨組み。
- ESLint、Prettier、Vitest、Playwright、GitHub Actions などのテスト・品質基盤。
- README、ADR、アーキテクチャ方針などの初期ドキュメント整備。

### 完了条件

- `pnpm install` と `pnpm dev` で PromptTrail を起動できる。
- `pnpm test` と E2E テストを実行できる。
- IndexedDB の初期化とサンプルデータ表示ができる。
- リポジトリ構成と技術方針が README や関連ドキュメントに明記されている。

---

## Phase 1: Library

### 目的

Project、Prompt、Context を再利用可能な知識資産として登録、整理、検索できるようにします。

### 主なスコープ

- Project の作成、編集、切替、アーカイブ。
- Prompt の作成、編集、複製、タグ、状態管理。
- Context の作成、分類、適用範囲、有効・無効管理。
- Prompt・Context の検索と絞り込み。
- ソフトデリート、JSON 出力・復元によるデータ保護。
- Codex 依頼、Issue 作成、設計レビューなどの初期サンプル登録。

### 完了条件

- Prompt と Context を Project 別または共通資産として管理できる。
- キーワードやタグで必要な資産を探せる。
- JSON バックアップと復元ができる。

---

## Phase 2: Recipe Builder

### 目的

Prompt と Context を安定した形式で組み立て、ChatGPT や Codex へ渡せる最終 Prompt として出力できるようにします。

### 主なスコープ

- Recipe の作成、編集、複製、保存。
- `{{variable}}` の自動検出と入力フォーム生成。
- 必須項目や未解決変数の入力検証。
- Prompt、Context、入力値からの最終 Prompt 生成。
- コピー、Markdown 出力、Issue 本文向け出力。
- Codex 依頼、Bug Issue、設計レビュー、引き継ぎ資料などの初期 Recipe。

### 完了条件

- フォーム入力だけで最終 Prompt を生成できる。
- 生成した Prompt をコピーまたは Markdown 出力できる。
- 同じ作業パターンを Recipe として再利用できる。

---

## Phase 3: Run & Trail

### 目的

AI への依頼から Chat、Issue、PR、Commit、Document などの成果までを、一本の Trail として追跡できるようにします。

### 主なスコープ

- Recipe からの Run 作成。
- 実行時の Prompt、Context、入力値のスナップショット保存。
- Chat、Issue、PR、Commit、Document などの Link 登録。
- GitHub URL や Chat URL の Link 種別自動判別。
- Source、Reference、Execution、Output、Result などの Link 役割設定。
- Link を時系列で確認する Trail View。
- Run の成果評価と改善メモ。
- 過去 Run の複製による再実行。

### 完了条件

- 1 つの Run に複数の Chat、Issue、PR を紐付けられる。
- 「この Prompt がどの Issue・PR につながったか」を辿れる。
- Chat の決定事項を要約付きで残せる。
- 過去の成功 Run を複製して次の依頼に使える。
- **Phase 3 完了時点で MVP に到達し、PromptTrail を日常の AI 活用・GitHub 運用に投入できる。**

---

## Phase 4: GitHub Integration

### 目的

MVP 後の拡張として GitHub との接続を深め、成果追跡と将来の AI Workbench 複数アプリ化に備えます。

### 主なスコープ

- GitHub API 連携による Issue、PR、Commit のタイトル・状態取得。
- GitHub Link の手動または定期的な状態更新。
- Recipe から GitHub Issue のタイトル・本文を生成する支援。
- PR の Open / Merged / Closed 状態表示。
- URL から Issue 番号、PR 番号、タイトルを補完する Link 補完。
- Good 評価の Run を Prompt 改善候補へ昇格しやすくする支援。
- 第 2 アプリの着手時に `packages/` 切り出し要否を判断する共通化評価。

### 完了条件

- GitHub の Issue・PR を Run へ効率よく接続できる。
- Run から実装の進捗・結果を確認できる。
- 共通パッケージを作るべき重複があるか評価できる。
