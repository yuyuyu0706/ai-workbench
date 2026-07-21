# PromptTrail Phase 0 Acceptance

この文書は Phase 0 の個別受入結果を記録する正本です。手順・設計・workflow の仕様は複製せず、[Local Development](../../development/local-development.md)、[Quality Gates](../../development/quality-gates.md)、[Deployment and Hosted Preview](deployment-and-preview.md) および workflow YAML を参照します。

## 受入の構成と結果値

```text
Phase 0 Acceptance
├─ 1. 再現性・品質・配信（P0-6-3-1）
├─ 2. Browser・データ・主要導線（P0-6-3-2）
└─ 3. Go 判断・Phase 1 引継ぎ（P0-6-3-3）
```

結果値は `PASS`、`FAIL`、`NOT APPLICABLE` のみを使います。未実行項目は `PASS` とせず、実行不能の理由と次の確認条件を記録します。Deploy の成功は品質ゲートの成功を意味しません。

## 1. 再現性・品質・配信（P0-6-3-1）

### 対象と受入環境

| 項目                     | 記録                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Application Baseline SHA | `2d7067cdd06ae21773ade109b10421dff488e8cb`（2026-07-20 時点の作業開始時 `main`）     |
| Acceptance PR Head SHA   | `6aa99ebd8517288b24649b4336d7788167371cd1`（PR #150 の review 時点の head SHA）      |
| 実施日時                 | 2026-07-20 13:40–13:46 UTC                                                           |
| 実行環境                 | Ubuntu 24.04.4 LTS、container local environment                                      |
| Node.js / pnpm           | `v20.20.2` / `10.28.1`（`.nvmrc` の `20.20.0`、manifest の `pnpm@10.28.1` を満たす） |
| Browser                  | Playwright Chromium revision `1228`（`chromium-1228`）                               |
| 実施主体                 | Codex local acceptance run                                                           |

### 受入マトリクス

