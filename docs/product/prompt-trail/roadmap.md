# PromptTrail Roadmap

このロードマップは、PromptTrail の実装フェーズを Phase 0 から Phase 5 まで整理したものです。機能要件の正本は [Functional Requirements](functional-requirements.md) とし、本ドキュメントは Phase 0 の現行実装、Phase 1 以降の実装順序、MVP 後のプロダクト拡張方針を要約します。

## 全体像

| Phase   | 名称                            | 目的                                            |
| ------- | ------------------------------- | ----------------------------------------------- |
| Phase 0 | Foundation                      | 技術・データ・品質・基本導線・最小データ接続    |
| Phase 1 | Library                         | Project・Prompt・Context を再利用資産として管理 |
| Phase 2 | Recipe Builder                  | Prompt と Context を組み立て、出力可能にする    |
| Phase 3 | Run & Trail                     | Run 履歴と Chat／Issue／PR リンクを追跡する     |
| Phase 4 | GitHub Integration              | GitHub 連携と AI Workbench 拡張準備             |
| Phase 5 | Productization & Administration | 複数の利用者像・契約・権限・習熟度に対応する    |

**MVP 到達点は Phase 3 完了時点**です。Phase 4 は MVP 後の GitHub Integration に集中し、Identity、Authorization、Plan、Administration は Phase 5 の Productization として扱います。

```text
Phase 0  Foundation
         └─ 技術・データ・品質・基本導線・最小データ接続

Phase 1  Library
         ├─ Project Workspace
         ├─ Sidebar / AppShell進化
         ├─ Prompt / Context管理
         ├─ Prompt最小版管理
         ├─ Search / Backup
         └─ Settings最小骨格

Phase 2  Recipe Builder
         └─ Prompt / Contextを組み立てて出力

Phase 3  Run & Trail
         └─ AI依頼から成果までを追跡
             → MVP到達

Phase 4  GitHub Integration
         └─ GitHubとの接続深化

Phase 5  Productization & Administration
         ├─ Persona / Experience
         ├─ Identity
         ├─ Authorization Role
         ├─ Plan / Entitlement
         └─ Admin Console
```

---

## Phase 0: Foundation

### 目的

AI Workbench のモノレポ基盤と PromptTrail の技術基盤を整え、継続的に開発できる状態にします。Phase 0 は P0-1〜P0-6 へ分解し、P0-1〜P0-4 は完了済み、P0-5 / P0-6 は残作業として扱います。

```text
Phase 0：Foundation
│
├─ ✅ P0-1 開発基盤
├─ ✅ P0-2 品質基盤・CI
├─ ✅ P0-3 ドメインモデル・IndexedDB・Repository
├─ ✅ P0-4 AppShell・基本導線・品質ベースライン
├─ ⬜ P0-5 サンプルデータ・Dashboard動作証明
└─ ⬜ P0-6 技術ドキュメント・統合受入
```

### P0-1〜P0-4 の到達点

- pnpm Workspace、`apps/prompt-trail`、React + TypeScript + Vite の起動基盤を確立する。
- ESLint、Prettier、Vitest、Playwright、GitHub Actions による品質基盤と CI を整備する。
- Project、Prompt、Context、Recipe、Run、Link のドメインモデル、IndexedDB / Dexie、Repository 境界を整備する。
- Application Composition Root で Repository を注入し、UI が Dexie / IndexedDB へ直接依存しない境界を作る。
- Router / AppShell / Global Navigation を整備し、Dashboard、Prompt Library、Context Library、Recipe Builder、Run Detail、Not Found への基本導線を確立する。
- Page Start State と Repository Empty / Data / Failure State の責務を分離する。
- Unit / Component regression、Browser navigation E2E、Responsive / Accessibility baseline を整備する。

### P0-5 / P0-6 の残作業

- **P0-5: サンプルデータ・Dashboard 動作証明**
  - Repository とサンプルデータを通じて Dashboard の最小動作を確認する。
  - Phase 1 以降の Project / Prompt / Context / Recipe / Run / Link を理解しやすい初期データを整える。
- **P0-6: 技術ドキュメント・統合受入**
  - P0-6-1 でローカル開発環境手順を正式化・最新化する。
  - P0-6-2 で Phase 0 のアーキテクチャ、データモデル、品質運用ドキュメントを統合する。
  - 現行実装とロードマップ、機能要件、アーキテクチャ文書の整合を確認する。

### P0-6-1: ローカル開発環境手順

既存 README は、最短セットアップ、`dev` / `build` / `preview` / test / E2E などの日常コマンドの入口として維持します。P0-6-1 では「手順が存在しない」前提ではなく、既存 README を出発点として次を正式化・最新化します。

