# PromptTrail Deployment and Hosted Preview

## 1. 文書の目的

この文書は、PromptTrail の Deployment / Hosted Preview 運用契約の正本です。

PromptTrail CI、Azure Static Web Apps Deploy の trigger、責務、成功が意味すること、失敗時の切り分けを、workflow 実装を全文複製せずに運用契約として定義します。

この文書では、Hosted Preview をアプリの hosted 実行環境として扱います。Hosted Preview はクラウドデータ同期環境ではなく、PromptTrail の Local-first / IndexedDB アーキテクチャを変更しません。

## 2. Environment Contract

| Environment           | 位置づけ            | 対象ブランチ / 成果        | 利用目的                                       |
| ---------------------- | -------------------- | -------------------------- | ---------------------------------------------- |
| Local                  | Development / Debug  | 開発者のローカル作業ツリー | 実装、デバッグ、ローカル確認（`swa-cli`）      |
| Azure Static Web Apps  | Public Preview       | `main` 統合版              | `main` マージ後に自動更新される public preview |

Azure Static Web Apps は `main` 統合版の Public Preview です。`main` への push 後に、統合済み成果物を自動配信します。

## 3. 開発から Public Preview までのフロー

```text
Codex
→ codex/** branch へ実装

      ↓ PR 作成

PromptTrail CI
→ Quality Gate

      ↓ 最終レビュー
      ↓ main merge

main push
├─ PromptTrail CI
│  → Integrated Quality Check
│
└─ Azure Static Web Apps Deploy
   → Public Preview
```

## 4. Workflow Contract

| Workflow                        | Trigger                           | 責務                     | 成功が意味すること                                   |
| ------------------------------- | --------------------------------- | ------------------------ | ---------------------------------------------------- |
| PromptTrail CI                  | PR → `main` / push `main`         | アプリ品質判定           | Lint / Format / Unit / E2E / Build が成功した        |
| PromptTrail Public Preview      | push `main`                       | Public Preview 配信      | `main` 統合版を Public Preview へ配信できた          |

PromptTrail CI は、アプリ品質判定の正本です。Deploy workflow は配信責務を持ちます。

```text
Deploy 成功
≠
品質保証成功
```

Deploy workflow の成功は、対象成果物を hosted 環境へ配信できたことを示します。Lint、format、unit test、E2E、build を含む品質保証の成功は、PromptTrail CI の結果として判断します。

## 5. Success / Failure Semantics

### Success Semantics

- **PromptTrail CI OK**: アプリ品質ゲートを通過した。
- **Azure Static Web Apps OK**: `main` 統合版を Public Preview へ配信できた。

### Failure Semantics

| 状態              | 判断                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| CI NG + Deploy OK | 配信は成立したが、アプリ品質ゲートは NG。修正優先度は CI failure の内容に置く。                                                    |
| CI OK + SWA NG    | アプリ品質は OK。Public Preview 配信、Azure Static Web Apps 設定、secret、artifact、SPA routing などの配信系問題として切り分ける。 |
| SWA OK            | `main` 統合版を Public Preview へ配信済み。ただし CI 結果とは独立して確認する。                                                    |

## 6. Hosted Preview Contract

Hosted Preview は、PromptTrail frontend 成果物を browser で確認するための hosted 実行環境です。

Azure Static Web Apps Hosted Preview は `main` 統合版を確認するための Public Preview です。

Hosted Preview で確認すべき主な観点は、画面表示、global navigation、主要 route、direct URL、browser reload、desktop / smartphone 表示、hosted origin 上の IndexedDB 利用可否です。

Hosted Preview は、クラウドデータ同期、cross-device synchronization、本番リリース、staging / manual promotion の代替ではありません。

## Public Alpha での利用案内

Phase 1 の Public Alpha は、Hosted Preview の配信基盤を利用して最小の Prompt → Run → Link → Trail → Reuse 体験を公開します。Public Alpha であってもデータは browser origin ごとの IndexedDB に閉じ、クラウド同期環境にはなりません。利用者には origin ごとの分離、端末間非同期、browser storage の削除などでデータを失う可能性を明示します。

## 7. Local-first / IndexedDB Contract

PromptTrail は Local-first を前提とし、データ保存は browser origin ごとの IndexedDB に閉じます。

```text
localhost
→ IndexedDB A

azurestaticapps.net
→ IndexedDB B
```

Local、Azure Static Web Apps は origin が異なるため、IndexedDB は共有されません。同じユーザーが同じ端末で利用しても、`localhost`、`azurestaticapps.net` のデータは別領域です。

PC browser の IndexedDB と Smartphone browser の IndexedDB も共有されません。

```text
PC Browser IndexedDB
≠
Smartphone Browser IndexedDB
```

