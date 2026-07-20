# PromptTrail Deployment and Hosted Preview

## 1. 文書の目的

この文書は、PromptTrail の Deployment / Hosted Preview 運用契約の正本です。

PromptTrail CI、GitHub Pages Deploy、Azure Static Web Apps Deploy の trigger、責務、成功が意味すること、失敗時の切り分けを、workflow 実装を全文複製せずに運用契約として定義します。

この文書では、Hosted Preview をアプリの hosted 実行環境として扱います。Hosted Preview はクラウドデータ同期環境ではなく、PromptTrail の Local-first / IndexedDB アーキテクチャを変更しません。

## 2. Environment Contract

| Environment           | 位置づけ                   | 対象ブランチ / 成果        | 利用目的                                       |
| --------------------- | -------------------------- | -------------------------- | ---------------------------------------------- |
| Local                 | Development / Debug        | 開発者のローカル作業ツリー | 実装、デバッグ、ローカル確認                   |
| GitHub Pages          | Shared Development Preview | `codex/**` の開発中成果    | `main` マージ前の hosted 確認                  |
| Azure Static Web Apps | Public Preview             | `main` 統合版              | `main` マージ後に自動更新される public preview |

GitHub Pages は `codex/**` ブランチの成果を共有の Development Preview として配信します。GitHub Pages は共有 preview であるため、後続の `codex/**` deployment によって表示内容が置き換わる可能性があります。

Azure Static Web Apps は `main` 統合版の Public Preview です。`main` への push 後に、統合済み成果物を自動配信します。

## 3. 開発から Public Preview までのフロー

```text
Codex
→ codex/** branch へ実装
      │
      └─ GitHub Pages Deploy
         → Development Preview

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

GitHub Pages に表示されたこと自体は、PromptTrail CI の通過を意味しません。Hosted Preview は配信結果の確認場所であり、アプリ品質判定の正本ではありません。

## 4. Workflow Contract

| Workflow                        | Trigger                           | 責務                     | 成功が意味すること                                   |
| ------------------------------- | --------------------------------- | ------------------------ | ---------------------------------------------------- |
| PromptTrail CI                  | PR → `main` / push `main`         | アプリ品質判定           | Lint / Format / Unit / E2E / Build が成功した        |
| PromptTrail Development Preview | `codex/**` push / manual dispatch | Development Preview 配信 | 開発中成果を Shared Development Preview へ配信できた |
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
- **GitHub Pages OK**: `codex/**` 成果を GitHub Pages の Shared Development Preview で確認可能になった。
- **Azure Static Web Apps OK**: `main` 統合版を Public Preview へ配信できた。

### Failure Semantics

| 状態              | 判断                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| CI NG + Deploy OK | 配信は成立したが、アプリ品質ゲートは NG。修正優先度は CI failure の内容に置く。                                                    |
| CI OK + Pages NG  | アプリ品質は OK。Development Preview 配信、Pages 設定、artifact、SPA fallback、Vite base などの配信系問題として切り分ける。        |
| CI OK + SWA NG    | アプリ品質は OK。Public Preview 配信、Azure Static Web Apps 設定、secret、artifact、SPA routing などの配信系問題として切り分ける。 |
| Pages OK          | `codex/**` 成果を hosted 環境で確認可能。ただし品質保証済みとは限らない。                                                          |
| SWA OK            | `main` 統合版を Public Preview へ配信済み。ただし CI 結果とは独立して確認する。                                                    |

## 6. Hosted Preview Contract

Hosted Preview は、PromptTrail frontend 成果物を browser で確認するための hosted 実行環境です。

GitHub Pages Hosted Preview は `codex/**` の開発中成果を `main` マージ前に確認するための Shared Development Preview です。

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

github.io
→ IndexedDB B

azurestaticapps.net
→ IndexedDB C
```

Local、GitHub Pages、Azure Static Web Apps は origin が異なるため、IndexedDB は共有されません。同じユーザーが同じ端末で利用しても、`localhost`、`github.io`、`azurestaticapps.net` のデータは別領域です。

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

- `/` → `/dashboard` へ遷移する入口。
- `/dashboard`。
- `/prompts`。
- `/contexts`。
- `/recipes/builder`。
- `/runs/:runId`。
- unknown route → Not Found / dashboard recovery。

### GitHub Pages

- [ ] `codex/**` push で deploy できる。
- [ ] Dashboard を表示できる。
- [ ] Global Navigation を利用できる。
- [ ] 主要 Route へ到達できる。
- [ ] direct URL で表示できる。
- [ ] browser reload で 404 にならない。
- [ ] Desktop Browser で表示できる。
- [ ] Smartphone Browser で表示できる。
- [ ] Hosted origin 上で IndexedDB を利用できる。

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
- GitHub Pages Deploy の trigger、artifact、base path、SPA fallback、共有 preview の扱いを変更したとき。
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
- `.github/workflows/static.yml`
- `.github/workflows/azure-static-web-apps-red-flower-0ff1f6100.yml`

### Issue / PR

- Issue #112: GitHub Pages の Development Preview を整備する。
- PR #113: Issue #112 の実装。
- Issue #114: Azure Static Web Apps の Public Preview を正常化する。
- PR #115: Issue #114 の実装。
- Issue #117: Deployment / Hosted Preview 運用契約を文書化する。
