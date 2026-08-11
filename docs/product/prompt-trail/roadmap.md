# PromptTrail Roadmap

このロードマップは、PromptTrail を最小体験から公開し、利用証拠に基づいて育てるための Phase と優先順位の正本です。機能要件は [Functional Requirements](functional-requirements.md)、Phase 2 の統合管理は [Issue #199](https://github.com/yuyuyu0706/ai-workbench/issues/199) を参照します。

## 方針

```text
Build Minimum → Release → Validation Readiness → Learn → Prioritize → Build
```

検証する中核価値は、AI への依頼内容と Chat、Issue、PR、成果物を一本の Trail として残し、次の作業で再利用できることです。Phase 1 の Public Alpha を基準点とし、Phase 2 は不足している MVP 体験を補完してから利用観察へ進みます。

## 全体像

| Phase   | 名称                                   | 状態・目的                                                                  |
| ------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Phase 0 | Foundation                             | **完了**。技術・品質・配信基盤を維持する                                    |
| Phase 1 | Validation Release                     | **完了**。Public Alpha を公開し、初期 Feedback を受領した                   |
| Phase 2 | Validation Readiness & User Validation | MVP を検証可能な状態へ補完し、利用観察から次の投資先を決める                |
| Phase 3 | Guided Execution Foundation            | Workspace / Trail / AI・GitHub 実行基盤を成立させる（Rebaseline案）         |
| Phase 4 | Workflow & Integration Expansion       | 実行可能 Trail の種類、Context / Recipe、外部連携を拡張する（Rebaseline案） |
| Phase 5 | Productization & Administration        | 認証、契約、権限、同期、運用管理を備える                                    |

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

## Phase 3〜4: Rebaseline 案（P2-6 の Scope Decision で最終確定）

> 以下の Phase 3・Phase 4 の記述は、[Roadmap Rebaseline Issue](https://github.com/yuyuyu0706/ai-workbench/issues/259) による **Rebaseline 案** であり、まだ確定した実装対象ではありません。Phase 2 の User Validation で得る利用証拠と、Phase 3 Investment Hypotheses（下記）の観察結果を踏まえ、**P2-6 の Scope Decision で最終確定**します。それまでは Investment Hypothesis（投資仮説）として扱い、Phase 2 の実装スコープ・完了条件には影響しません。

### Phase 3: Guided Execution Foundation（Rebaseline 案）

キーメッセージ：PromptTrail を「記録・再利用するツール」から「AI と開発プロセスを実行する環境」へ進化させる。

- **Execution Domain**: Workspace / Project の責務整理、Trail / Run の責務整理、Asset と Execution の責務分離、外部状態の Source of Truth 整理。
- **Executable Trail**: Trail 一覧、Trail Detail、Trail 内の Run / Step、Execution Status、Execute 導線。
- **GitHub / AI Execution Gateway**: Azure Static Web Apps + SWA Managed Function + GitHub Actions（workflow_dispatch）による軽量構成。最初の Thin Vertical Slice は PLAN + ISSUE（実装方針の Markdown 生成と GitHub Issue 作成）に限定する。

Workspace / Project / Trail / Run の将来責務は、現時点では確定した設計ではなく Hypothesis として記録するにとどめます。GitHub / AI Integration の一部前倒しも同様に仮確定とします。

### Phase 4: Workflow & Integration Expansion（Rebaseline 案）

Phase 3 で成立した Execution Foundation を使い、実行パターンと連携先を拡張します。新しい基盤を作るのではなく、Phase 3 の Execution Platform 上に Workflow を増やすことを主眼とします。GitHub API による Issue、PR、Commit 情報取得、Link の状態更新、URL からのメタデータ補完、Issue 本文生成支援と Integration 設定はここに含まれます。

### Phase 3 Investment Hypotheses（Phase 2 利用観察で確認する 6 つの問い）

Phase 2 の User Validation で、次の問いを観察項目として確認します。結果は P2-5 / P2-6 の Issue 設計、および P2-6 の Scope Decision の入力とします。

1. Prompt 資産管理のさらなる深化が必要か。
2. Trail の再発見・整理にまだ重大な摩擦があるか。
3. AI / GitHub への手動転記が最大の離脱・負荷要因になっているか。
4. Project 分離がないことが継続利用を妨げているか。
5. 「Prompt を保存する」より「Trail を進める」体験の方が価値が高いか。
6. Context / Recipe より先に Execution Integration へ投資すべきか。

```text
Phase 2 Observation
        +
Phase 3 Architecture Hypothesis
        ↓
Phase 3 Scope Decision（P2-6 で確定）
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

## Phase 5: Productization & Administration

Persona / Experience、Identity / Authentication、Authorization Role、Plan / Entitlement、Admin Console、User management、Cloud Database、Cloud Sync、Cross-device synchronization、Operational settings を扱います。各責務は分離します。

## ADR 候補（Rebaseline 時点では起票しない）

[Roadmap Rebaseline Issue #259](https://github.com/yuyuyu0706/ai-workbench/issues/259) の検討で、以下 5 件の ADR 候補が挙がりました。Workspace / Trail の責務や Gateway 構成は現時点では Investment Hypothesis であり判断が確定していないため、Rebaseline 時点ではいずれも起票せず、P2-6 確定後〜P3-1 で起こす対象として記録します。

- Workspace / Project Responsibility
- Trail / Run Responsibility
- External Execution Boundary
- GitHub Source of Truth
- SWA Managed Function + GitHub Actions 採用判断

## 後続 Issue 設計への引き継ぎ

Phase 2 の Lv2 / Lv3 Issue は、次の順序と境界で設計します。

1. Prompt 資産管理と Prompt からの Trail 作成。
2. Trail 名・Trail 種別と既存 Run migration。
3. Dashboard の到達性と表示整合。
4. Validation Readiness の Hosted 統合受入。
5. 改善後 MVP の利用観察。
6. Phase 3 の投資対象決定。

Context Library、Recipe Builder、Prompt 復元・版管理、高度な検索、Integration、Productization を Phase 2 の必須スコープへ連鎖的に追加しません。