- Ubuntu を含む再現可能な正式手順。
- Node.js / Corepack / pnpm の前提。
- Vite dev / build / preview の起動確認。
- Unit / E2E / lint / format の実行確認。
- 代表的な障害切り分け。
- 現行実装との整合確認と陳腐化解消。

### P0-6-2: 技術基盤図の整備対象

既存の Application Architecture は維持し、補完図として次の 2 系統を検討します。この Issue では図そのものの作成ではなく、P0-6-2 の整備対象として配置します。

#### Technology Stack / Runtime Architecture

```text
Development / Quality
├─ pnpm Workspace
├─ TypeScript
├─ Vite
├─ Vitest
├─ Playwright
└─ GitHub Actions

Browser Runtime
├─ React
├─ React Router
├─ Application / Provider / Pages
├─ Repository
├─ Dexie
└─ IndexedDB
```

目的は、開発時に使う技術とブラウザ実行時に使う技術を区別し、Vite、React、Router、Repository、Dexie / IndexedDB の位置関係を一枚で把握できるようにすることです。

#### Data Architecture

```text
UI
 ↓
Repository
 ↓
Dexie
 ↓
IndexedDB
 ├─ Project
 ├─ Prompt
 ├─ Context
 ├─ Recipe
 ├─ Run
 └─ Link
```

```text
Project
 ├─ Prompt
 ├─ Context
 ├─ Recipe
 └─ Run
      └─ Link
```

目的は、論理データモデルと物理的な永続化境界を混同せず、UI が Repository を通じてデータへアクセスする設計原則を視覚化することです。

---

## Phase 1: Library

### 目的

Project、Prompt、Context を再利用可能な知識資産として登録、整理、検索できるようにします。Project は新規テーマとして重複追加せず、ドメインモデル、IndexedDB / Repository、機能要件、Phase 1 の上位作業単位として扱います。

### Phase 1 前半: Project Workspace / AppShell 進化

- Project 一覧、作成、編集、切替、アーカイブ。
- Current Project の明示。
- Project 単位で Prompt、Context、Recipe、Run を切り替える Workspace 体験。
- Phase 0 の Global Navigation は完了成果として維持し、Project の実体が UI へ現れるタイミングで左サイドバー型 Navigation へ進化させる。
- Phase 1 では本格的な Login / Admin / Plus / Pro 判定を実装しない。
- Navigation は将来の visibility / capability / experience 制御を阻害しない責務分離にする。
- hamburger menu、Drawer、詳細なモバイル Navigation 設計は Phase 1 詳細設計で判断し、このロードマップでは固定しない。

将来拡張の概念例:

```text
Navigation Item
├─ route
├─ label
├─ required capability
├─ experience visibility
└─ administration visibility
```

これは将来設計余地を示すものであり、Phase 1 で Role / Plan / Entitlement を実装する要求ではありません。

### Phase 1 後半: Prompt / Context / Search / Backup

- Prompt の作成、編集、複製、タグ、状態管理。
- Prompt 最小版管理として、更新履歴、過去版の閲覧、過去版の復元を扱う。
- Context の作成、分類、適用範囲、有効・無効管理。
- Prompt / Context の検索と絞り込み。
- 日本語全文検索、タグ検索、Project 絞り込みの最小実装。
- ソフトデリート、JSON Export / Import / Backup / Restore によるデータ保護。
- Settings 最小骨格として JSON Export / Import / Backup / Restore の入口を用意する。
- Codex 依頼、Issue 作成、設計レビューなどの初期サンプル登録。

### Phase 1 の非機能要件配置

- アクセシビリティは、キーボード操作、ラベル、コントラストを Phase 0 baseline から継続改善する。
- MVP 主要操作のオフライン性は、Phase 1 からローカルファーストな Project / Prompt / Context 管理で維持する。
- 機密情報警告は詳細アルゴリズムを固定せず、API キー、トークン、パスワードらしき文字列に対する最小警告を Phase 1 後半または Phase 2 の実装候補として扱う。

### 完了条件

- Project を上位作業単位として選択・切替できる。
- Prompt と Context を Project 別または共通資産として管理できる。
- キーワード、タグ、Project で必要な資産を探せる。
- Prompt の最小更新履歴を閲覧・復元できる。
- JSON バックアップと復元ができる。
- Settings 最小骨格からデータ保護機能へ到達できる。

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
- 機密情報警告を Phase 1 で未実装にした場合の最小警告導入候補。

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
- MVP 主要操作のオフライン性とアクセシビリティ継続改善。

### 完了条件