| ID   | 受入項目              | 種別      | 実行・証拠                                                                                         | 期待結果                           | 結果           | 備考                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | --------------------- | --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Runtime version       | Manual    | `node --version`、`corepack enable`、`pnpm --version`                                              | Node 最低要件・pnpm 固定値を満たす | PASS           | Node `v20.20.2` は `.nvmrc` / engines の最低要件 `20.20.0` 以上、pnpm は固定値 `10.28.1`。                                                                                                                                                                                                                                                                                                                          |
| A-02 | Frozen install        | Command   | `pnpm install --frozen-lockfile`                                                                   | exit 0、差分なし                   | PASS           | exit 0。実行前後の `git status --short` は空、npm / yarn lockfile なし。                                                                                                                                                                                                                                                                                                                                            |
| A-03 | Vite dev startup      | Manual    | `pnpm --filter prompt-trail dev`、`curl http://127.0.0.1:5173/`                                    | 接続可能                           | PASS           | Vite 8.1.3 が起動し、HTTP 200 と PromptTrail の入口 HTML を確認。                                                                                                                                                                                                                                                                                                                                                   |
| A-04 | Lint                  | Command   | `pnpm lint`                                                                                        | exit 0                             | PASS           | warning なし（`--max-warnings 0`）。                                                                                                                                                                                                                                                                                                                                                                                |
| A-05 | Format Check          | Command   | `pnpm format:check`                                                                                | exit 0                             | PASS           | `All matched files use Prettier code style!`。                                                                                                                                                                                                                                                                                                                                                                      |
| A-06 | Unit Test             | Automated | `pnpm test`                                                                                        | 全件成功                           | PASS           | 29 files、130 tests passed、exit 0。                                                                                                                                                                                                                                                                                                                                                                                |
| A-07 | Chromium Install      | Command   | `pnpm --filter prompt-trail test:e2e:install`                                                      | exit 0                             | PASS           | `playwright install chromium`、exit 0。                                                                                                                                                                                                                                                                                                                                                                             |
| A-08 | Browser E2E           | Automated | `pnpm test:e2e`                                                                                    | Desktop / Mobile 成功              | PASS           | 初回 local run は 10 passed / 20 failed（exit 1、11 件目以降で `127.0.0.1:4173` の `ERR_CONNECTION_REFUSED`）。同一 Acceptance PR Head SHA を GitHub tarball から fresh directory に展開して 2026-07-20 13:51–13:53 UTC に再実行した結果は 30 passed / exit 0。CI run #175 も E2E success。この差異を解消するため、failure が再現した場合は原因切り分け用 Bug Issue を作成し、設定・テストを本 Issue で変更しない。 |
| A-09 | Workspace Build       | Command   | `pnpm build`                                                                                       | exit 0                             | PASS           | TypeScript build と Vite production build が成功。                                                                                                                                                                                                                                                                                                                                                                  |
| A-10 | Production Preview    | Manual    | `pnpm --filter prompt-trail preview`、`curl http://127.0.0.1:4173/`                                | 入口表示                           | PASS           | build 済み `dist` を Vite preview で配信し、HTTP 200 と production asset を確認。                                                                                                                                                                                                                                                                                                                                   |
| A-11 | PR CI                 | Automated | [PromptTrail CI run #175](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29748557054)     | 全 step 成功                       | PASS           | PR #150、head `6aa99eb…` の `Quality and build` が success。Install dependencies、Lint、Format check、Unit test、Install Playwright Chromium、E2E、Build workspace の全 step が success。                                                                                                                                                                                                                           |
| A-12 | GitHub Pages          | Deploy    | [Development Preview run #42](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29736160154) | deploy・入口表示                   | NOT APPLICABLE | 成功 run は SHA `8ec2831…` の shared `codex/**` preview で、Baseline SHA の deployment ではない。container の hosted URL 接続は proxy 403 のため入口 smoke も未実施。                                                                                                                                                                                                                                               |
| A-13 | Azure Static Web Apps | Deploy    | [Public Preview run #29](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29743421792)      | deploy・入口表示                   | NOT APPLICABLE | Baseline SHA の deploy job は success。ただし container の hosted URL 接続は proxy 403 のため入口 smoke を実施できず、配信と hosted 表示を合わせた受入を PASS にしない。                                                                                                                                                                                                                                            |

### 品質判定と配信判定

| 判定          | 結果           | 根拠                                                                                                                                                                         |
| ------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Quality | PASS           | A-08 は同一 Acceptance PR Head SHA の fresh directory 再実行で 30 tests が成功した。一方で初回 local failure は観測事実として A-08 に残し、再発時は Bug Issue で切り分ける。 |
| PR CI         | PASS           | PR #150 の `PromptTrail CI / Quality and build` run #175 で Install / Lint / Format / Unit / Chromium / E2E / Build がすべて success。                                       |
| GitHub Pages  | NOT APPLICABLE | Baseline SHA に対応する `codex/**` deployment と hosted smoke の証拠がない。                                                                                                 |
| Azure SWA     | NOT APPLICABLE | Baseline SHA の deploy job は success だが、hosted 入口を確認できていない。                                                                                                  |
| Hosted Smoke  | NOT APPLICABLE | 実行環境の outbound proxy が hosted URL に 403 を返すため。                                                                                                                  |

`Deploy 成功 ≠ 品質保証成功` を維持する。A-11 の CI success と A-08 の同一 SHA に対する再実行 success は品質判定の証拠である一方、初回 local E2E failure は消去せず、実行環境差異の観測として残す。

### P0-6-3-2 への引継ぎ

- 詳細 Browser・データ・主要導線受入の application baseline は `2d7067cdd06ae21773ade109b10421dff488e8cb` とする。ただし E2E failure を修正する変更が main に入る場合は、最新 SHA で本章を再受入する。
- GitHub Pages と Azure Static Web Apps の hosted URL は、この実行環境では到達確認できていない。後続受入は deployment run の environment URL を取得し、実ブラウザで確認する。
- 初回 A-08 の failure は本 Issue で修正しない。現時点の再実行では再現していないが、`ERR_CONNECTION_REFUSED`（10 passed / 20 failed）が再現した場合は、原因切り分け用 Bug Issue を作成してから再受入する。Hosted 確認の残件は Issue #151 へ引き継ぎ済みであり、Issue #148 はクローズ済みである。

## 2. Browser・データ・主要導線（P0-6-3-2）

### 対象 SHA と受入環境

| 項目                        | 記録                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application Baseline SHA    | `2d7067cdd06ae21773ade109b10421dff488e8cb`（P0-6-3-1 から継続）                                                                                                                                                                                                                                          |
| Browser Acceptance Main SHA | `6b343457d12b76c39d1df7554153c4fd851247ed`（PR #150 merge commit。Application Baseline 以降の差分は docs-only）                                                                                                                                                                                          |
| Acceptance PR Head SHA      | `6c520a8c35f1d85fc0ba38535f3462c786c811db`（PR #152 review 時点の head SHA）                                                                                                                                                                                                                             |
| 実施日時                    | 2026-07-20 15:37–15:39 UTC（Local automated acceptance）                                                                                                                                                                                                                                                 |
| 実施主体 / OS               | Codex local acceptance run / Ubuntu 24.04.4 LTS container                                                                                                                                                                                                                                                |
| Browser / viewport          | Playwright Chromium revision `1228`、Desktop `1280×720`、Mobile `390×844`                                                                                                                                                                                                                                |
| Local database              | IndexedDB `prompt-trail`、schema version は DB contract test と Local E2E で確認                                                                                                                                                                                                                         |
| GitHub Pages deployment     | `codex-5b9cai` / `6c520a8…` を ref に workflow dispatch を試行したが、認証情報のない container では GitHub API が HTTP 403 (`Method forbidden`) を返した。manual run、Run、Environment URL は未確認。                                                                                                    |
| Azure SWA deployment        | [Public Preview run #30](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29751806173)、SHA `6b343457d12b76c39d1df7554153c4fd851247ed`、2026-07-20 14:42–14:43 UTC、deploy job success。Environment URL は run API / deployment API から特定できず未確認。                                        |
| PR CI                       | [PromptTrail CI run #178](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29756758075)、SHA `6c520a8c35f1d85fc0ba38535f3462c786c811db`、`Quality and build` の全工程（Install dependencies / Lint / Format check / Unit test / Install Playwright Chromium / E2E / Build workspace）が success。 |

GitHub Pages と Azure Static Web Apps の結果を `NOT APPLICABLE` とした理由は、deploy の成功ではなく、対象 origin での実ブラウザ確認が必要な本受入の実行環境制約である。未実行の hosted smoke を `PASS` としない。

### B系列受入マトリクス

`PASS` は実行済みの証拠がある項目だけに使う。Local automated evidence と hosted manual evidence は独立して記録する。

| ID   | 受入項目                          | 種別               | 主な環境                    | 実行・証拠                                                                                                                                                | Local 結果     | Hosted 結果    | 備考                                                                                                                                                          |
| ---- | --------------------------------- | ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Fresh DB / 自動 Seed なし         | Manual / Automated | Local / Pages / SWA         | Unit の fresh database test、Local E2E                                                                                                                    | PASS           | NOT APPLICABLE | Local は正常 Empty State。hosted origin は到達不能のため未確認。                                                                                              |
| B-02 | Empty State / 初期化失敗の区別    | Manual             | Local / Pages / SWA         | `DashboardPage` test の empty / failure state                                                                                                             | PASS           | NOT APPLICABLE | Empty State と内部 error を露出しない failure state は別契約。                                                                                                |
| B-03 | Sample Seed `seeded`              | Automated          | Local E2E                   | `seed-sample-data.test.ts`、`dashboard-data-flow.spec.ts`                                                                                                 | PASS           | NOT APPLICABLE | 初回 seed のみ Local automated acceptance で受入。                                                                                                            |
| B-04 | Sample Seed `already-present`     | Automated          | Local E2E                   | `seed-sample-data.test.ts`、`dashboard-data-flow.spec.ts`                                                                                                 | PASS           | NOT APPLICABLE | 再 seed で既存 sample を重複・更新しない。                                                                                                                    |
| B-05 | Sample Seed `conflict` / 非上書き | Automated          | Unit                        | `seed-sample-data.test.ts`                                                                                                                                | PASS           | NOT APPLICABLE | ownership drift、partial / unavailable sample、rollback を検証。                                                                                              |
| B-06 | Dashboard 実データ / Links        | Automated          | Local E2E                   | `dashboard-data-flow.spec.ts`                                                                                                                             | PASS           | NOT APPLICABLE | Recent Run、Project、status、evaluation、Related Links 3 件を確認。                                                                                           |
| B-07 | Run Detail 遷移                   | Automated / Manual | Local                       | `dashboard-data-flow.spec.ts`、`app-shell.spec.ts`                                                                                                        | PASS           | NOT APPLICABLE | Dashboard から `/runs/:runId` へ到達する。                                                                                                                    |
| B-08 | reload 永続化                     | Automated          | Local E2E                   | `dashboard-data-flow.spec.ts`                                                                                                                             | PASS           | NOT APPLICABLE | seed 済み IndexedDB data を reload 後にも表示する。                                                                                                           |
| B-09 | root redirect / Global Navigation | Automated / Manual | 全環境                      | `app-shell.spec.ts`、`quality-baseline.spec.ts`                                                                                                           | PASS           | NOT APPLICABLE | Local の route 契約は成功。hosted browser は未実施。                                                                                                          |
| B-10 | direct URL / reload               | Manual             | Local preview / Pages / SWA | Local production preview で `/dashboard`、`/prompts`、`/contexts`、`/recipes/builder`、`/runs/test-run`、unknown route を Playwright Chromium で各 reload | PASS           | NOT APPLICABLE | 2026-07-20 に 6 route の direct URL と reload を実確認。Pages / SWA は対象 origin 未到達のため未確認。                                                        |
| B-11 | Not Found / Dashboard 復帰        | Automated / Manual | 全環境                      | `app-shell.spec.ts`、`quality-baseline.spec.ts`                                                                                                           | PASS           | NOT APPLICABLE | Local で Not Found から Dashboard recovery を確認。                                                                                                           |
| B-12 | 静的 Start State の分類           | Manual             | 全環境                      | `quality-baseline.spec.ts`、Route Contract                                                                                                                | PASS           | NOT APPLICABLE | Prompt / Context / Recipe は静的 Start State、Run Detail は静的骨格であり障害ではない。                                                                       |
| B-13 | Desktop 表示                      | Automated / Manual | 全環境                      | Local E2E Desktop `1280×720`                                                                                                                              | PASS           | NOT APPLICABLE | 主要表示・操作と重大な横 overflow がないことを確認。                                                                                                          |
| B-14 | Mobile 表示                       | Automated / Manual | 全環境                      | Local E2E Mobile `390×844`                                                                                                                                | PASS           | NOT APPLICABLE | Navigation と Dashboard recovery を確認。                                                                                                                     |
| B-15 | GitHub Pages Hosted Smoke         | Deploy / Manual    | Pages                       | `codex-5b9cai` の manual workflow dispatch を試行                                                                                                         | NOT APPLICABLE | NOT APPLICABLE | GitHub API HTTP 403 により manual run / Environment URL を取得できず、入口・Route・reload を確認不能。                                                        |
| B-16 | Azure SWA Hosted Smoke            | Deploy / Manual    | SWA                         | Public Preview run #30                                                                                                                                    | NOT APPLICABLE | NOT APPLICABLE | SHA `6b343457…` の deploy job success は記録するが、Environment URL 未確認のため Browser smoke は実施不能。                                                   |
| B-17 | Hosted IndexedDB / origin 分離    | Manual             | Local / Pages / SWA         | Local E2E / DB contract、deployment-and-preview の origin contract                                                                                        | PASS           | NOT APPLICABLE | Local `prompt-trail` IndexedDB は automated contract で確認。`localhost ≠ github.io ≠ azurestaticapps.net` の実ブラウザ比較は hosted URL 未到達のため未確認。 |

### 自動テストと Local production preview

- `pnpm test` は PASS。Sample Seed の fresh / idempotent / conflict / rollback 契約、Dashboard の Empty State、実データ表示を含む。
- `pnpm --filter prompt-trail test:e2e:install` は PASS。Playwright Chromium revision `1228` を使用可能にした。
- `pnpm test:e2e` は 30 test の Local Browser suite として実行した。root redirect、Global Navigation、direct URL、Not Found recovery、Desktop / Mobile、seed 後の Dashboard と reload 永続化の既存契約を対象とする。並行実行で port `4173` を使用中にした run は受入結果に用いず、P0-6-3-1 で記録した fresh directory の 30 passed / exit 0 を Local E2E の確定証拠とする。
- `pnpm --filter prompt-trail build`、Vite production preview、Playwright Chromium を用いて 2026-07-20 に Local direct URL / reload を実確認した。`/dashboard`、`/prompts`、`/contexts`、`/recipes/builder`、`/runs/test-run`、unknown route はいずれも HTTP 200 で、各 route の reload 後に期待する画面を表示した。

### Hosted・origin 境界の判定

GitHub Pages は `codex-5b9cai` / `6c520a8…` を対象とする manual dispatch を試行したが、認証情報のない container では GitHub API が HTTP 403 を返し、run と Environment URL を取得できなかった。Azure SWA は Browser Acceptance Main SHA の Public Preview run #30 が success であることを確認したが、Environment URL を特定できなかった。Hosted URL を実行環境から開く試行も outbound proxy の HTTP 403 により失敗した。そのため、Hosted URL の入口、Global Navigation、direct URL / reload、desktop / mobile、hosted IndexedDB、および 3 origin 間での実データ非共有は `NOT APPLICABLE` とする。

これは Application defect の `FAIL` ではなく、hosted browser を実行できない受入環境制約である。ただし hosted smoke は未完了であり、実ブラウザから URL に到達できる環境で再受入するまで Issue #151 の完了条件を満たさない。

### P0-6-3-3 への引継ぎ

- **Blocking Defect:** なし。Local automated acceptance で実装不具合は観測していない。hosted smoke は未完了であり、完了判断の前提条件として残す。
- **Known Constraint:** Hosted UI に Sample Seed 導線はない。Hosted は Fresh DB / Empty State / Route / reload / IndexedDB のみを受入し、sample data は Local test で受入する。
- **Known Constraint:** Cloud Sync と cross-device synchronization はない。PC browser と smartphone browser を含め、データは browser origin ごとの IndexedDB に閉じる。
- **NOT APPLICABLE:** GitHub Pages / Azure SWA の実ブラウザ smoke と、`localhost`、`github.io`、`azurestaticapps.net` の実測 origin 分離は、GitHub Pages manual dispatch の API 403、Azure SWA Environment URL 未確認、および container の proxy 403 により実施不能。
- **再受入条件:** Browser Acceptance Main SHA、各 deployment SHA / workflow run / environment URL、日時、Browser version、desktop / mobile viewport を記録し、hosted URL 上で B-01、B-02、B-09〜B-17 を実行する。

## 3. Go 判断・Phase 1 引継ぎ（P0-6-3-3）

### 3.1 判断対象と証拠 SHA

| 項目                     | 記録                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application Baseline SHA | `2d7067cdd06ae21773ade109b10421dff488e8cb`（P0-6-3-1 から継続するアプリ実装の基準）                                                                                                                                      |
| P0-6-3-1 Merge SHA       | `6b343457d12b76c39d1df7554153c4fd851247ed`（PR #150 merge commit）                                                                                                                                                       |
| P0-6-3-2 Merge SHA       | `c9a49c345c73c1bd5fa3670f1b24212ba411a3b3`（PR #152 merge commit）                                                                                                                                                       |
| Go Decision Main SHA     | `2c6da196b2e155fce66012aad257d7a073897b76`（2026-07-21 UTC の作業開始時 HEAD）                                                                                                                                           |
| PR #152 以降の影響確認   | `2f03cff` と `2c6da19` は docs / 作業用ファイルのみで、Application、test、workflow、dependency、build 設定への差分はない。Application Baseline を維持する。                                                              |
| Decision Evidence SHA    | `87a8ec4e80444501d0ba12a7649a26543d8cad6e`（PR #157 の review 対象 head SHA）                                                                                                                                            |
| Final PR Head SHA        | 文書内では固定しない。main マージ前の最終値は PR 本文に記録し、Decision Evidence SHA と区別する。                                                                                                                        |
| Decision PR CI           | [PromptTrail CI run #183](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29838170183) は review 対象 head `87a8ec4…` で success。Install / Lint / Format / Unit / Playwright / E2E / Build の全工程が success。 |

### 3.2 Phase 0 完了判定

**CONDITIONAL GO** とする。Local Foundation は Phase 1 の Golden Path 開発を開始できる状態であり、Phase 1 を阻害する Blocking Defect は確認されていない。一方で Hosted origin の実ブラウザ受入は未完了であるため、Public Alpha の公開は Release Gate 完了を条件とする。

これは開始時の仮説（`Phase 1 の機能開発開始: GO`、`Public Alpha の公開: Hosted 受入完了を条件`）を維持する判断である。Hosted 未確認を Application の `FAIL` や Phase 1 開始の `NO-GO` と混同しない。

### 3.3 C 系列判断マトリクス

| ID   | 判断項目                       | 主な証拠                                     | 結果           | 判断                                                                                                                                                                                                                                     |
| ---- | ------------------------------ | -------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | 再現性・Local Quality          | A-01〜A-10、PR #150 CI                       | PASS           | frozen install、Lint、Format、Unit、Local E2E、Build、preview の証拠がある。                                                                                                                                                             |
| C-02 | PR CI                          | PR #150 / #152 / #157 の CI                  | PASS           | PR #150 run #175、PR #152 run #178、PR #157 [run #183](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29838170183) は success。#183 は Install / Lint / Format / Unit / Playwright / E2E / Build の全工程が success。           |
| C-03 | Local Browser / データ / Route | B-01〜B-14、B-17 Local                       | PASS           | Fresh DB、Seed 契約、Dashboard、Route / reload、Desktop / Mobile、Local IndexedDB を確認済み。                                                                                                                                           |
| C-04 | Blocking Defect                | #148 / #151 の不具合分類、最新 main 差分確認 | PASS           | Phase 1 Golden Path を成立不能にする既知の不具合はない。                                                                                                                                                                                 |
| C-05 | GitHub Pages Hosted 受入       | B-15、Development Preview run #47            | NOT APPLICABLE | [run #47](https://github.com/yuyuyu0706/ai-workbench/actions/runs/29838167707) は deployment SHA `87a8ec4…` で success、Environment URL は `https://yuyuyu0706.github.io/ai-workbench/`。実ブラウザ smoke は未実施のため PASS としない。 |
| C-06 | Azure SWA Hosted Browser 受入  | B-16                                         | NOT APPLICABLE | deploy job success はあるが Environment URL と実ブラウザ smoke が未確認。                                                                                                                                                                |
| C-07 | Hosted IndexedDB / origin 分離 | B-17 Hosted                                  | NOT APPLICABLE | `localhost`、`github.io`、`azurestaticapps.net` の実測比較を未実施。                                                                                                                                                                     |
| C-08 | Phase 1 開発開始条件           | Foundation、Roadmap、#149、#153              | PASS           | 3.6 の全開始条件を満たす。                                                                                                                                                                                                               |
| C-09 | Public Alpha 公開条件          | Hosted Golden Path、制約表示                 | NOT APPLICABLE | Release Gate は未完了であり、公開可否を PASS としない。                                                                                                                                                                                  |
| C-10 | Phase 0 最終判断               | C-01〜C-09                                   | CONDITIONAL GO | Local Foundation は GO、Hosted 公開受入を Public Alpha Release Gate として残す。                                                                                                                                                         |

### 3.4 残課題分類

| 分類                      | 項目                                                                                                        | 根拠・Phase 1 への影響                                           | 担当工程               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| Blocking Defect           | なし                                                                                                        | Phase 1 Golden Path を阻害する不具合は未観測。                   | 継続監視               |
| Non-blocking Defect       | なし                                                                                                        | 回避可能な実不具合は未分類。                                     | 継続監視               |
| Known Constraint          | データは browser origin ごとの IndexedDB に閉じ、端末間同期はない。storage 削除等で失われ得る。             | Local-first の意図した制約。Phase 1 の案内と UI 表示で維持する。 | Phase 1 UX / 公開工程  |
| Known Constraint          | Hosted UI に Sample Seed 導線はない。Cloud Sync、Authentication、Backend API はない。                       | Phase 0 の受入範囲外であり、公開用データを前提にしない。         | Phase 1 / Future Scope |
| Phase 1 Scope             | 既定 Project、Prompt 保存、Run と Prompt Snapshot、手動 Link、Trail、再利用、制約表示、Feedback。           | [Roadmap](roadmap.md) と Issue #149 / #153 を正本とする。        | Phase 1                |
| Public Alpha Release Gate | Hosted Golden Path、Hosted IndexedDB、Desktop / Smartphone、direct URL / reload、制約表示、公開データ確認。 | 開発開始を止めないが、公開前に満たす。                           | Phase 1 公開工程       |
| Future Scope              | Project Workspace / 本格 CRUD、Library、Recipe Builder、検索・タグ・版管理、GitHub API、認証、Cloud Sync。  | Phase 2 以降へ延期し、Phase 1 に先行実装しない。                 | Future Phase           |

### 3.5 CONDITIONAL GO の条件

Phase 1 の機能開発開始は `GO` とする。Public Alpha の公開は 3.7 の Azure SWA Public Preview Release Gate を満たし、最終 PR CI が success であることを条件とする。GitHub Pages の未確認だけで Public Alpha を自動的に `NO-GO` にはしないが、Development Preview の運用残件として解消する。

### 3.6 Phase 1 開発開始条件

- [x] Repository / Dexie / IndexedDB 境界を利用できる。
- [x] Local Quality Gates と既存 PR CI が成立している。
- [x] Local Browser の Route / reload / Desktop / Mobile が成立している。
- [x] Phase 1 Golden Path を阻害する Blocking Defect がない。
- [x] Phase 1 の正本として Roadmap、Issue #149、Issue #153 を利用できる。
- [x] Phase 1 で維持する設計境界を 3.8 に明文化している。
- [x] Public Alpha 公開前に満たす Release Gate を 3.7 として分離している。

### 3.7 Public Alpha Release Gate

Azure SWA Public Preview では、対象 SHA / workflow run / Environment URL を特定し、公開 URL で入口、Global Navigation、Golden Path、direct URL / reload、Desktop / Smartphone、Hosted origin の IndexedDB、Feedback 導線を実ブラウザで確認する。Local-first、origin 分離、端末間非同期、storage 削除時のデータ消失リスクを利用者に表示し、公開データに Secret、個人情報、社内限定情報を含めない。

GitHub Pages Development Preview では、対象 branch / SHA の workflow、deployment SHA / run / Environment URL を特定し、main マージ前の Hosted 確認に利用できることを確認する。Azure SWA Public Preview は Public Alpha 公開の必須条件、GitHub Pages Development Preview は開発運用上の受入条件とする。

### 3.8 Phase 1 へ維持する設計境界

- UI は Dexie / IndexedDB に直接依存せず、Repository を永続化の公開境界とする。
- Run には実行時の Prompt Snapshot を保存し、Recipe を Run 作成の必須条件にしない。
- Public Alpha は既定 Project を冪等に作成・自動利用し、Project 選択画面や Workspace を先行完成させない。
- Link は URL / 種別 / 役割の手動登録から開始し、外部 URL へ自動アクセスしない。
- Local-first、origin 分離、端末間非同期を維持し、E2E は最初の Trail 作成、再利用、Hosted 公開の Golden Path を優先する。

### 3.9 Phase 1 正本・Issue への引継ぎ

Phase 1 の目的、必須体験、進捗の正本は [Roadmap](roadmap.md)、[Issue #149](https://github.com/yuyuyu0706/ai-workbench/issues/149)、[Issue #153](https://github.com/yuyuyu0706/ai-workbench/issues/153) とする。本章は Phase 0 の最終判断だけを記録し、重複する `phase-1-handoff.md` は作成しない。

### 3.10 最終結論

Phase 0 Foundation は **CONDITIONAL GO** で完了判断へ進める。Phase 1 の開発を開始し、Public Alpha は Hosted Release Gate と最終 PR CI の成功を確認してから公開する。親 Issue #147 には、本章の SHA 区分、C 系列判断、残課題分類、開始条件、Release Gate、設計境界を引き継ぐ。
