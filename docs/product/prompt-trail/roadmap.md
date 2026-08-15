# PromptTrail Roadmap

このロードマップは、PromptTrail を最小体験から公開し、利用証拠に基づいて育てるための Phase と優先順位の正本です。機能要件は [Functional Requirements](functional-requirements.md)、Phase 2 の統合管理は [Issue #199](https://github.com/yuyuyu0706/ai-workbench/issues/199) を参照します。

## 方針

```text
Build Minimum → Release → Validation Readiness → Learn → Prioritize → Build
```

検証する中核価値は、AI への依頼内容と Chat、Issue、PR、成果物を一本の Trail として残し、次の作業で再利用できることです。Phase 1 の Public Alpha を基準点とし、Phase 2 は不足している MVP 体験を補完してから利用観察へ進みます。

## 全体像

| Phase   | 名称                                   | 状態・目的                                                          |
| ------- | -------------------------------------- | ------------------------------------------------------------------- |
| Phase 0 | Foundation                             | **完了**。技術・品質・配信基盤を維持する                            |
| Phase 1 | Validation Release                     | **完了**。Public Alpha を公開し、初期 Feedback を受領した           |
| Phase 2 | Validation Readiness & User Validation | MVP を検証可能な状態へ補完し、利用観察から次の投資先を決める        |
| Phase 3 | Guided Execution Foundation            | Workspace / Trail / AI・GitHub 実行基盤を成立させる（確定）         |
| Phase 4 | Workflow & Integration Expansion       | 実行可能 Trail の種類、Context / Recipe、外部連携を拡張する（確定） |
| Phase 5 | Productization & Administration        | 認証、契約、権限、同期、運用管理を備える                            |

```text
Phase 0  Foundation                                  ✓
Phase 1  Validation Release → Public Alpha           ✓
Phase 2  Validation Readiness → User Validation → Prioritize
Phase 3  Guided Execution Foundation
Phase 4  Workflow & Integration Expansion
Phase 5  Productization & Administration
```

Phase 番号は整数のみを使用します。

---

## Phase 0: Foundation（完了）

pnpm Workspace、React、TypeScript、Vite、品質基盤、ドメインモデル、Dexie / IndexedDB、Repository 境界、Router / AppShell、Dashboard、Hosted Preview を整備しました。以後は後続 Phase を支える基盤として維持します。

## Phase 1: Validation Release（完了）

最小の `Prompt → Run → Link → Trail → Reuse` 体験を Public Alpha として公開し、自己利用、初期利用者への案内、最初の Feedback 受領まで完了しました。

### 完了実績

- 既定 Project による最初の Trail 作成。
- Prompt 保存、Direct Run、実行時点で固定される Prompt Snapshot。
- 名称付き Link の登録・表示・論理削除。
- Dashboard、Run Detail、reload、再遷移後のデータ保持。
- 過去 Run の Prompt Snapshot を初期値に、新しい Prompt と Run を派生させる再利用。
- Developer Data Scenario、UI State Override と通常 Production での非露出。
- Public Alpha Guide、Global Navigation、保存制約、Feedback Issue Form。
- Azure Static Web Apps Public Preview での Hosted 統合受入。

Public Alpha は Local-first / IndexedDB の保存境界で動作します。origin ごとにデータが分離され、端末間同期や Cloud Sync はなく、browser や storage の変更でデータを失う可能性があります。

## Phase 2: Validation Readiness & User Validation

Phase 2 は単なる観察期間ではありません。初期 Feedback で判明した重大な体験不足を前半で補完し、Hosted 環境の統合受入後に、改善後の MVP を自己利用・初期利用者で観察します。

```text
Validation Readiness
  ↓
User Validation
  ↓
Prioritize
```

### Validation Readiness（利用観察前の必須スコープ）

1. **Prompt 資産を管理し、反復利用できる**
   - Prompt Library を実データへ接続し、更新日時順の一覧、タイトル・本文の簡易検索、新規登録、編集、論理削除を提供する。
   - Library の Prompt から、同じ Prompt 資産を参照する新しい Run / Trail を作成する。利用ごとに Prompt 資産を複製せず、Run 作成時点の内容を Snapshot として固定する。
   - Prompt 削除後は Library と新規利用から除外する一方、作成済み Run、Link、Prompt Snapshot は削除・変更しない。復元・ゴミ箱は Phase 3 候補とする。
2. **Trail を Prompt 資産から独立して識別できる**
   - Prompt タイトルは「再利用する依頼資産の名前」、Trail 名は「個別作業記録の名前」とする。
   - Prompt 種別は「AI へどのような依頼をするか」、Trail 種別は「今回どのような作業を行ったか」とし、別の概念として扱う。
   - Run に独立した Trail 名・Trail 種別を追加し、New Trail で設定、Run Detail で変更できるようにする。
   - 既存 Run は migration で `trailTitle = promptSnapshot.title`、`trailKind = other` 相当へ安全に補完する。
3. **MVP の表示・到達性を完成させる**
   - Dashboard から 6 件目以降を含む過去 Trail へ到達できる最小導線を設ける。
   - Dashboard / Run Detail の Status、日時、見出し等の利用者向け表記を統一する。
   - Prompt Library を実データ接続時に主要 Navigation へ戻す。未完成の Context Library / Recipe Builder は利用可能になるまで主要 Navigation に表示しない。
4. **Hosted 環境で統合受入する**
   - Prompt 管理、Trail 管理、Dashboard と Phase 1 の Golden Path を回帰確認し、利用観察を始められる状態を確定する。

### 資産と証跡の契約

| 概念                      | 責務                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| Prompt                    | 現在利用可能な再利用資産。編集・論理削除できる                      |
| `Run.promptSnapshot`      | 実行時点の不変な証跡。元 Prompt の編集・削除後も維持する            |
| Prompt Library からの利用 | 同一 Prompt 資産を反復利用し、毎回新しい Run Snapshot を作る        |
| 過去 Run からの再利用     | 過去 Snapshot を初期値として、新しい Prompt 資産と Run を派生させる |

### User Validation と Prioritize

Validation Readiness の統合受入後、次を観察します。

- Prompt を先に登録し、編集・改善して反復利用する流れ。
- 同一 Prompt から複数 Trail を作る流れと、過去 Run から派生する再利用との差異。
- Trail 名・Trail 種別による識別性と、6 件以上から目的の記録を再発見できるか。
- Prompt 削除後の理解と、過去 Trail が保持されることへの安心感。
- 初回利用、2 件目、再利用、離脱・混乱箇所。
- 版管理、復元、検索、Context、Recipe、Integration への需要。

観察結果を頻度、深刻度、中核価値への寄与、変更コストで整理し、Phase 3 で実施する機能と実施しない機能を決定します。

## Phase 3: Guided Execution Foundation（確定）

> 以下の Phase 3・Phase 4 の記述は、[Roadmap Rebaseline Issue](https://github.com/yuyuyu0706/ai-workbench/issues/259) の Rebaseline 案を、[P2-6 Scope Decision](https://github.com/yuyuyu0706/ai-workbench/issues/268) で Phase 2 の利用証拠（[#266](https://github.com/yuyuyu0706/ai-workbench/issues/266)）と突き合わせ、**最終確定**したものです。Investment Hypothesis 3・6（AI / GitHub への手動転記の負荷、Execution Integration への優先投資）が証拠により強く支持され、Hypothesis 1（Prompt 資産管理の深化）は Phase 2 で既に対応済みのため優先度が低いと判断しました。

キーメッセージ：PromptTrail を「記録・再利用するツール」から「AI と開発プロセスを実行する環境」へ進化させる。

- **Execution Domain**: Workspace / Project の責務整理、Trail / Run の責務整理、Asset と Execution の責務分離、外部状態の Source of Truth 整理。
- **Executable Trail**: Trail 一覧、Trail Detail、Trail 内の Run / Step、Execution Status、Execute 導線。
- **GitHub / AI Execution Gateway**: 「開発テーマ→PLAN生成→ISSUE作成→実装・PR→レビュー→マージ→Issue更新→親Issue引継ぎ」という7ステップの Guided Execution モデルのうち、最初のThin Vertical Slice はPLAN + ISSUE（実装方針のMarkdown生成とGitHub Issue作成）に限定する。技術構成の詳細はP3-3の項（下記）を参照。

### 最初の投資対象：P3-1 Execution Domain 再設計

Phase 3 の最初の Release/Learn 単位は **P3-1（Execution Domain 再設計）** とします。#266 で判明した Dashboard の表示バグ（Trail 名列が実際には Prompt Snapshot タイトルを表示していた）が、Trail / Run / Prompt の概念境界が実装上も曖昧になりやすいことを具体的に証拠化したため、GitHub / AI Integration（P3-4 以降）より前に Domain 設計を確定させます。

- Trail / Run 責務の確定（独立 Entity 化するか、現行 Run の拡張に留めるかを含む）。
- 既存 `trailTitle` / `trailKind` の移行方針。
- Workspace / Project 責務の最小定義（Default Workspace のみ。CRUD・切替は含まない。Hypothesis 4 は今回の証拠からは判断できず、追加観察に委ねる）。

Prompt 資産管理のさらなる深化（Hypothesis 1）は、Phase 2 で主要な不足が解消済みのため、当面 Evidence Backlog に留め、優先着手対象としません。

### P3-3：Guided Executionの7ステップモデルとスコープ判断

P3-1（Execution Domain再設計）の完了を受け、P3-3（GitHub / AI Execution Gateway）の
検討過程で、Guided Executionが目指す最終形を次のように整理しました。

これは、本プロジェクトの開発プロセス自体（y.kとAIアシスタントが繰り返してきた
「開発テーマを渡す→実装計画を受け取る→Issueを作る→実装・PRを受け取る→レビューする→
マージする→更新する」という一連の流れ）を、PromptTrail上のTrailとして自動化する構想です。

| #   | ステップ                                | 対応するPrompt                       |
| --- | --------------------------------------- | ------------------------------------ |
| 1   | 開発テーマ→実装計画Markdown生成（PLAN） | AI呼び出し1回                        |
| 2   | 実装方針→Issue作成（ISSUE）             | GitHub API呼び出し1回                |
| 3   | Issue→実装・PR作成                      | AIコーディングエージェントの自律実行 |
| 4   | 実装・PR→レビュー                       | AI呼び出し（diff評価）               |
| 5   | レビュー結果→mainマージ                 | 人間の承認を必ず伴う（下記参照）     |
| 6   | マージ済みPR→issue単純アップデート      | AI呼び出し＋GitHub API               |
| 7   | 更新issue→親issueへの引継ぎアップデート | AI呼び出し＋GitHub API               |

この7ステップ全体が1つの**Trail**、各ステップが個別実行可能な**Prompt**、各実行結果が
**Run/Step**として履歴管理される、という関係モデルとして整理しました。

「マージ」（ステップ5）は、常に自動実行しないという技術的制約ではなく、**「承認」という
人間の判断ポイントを必ず設ける**という設計原則として扱います。ステップ5自体をPromptとして
定義することは妨げず、実行過程に承認アシスト機能（実行前の承認催促、承認要件の定義、
レビュー結果の最終チェック取り込み等）を将来組み込める余地を残します。

7ステップを技術的難易度で見ると、大きな段差があります。ステップ1・2・4・6・7は単発の
リクエスト/レスポンス処理で完結しますが、ステップ3のみリポジトリのcheckout、AIコーディング
エージェントの実行、テスト、PR作成という、CI環境そのものを要する非同期・長時間処理です。
この段差を踏まえ、**P3-3はステップ1・2（PLAN＋ISSUE）の基盤に限定**し、ステップ3以降は
規模が質的に異なるため別テーマとして切り出します（Phase 3後半、またはPhase 4候補として
Evidence Backlogに記録）。

Gatewayの技術構成は、Managed FunctionからAI API・GitHub APIを直接呼ぶ軽量な構成とし、
workflow_dispatch／GitHub Actions連携はステップ3着手時まで見送ります（詳細は
[ADR 0008](../../adr/0008-gateway-implementation-shape.md)を参照）。

### Phase 3 Investment Hypotheses（P2-6 で証拠と突き合わせ済み）

Phase 2 の User Validation（[#266](https://github.com/yuyuyu0706/ai-workbench/issues/266)）の観察結果と突き合わせた評価は次のとおりです。

1. Prompt 資産管理のさらなる深化が必要か → **弱い**。Phase 2 で主要な不足は既に対応済み。
2. Trail の再発見・整理にまだ重大な摩擦があるか → **部分的**。到達性の摩擦は Phase 2 で緩和済みだが、Trail / Prompt 識別の混同という構造的課題が残る。
3. AI / GitHub への手動転記が最大の離脱・負荷要因になっているか → **強い**。実行結果を取得できずコピペが実行導線になっている実態が直接裏付ける。
4. Project 分離がないことが継続利用を妨げているか → **未確認**。今回の証拠からは判断できない。
5. 「Prompt を保存する」より「Trail を進める」体験の方が価値が高いか → **中程度**。Trail 概念が Run に従属していることが識別の混乱と実行体験の弱さの根にある可能性がある。
6. Context / Recipe より先に Execution Integration へ投資すべきか → **強い**。Context / Recipe への不満は観察されず、Execution 関連の摩擦のみが明確に観測された。

```text
Phase 2 Observation
        +
Phase 3 Architecture Hypothesis
        ↓
Phase 3 Scope Decision（P2-6 で確定）→ 最初の投資対象は P3-1
```

### Evidence Backlog

現行 Phase 3 候補（Prompt 復元・ゴミ箱、版管理、更新履歴、過去版比較・ロールバック、タグ、高度な検索・絞り込み・並び替え、Export / Import、Backup / Restore、Run 評価、改善メモ、Context Library、Recipe Builder）は、削除せず **Evidence Backlog** へ再分類します。「Phase 3 だから順番に実装する対象」ではなく、Phase 2 および Phase 3 の利用観察から価値・頻度・深刻度・開発コストを評価して選択する対象として扱います。

```text
Evidence Backlog

Asset Management
├─ Versioning / Restore / Search / Tags / Backup

Execution
├─ Context / Recipe / Trail Template / Evaluation

Integration
├─ GitHub / AI / Other Services
```

Evidence Backlog の記録場所は、まず本セクション（roadmap.md 内）として運用を開始し、件数が増えた段階で独立文書化を検討します。Issue テンプレート（`docs/template/lv1〜lv4_issue.md`）は、Evidence Backlog がロードマップ文書内の管理単位であり個別 Issue の起票様式には影響しないため、現時点では追記不要と判断します。

機能要件文書（[Functional Requirements](functional-requirements.md)）における「Phase 3候補」という表記は、本 Rebaseline 以降「Evidence Backlog候補」と読み替えます。詳細は同文書冒頭の注記を参照してください。

## Phase 4: Workflow & Integration Expansion（確定）

Phase 3 と同じ経緯で確定した Phase です。Phase 3 で成立した Execution Foundation を使い、実行パターンと連携先を拡張します。新しい基盤を作るのではなく、Phase 3 の Execution Platform 上に Workflow を増やすことを主眼とします。GitHub API による Issue、PR、Commit 情報取得、Link の状態更新、URL からのメタデータ補完、Issue 本文生成支援と Integration 設定はここに含まれます。

## Phase 5: Productization & Administration

Persona / Experience、Identity / Authentication、Authorization Role、Plan / Entitlement、Admin Console、User management、Cloud Database、Cloud Sync、Cross-device synchronization、Operational settings を扱います。各責務は分離します。

## ADR 候補（Rebaseline 時点では起票しない）

[Roadmap Rebaseline Issue #259](https://github.com/yuyuyu0706/ai-workbench/issues/259) の検討で、以下 5 件の ADR 候補が挙がりました。Workspace / Trail の責務や Gateway 構成は現時点では Investment Hypothesis であり判断が確定していないため、Rebaseline 時点ではいずれも起票せず、P2-6 確定後〜P3-1 で起こす対象として記録します。

- Workspace / Project Responsibility
- Trail / Run Responsibility
- External Execution Boundary
- GitHub Source of Truth
- ~~SWA Managed Function + GitHub Actions 採用判断~~ → [ADR 0008](../../adr/0008-gateway-implementation-shape.md)として起票済み（P3-3検討時）

## 後続 Issue 設計への引き継ぎ

Phase 2 の Lv2 / Lv3 Issue は、次の順序と境界で設計します。

1. Prompt 資産管理と Prompt からの Trail 作成。
2. Trail 名・Trail 種別と既存 Run migration。
3. Dashboard の到達性と表示整合。
4. Validation Readiness の Hosted 統合受入。
5. 改善後 MVP の利用観察。
6. Phase 3 の投資対象決定（[P2-6](https://github.com/yuyuyu0706/ai-workbench/issues/268) で確定。最初の投資対象は P3-1 Execution Domain 再設計）。

Context Library、Recipe Builder、Prompt 復元・版管理、高度な検索、Integration、Productization を Phase 2 の必須スコープへ連鎖的に追加しません。