- 1 つの Run に複数の Chat、Issue、PR を紐付けられる。
- 「この Prompt がどの Issue・PR につながったか」を辿れる。
- Chat の決定事項を要約付きで残せる。
- 過去の成功 Run を複製して次の依頼に使える。
- **Phase 3 完了時点で MVP に到達し、PromptTrail を日常の AI 活用・GitHub 運用に投入できる。**

---

## Phase 4: GitHub Integration

### 目的

MVP 後の拡張として GitHub との接続を深め、成果追跡と将来の AI Workbench 複数アプリ化に備えます。Phase 4 は GitHub Integration として独立した責務を維持し、Identity / Admin / Plan を混在させません。

### 主なスコープ

- GitHub API 連携による Issue、PR、Commit のタイトル・状態取得。
- GitHub Link の手動または定期的な状態更新。
- Recipe から GitHub Issue のタイトル・本文を生成する支援。
- PR の Open / Merged / Closed 状態表示。
- URL から Issue 番号、PR 番号、タイトルを補完する Link 補完。
- Good 評価の Run を Prompt 改善候補へ昇格しやすくする支援。
- GitHub Integration 設定として Settings を拡張する。
- 第 2 アプリの着手時に `packages/` 切り出し要否を判断する共通化評価。

### 完了条件

- GitHub の Issue・PR を Run へ効率よく接続できる。
- Run から実装の進捗・結果を確認できる。
- GitHub 連携設定を Settings から扱える。
- 共通パッケージを作るべき重複があるか評価できる。

---

## Phase 5: Productization & Administration

### 目的

個人向けローカルワークベンチから、複数の利用者像・契約・権限・習熟度に対応できるプロダクトへ拡張します。Phase 5 の本質は単なる管理者画面追加ではなく、次のプロダクトモデル転換です。

```text
Individual AI Workbench
→ Multi-persona Product
```

### 主なテーマ

```text
Phase 5
│
├─ Persona / Experience Model
│  ├─ Simple
│  ├─ Standard
│  └─ Advanced
│
├─ Identity / Authorization
│  ├─ User / Account
│  ├─ Authentication
│  ├─ Admin
│  └─ Member
│
├─ Plan / Entitlement
│  ├─ Guest
│  ├─ Plus
│  ├─ Pro
│  └─ Feature Entitlement
│
└─ Administration
   ├─ Admin Console
   ├─ User management
   ├─ Plan / feature management
   └─ Operational settings
```

### Persona / Experience、Plan / Entitlement、Authorization Role の分離

将来のユーザー区分を 1 つの `userType` へ統合しません。次の 3 軸を分離して扱います。

| 軸                   | 役割                     | 例                           |
| -------------------- | ------------------------ | ---------------------------- |
| Persona / Experience | 何を分かりやすく見せるか | Simple / Standard / Advanced |
| Plan / Entitlement   | 何を利用できるか         | Guest / Plus / Pro           |
| Authorization Role   | 何を管理できるか         | Admin / Member               |

`Pro + Member + Simple Experience` のような組み合わせも成立します。したがって、Guest / Plus / Pro と Admin / Member を同一 Role 体系として扱いません。

### Progressive Disclosure 方針

Context Library のような高度な概念を初心者・ゲストを含む全ユーザーへ一律に提示すると、利用開始時の認知負荷が高くなる可能性があります。MVP 前から、将来の段階的機能開示を阻害しない設計余地を確保します。

```text
Simple Experience
├─ Dashboard
├─ Projects
├─ Guided Recipe
└─ Recent Runs

Standard / Advanced Experience
├─ Prompt Library
├─ Context Library
├─ Detailed Recipe Builder
├─ Trail
└─ Advanced Settings
```

- Experience による表示制御と、Plan / Role による利用可否・管理権限を混同しない。
- Phase 1 の Sidebar / Navigation 設計時に、将来の Progressive Disclosure を阻害しない構造を選ぶ。
- Simple / Standard / Advanced の本格実装時期は、Phase 1〜3 での先行導入または Phase 5 での統合実装を今後の詳細設計で判断する。
- Guest / Plus / Pro の本格的な契約・Entitlement 制御は Phase 5 を基本とする。
- MVP 前に Identity / Authentication / Subscription 基盤を前倒しし、MVP 速度を落とすことは避ける。

### Settings 拡張

Phase 5 では Account / Plan / Administration 関連設定へ Settings を拡張します。Phase 1 のデータ保護設定、Phase 4 の GitHub Integration 設定とは責務を分けて段階的に育てます。

### 完了条件

- Persona / Experience、Identity / Authorization、Plan / Entitlement、Administration の責務境界が実装に反映される。
- Guest / Plus / Pro と Admin / Member が同一 Role として扱われていない。
- Experience による段階的開示と、Plan / Role による利用可否・管理権限が分離されている。
- Admin Console、User management、Plan / feature management、Operational settings を扱える。
