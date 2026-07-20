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
- 初回 A-08 の failure は本 Issue で修正しない。現時点の再実行では再現していないが、`ERR_CONNECTION_REFUSED`（10 passed / 20 failed）が再現した場合は、原因切り分け用 Bug Issue を作成してから再受入する。Hosted 確認未完了のため Issue #148 は open のまま維持する。

## 2. Browser・データ・主要導線（P0-6-3-2）

P0-6-3-2 で記録する。現時点では結果を確定しない。

## 3. Go 判断・Phase 1 引継ぎ（P0-6-3-3）

P0-6-3-3 で記録する。現時点では結果を確定しない。