Hosted Preview はアプリの hosted 実行環境です。Hosted Preview はクラウドデータ同期環境ではありません。

## 8. Security / Public Data Contract

Hosted Preview は公開 URL になり得る前提で扱います。Frontend 成果物、sample dataset、document、screenshot、fixture には、次の情報を含めません。

- API Key。
- Token。
- Secret。
- 個人情報。
- 社内限定情報。
- 機密データ。

Sample Dataset は、公開可能なデモデータのみとします。

## 9. Acceptance Checklist

この checklist は、Hosted Preview の初期受入および将来変更時の回帰確認に利用します。

個別の受入結果、実施日、対象 branch / commit、確認環境は、対応する Issue / PR へ記録します。チェックボックス自体は再利用可能な運用契約として未チェックのまま維持し、個別実施結果をこの文書へ永続的に埋め込みません。

### 主要 Route

Hosted Preview の主要 Route 受入対象は、現行の Route 定義に合わせて次の通り固定します。存在しない Route はこの checklist のために新設しません。

- `/` → Public Alpha Guide。価値、主要操作、Local-firstの保存制約を案内し、DashboardとFeedbackへ接続する入口。
- `/dashboard`。
- `/prompts`。
- `/contexts`。
- `/recipes/builder`。
- `/runs/:runId`。
- unknown route → Not Found / dashboard recovery。

Public AlphaのGlobal Navigationは「はじめに」と「Dashboard」に限定します。Prompt Library、Context Library、Recipe Builderは主要Navigationから外しますが、既存URLへのdirect accessは維持します。FeedbackはGitHub Issue Formで受け付け、リンクにアプリ内データを含めません。GitHubアカウントが必要であることと、Prompt、Run、Link等が自動送信されないことをGuideで案内します。

Phase 2のValidation Readiness受入では、実データ接続後のPrompt Libraryを主要NavigationとHosted受入対象へ戻します。Context Library / Recipe Builderは利用可能になるまで主要Navigationへ表示せず、direct accessの回帰確認だけを継続します。Prompt登録・編集・Trail作成・論理削除後の過去Run保持、Trail名・Trail種別、6件目以降への到達性、Dashboard / Run Detailの表記整合をPhase 1 Golden Pathと併せて確認してからUser Validationへ進みます。

### Azure Static Web Apps

- [ ] `main` push で deploy できる。
- [ ] Dashboard を表示できる。
- [ ] Global Navigation を利用できる。
- [ ] 主要 Route へ到達できる。
- [ ] direct URL で表示できる。
- [ ] browser reload で 404 にならない。
- [ ] Desktop Browser で表示できる。
- [ ] Smartphone Browser で表示できる。
- [ ] Hosted origin 上で IndexedDB を利用できる。

## 10. 非対象・将来拡張

この文書化では、次を対象外とします。

- `.github/workflows/ci.yml` の変更。
- workflow 間の直列化・`workflow_run` 追加。
- Reusable Workflow / `workflow_call` による共通化。
- Hosted URL 向け E2E 自動化。
- Hosted Preview の実機受入完了判定。
- staging / manual promotion / release tag 運用。
- 本番リリース運用。
- Cloud Database / Cross-device synchronization。

将来、workflow trigger、配信先、routing、Vite base、SPA fallback、security policy、public data policy を変更する場合は、この文書も更新します。

## 11. 更新トリガー

次の変更が発生した場合、この文書を更新します。

- PromptTrail CI の trigger、quality gate、必須 check を変更したとき。
- Azure Static Web Apps Deploy の trigger、artifact、routing、secret、public preview の扱いを変更したとき。
- Local-first / IndexedDB の保存境界を変更したとき。
- Hosted Preview を利用した受入基準を追加・変更したとき。
- Public URL に置ける sample data / fixture / asset の基準を変更したとき。

## 12. 関連 Issue / PR / Workflow

### Source of Truth

運用上の優先順位は次の通りです。

1. Workflow YAML
   - 実際の実行仕様。
2. `deployment-and-preview.md`
   - 運用契約、役割、判断基準。
3. GitHub Issue / PR
   - 設計判断と変更履歴。

### Workflow

- `.github/workflows/ci.yml`
- `.github/workflows/azure-static-web-apps-red-flower-0ff1f6100.yml`

### Issue / PR

- Issue #112: GitHub Pages の Development Preview を整備する（廃止済み。Issue #292 参照）。
- PR #113: Issue #112 の実装。
- Issue #114: Azure Static Web Apps の Public Preview を正常化する。
- PR #115: Issue #114 の実装。
- Issue #117: Deployment / Hosted Preview 運用契約を文書化する。
- Issue #292: GitHub Pages（Development Preview）を廃止する。
