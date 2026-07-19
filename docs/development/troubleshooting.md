# 環境・起動・品質ゲートのトラブルシューティング

## 1. 目的と対象

この文書は、PromptTrail の環境構築、起動、品質ゲートで正常系から外れたときの**詳細診断・復旧手順の唯一の正本**です。通常の構築、実行順序、成功判定は[ローカル開発](local-development.md)、マージを止める品質判断と最初の初動は[品質ゲートと開発運用](quality-gates.md)を正とします。Hosted Preview / Deploy の運用判断は[Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md)を参照してください。

本書は Runtime、Dependency Install、Vite、静的品質、Unit / Component Test、Playwright、Browser E2E、build / preview、CI を対象とします。Runtime、設定、lockfile、テスト、アプリ機能の変更で障害を回避しません。不一致を見つけた場合は、原因、影響、再現条件を記録して別 Issue に分離します。

## 2. 正本と優先順位

診断中に文書と実装が異なる場合は、次の一次情報を優先します。

| 情報                                         | 一次情報                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Node.js 推奨バージョン                       | `.nvmrc`                                                                           |
| Node.js / pnpm 最低要件、pnpm 固定バージョン | root `package.json`                                                                |
| root 標準コマンド                            | root `package.json` の `scripts`                                                   |
| PromptTrail 固有コマンド                     | `apps/prompt-trail/package.json` の `scripts`                                      |
| CI 実行順序・timeout                         | `.github/workflows/ci.yml`                                                         |
| E2E server、port、browser project            | `apps/prompt-trail/playwright.config.ts`                                           |
| 品質判断                                     | [品質ゲートと開発運用](quality-gates.md)                                           |
| Hosted Preview / Deploy 判断                 | [Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md) |

## 3. 使い方と調査前の記録

1. [症状別クイックインデックス](#4-症状別クイックインデックス)から対象工程を選びます。
2. 該当章の「最初の確認」を、Workspace root で実行します。
3. 出力の判断ポイントに従い、原因候補を絞ります。
4. 正しい復旧を行い、指定された確認を再実行します。
5. PR の品質判断は[品質ゲートと開発運用](quality-gates.md)へ戻ります。

診断開始前に、少なくとも次を記録します。

```bash
node --version
pnpm --version
git status --short
git rev-parse HEAD
```

必要に応じて、実行コマンド、失敗した CI step / Playwright project、OS と shell、ローカルまたは CI の別、接続先種別と HTTP status、再実行前後の結果を記録します。Token、Secret、Proxy 認証情報、社内限定 URL は Issue / PR やログ共有へ貼り付けません。

## 4. 症状別クイックインデックス

| 症状                                                | 最初に疑う工程             | 詳細                                                            |
| --------------------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| `pnpm` が見つからない、version が異なる             | Runtime / Corepack         | [Runtime](#5-runtime--nodejs--pnpm--corepack)                   |
| frozen lockfile で失敗、registry へ接続できない     | Dependency Install         | [Dependency Install](#6-dependency-install--lockfile--registry) |
| `/src/main.tsx` が 404、5173 を開けない             | Vite dev server            | [Vite](#7-vite-dev-server--browser-起動)                        |
| lint / format だけ失敗                              | Static quality             | [Lint / Format](#8-lint--format-check)                          |
| Unit Test だけ失敗、watch が終わらない              | Vitest / jsdom             | [Unit / Component Test](#9-unit--component-test)                |
| Chromium 導入で失敗                                 | Playwright install         | [Playwright Chromium](#10-playwright-chromium-導入)             |
| 4173 で E2E が失敗、Desktop / Mobile の片方だけ失敗 | Browser E2E                | [Browser E2E](#11-browser-e2e)                                  |
| build だけ失敗、preview が表示できない              | production build / preview | [Build / Preview](#12-production-build--preview)                |
| ローカル成功・CI失敗                                | 環境差 / CI                | [ローカルと CI の差](#13-ローカル成功ci失敗)                    |
| Deploy 成功・CI失敗                                 | CI / Deploy の責務         | [Deploy と CI](#14-deploy成功ci失敗)                            |

## 5. Runtime / Node.js / pnpm / Corepack

**症状:** Node.js が古い、`.nvmrc` と異なる、`pnpm: command not found`、または pnpm version が manifest と異なります。  
**対象工程:** Runtime / Corepack。

### 最初の確認

```bash
node --version
corepack --version
pnpm --version
cat .nvmrc
```

### 判断と次のアクション

- `node` 自体が見つからない、または version が `.nvmrc` の推奨値・root `package.json` の `engines` 最低要件を満たさない場合は、Node.js を切り替えてから確認をやり直します。nvm は復旧手段の一例であり必須ではありません。利用可能なら `nvm install`、`nvm use` を使えます。
- `corepack` が見つからない場合は、利用中の Node.js 配布物に Corepack が含まれるかを確認し、要件を満たす Node.js を使用します。
- `pnpm` が見つからない場合は、Workspace root で `corepack enable` を実行してから `pnpm --version` を再確認します。
- pnpm version が root `package.json` の `packageManager` と異なる場合は、Corepack が管理する固定 version を有効にして再確認します。グローバル pnpm の更新だけで合わせません。
- `corepack enable` が権限で失敗する場合は、管理者権限を無条件に使わず、Node.js のインストール場所と組織の端末管理方針を確認します。修正できない環境なら、失敗内容を記録して管理者・環境提供者へ依頼します。

**やってはいけない回避策:** `engines` や `packageManager` を環境に合わせて書き換えること、未確認のグローバル pnpm を使い続けること。  
**復旧後の成功判定:** `node --version` と `pnpm --version` が一次情報に一致し、`pnpm install --frozen-lockfile` へ進めます。  
**関連正本:** [ローカル開発](local-development.md)。

## 6. Dependency Install / lockfile / registry

**症状:** `pnpm install --frozen-lockfile` が失敗する、lockfile 不一致、registry 接続・DNS・Proxy・TLS・証明書エラーが出ます。  
**対象工程:** Dependency Install。

### 最初の確認

```bash
pnpm install --frozen-lockfile
git status --short
```

失敗ログから、manifest / lockfile 不一致なのか、接続先と HTTP status を含むネットワーク障害なのかを分けます。

### 判断と次のアクション

- manifest と lockfile の不一致なら、現在の branch / commit と意図した依存変更を確認します。この Issue では lockfile を更新して回避しません。依存変更が本来必要なら別 Issue / PR の変更として扱います。
- registry 接続失敗なら、接続先 URL、DNS、Proxy、TLS、証明書、組織ネットワークの可否を確認します。一時障害の可能性がある場合は、同じ commit で再実行し、前後の結果を記録します。
- `apps/prompt-trail` 配下で実行していた場合は root へ戻り、Workspace root から frozen install を実行します。
- install 後に `git status --short` で lockfile や不要な lockfile が変わっていないことを確認します。

**やってはいけない回避策:** 理由なく `--no-frozen-lockfile` を付けること、ネットワーク障害を依存追加・lockfile 更新で隠すこと、npm / yarn lockfile を生成すること、アプリ配下で個別 install すること。  
**復旧後の成功判定:** frozen install が終了コード 0 で完了し、lockfile に意図しない差分がありません。以降の正常系・品質ゲートを再開します。  
**関連正本:** [ローカル開発](local-development.md)、[品質ゲートと開発運用](quality-gates.md)。

## 7. Vite dev server / browser 起動

**症状:** `pnpm dev` が起動しない、browser から接続できない、`/src/main.tsx` が 404、HTML だけで React が起動しない、5173 が競合します。  
**対象工程:** Vite dev server。

### 最初の確認

Workspace root で Vite を起動し、ログの `Local:` URL を確認します。

```bash
pnpm dev
# または
pnpm --filter prompt-trail dev
```

### 判断と次のアクション

- `/src/main.tsx` が 404、または TSX がそのまま配信される場合は、`python3 -m http.server` などの静的 HTTP server で source を直接配信していないかを確認します。Vite を正規の起動方法として使用します。
- 5173 が競合する場合、dev server は代替 port を提示します。Vite ログの `Local:` URL を browser で開きます。既存 process を所有者・用途の確認なしに終了しません。
- browser 接続不可なら、Vite process が継続しているか、表示された host / port と browser URL が一致するか、ローカル firewall・container port forwarding の要否を確認します。
- HTML は見えるが React が起動しない場合は、browser console と Vite terminal の最初のエラーを確認し、依存 install が成功しているか、import 解決エラーがないかを確認します。実装不備なら内容を記録し、修正は別の対象 Issue とします。

### 5173 / 4173 の区別

| 種別    | 標準 port | 競合時                      |
| ------- | --------: | --------------------------- |
| dev     |      5173 | Vite が代替 port を提示する |
| preview |      4173 | Vite が代替 port を提示する |
| E2E     | 4173 固定 | `strictPort` により失敗する |

**やってはいけない回避策:** Workspace root 以外で起動すること、静的 HTTP server を Vite の代わりに使うこと。  
**復旧後の成功判定:** Vite ログの `Local:` URL で Application Shell と Dashboard を確認できます。  
**関連正本:** [ローカル開発](local-development.md)。

## 8. Lint / Format Check

**症状:** ESLint error / warning、React Hooks / Fast Refresh rule 違反、Prettier の整形差分、CI だけの Format Check 失敗が発生します。  
**対象工程:** Static quality。

### 最初の確認

```bash
pnpm lint
pnpm format:check
```

### 判断と次のアクション

- lint は最初に失敗したファイル、rule、warning を確認します。`--max-warnings 0` のため warning も解消対象です。rule の意図とコードを確認し、必要な最小修正を別の機能対象として行います。
- format は出力された対象ファイルを確認します。整形が必要な場合だけ `pnpm format` を実行し、`git diff` で変更範囲を確認してから `pnpm format:check` を再実行します。
- ローカル成功・CI失敗は、同じ commit を checkout しているか、未保存・未コミットの整形差分がないかを確認します。

**やってはいけない回避策:** warning を許容する設定変更、理由のない rule 無効化、CI での自動 format、diff を見ない整形結果のコミット。  
**復旧後の成功判定:** 対象ゲートが終了コード 0 で完了し、整形した場合は意図した `git diff` のみが残ります。  
**関連正本:** [品質ゲートと開発運用](quality-gates.md)。

## 9. Unit / Component Test

**症状:** role / heading / text の期待値、jsdom setup、fake IndexedDB が失敗する、または `test:watch` が終了しません。  
**対象工程:** Vitest / jsdom。

### 最初の確認

```bash
pnpm test
# PromptTrail 単体の場合
pnpm --filter prompt-trail test
```

### 判断と次のアクション

- 失敗した role、heading、text が現行の利用者向け表示・状態と一致するかを確認します。テストを実装都合の CSS class や配列順に合わせて変えることは避けます。
- jsdom setup または fake IndexedDB が失敗する場合は、最初の stack trace と test setup を確認し、依存 install の完了と対象 test の実行環境を切り分けます。
- `test:watch` は継続監視用途のため終了しません。通常の品質確認には `pnpm test` を使用します。
- 実 browser、Vite server、viewport、browser IndexedDB 経路の問題は Unit Test だけで解決しようとせず、E2E の章へ進みます。

**やってはいけない回避策:** 実 browser の失敗を jsdom の期待値変更で隠すこと、watch を CI や通常の完了確認に使うこと。  
**復旧後の成功判定:** `pnpm test` が終了コード 0 で完了します。画面・browser 経路に影響する変更は必要に応じて E2E と build を続けて確認します。  
**関連正本:** [品質ゲートと開発運用](quality-gates.md)。

## 10. Playwright Chromium 導入

**症状:** Chromium 未導入、Playwright CDN、Proxy、DNS、TLS、証明書、OS 依存 package 導入が失敗します。  
**対象工程:** Browser 導入。

### 最初の確認

```bash
pnpm --filter prompt-trail test:e2e:install
```

CI では `.github/workflows/ci.yml` に従い、次を実行します。

```bash
pnpm --filter prompt-trail test:e2e:install --with-deps
```

### 判断と次のアクション

- JavaScript 依存取得と Chromium 導入は別工程です。前者が失敗するなら[Dependency Install](#6-dependency-install--lockfile--registry)、後者が失敗するなら CDN・DNS・Proxy・TLS・証明書を確認します。
- `--with-deps` だけが失敗する CI は、Ubuntu package source や OS 依存の失敗箇所を記録し、ローカルの browser cache 成否と混同しません。
- 外部ネットワークが疑われる場合は、接続先、HTTP status、同一 commit での再実行前後を残します。

**やってはいけない回避策:** Chromium 導入失敗を lockfile 更新や依存追加で回避すること。  
**復旧後の成功判定:** 導入コマンドが終了コード 0 で終わり、E2E を実行できます。  
**関連正本:** [ローカル開発](local-development.md)、[品質ゲートと開発運用](quality-gates.md)。

## 11. Browser E2E

**症状:** Desktop / Mobile の片方または両方が失敗、web server timeout、4173 競合、別用途 server の再利用、report / trace / screenshot の確認不能が発生します。  
**対象工程:** Playwright / Vite web server。

### 最初の確認

```bash
pnpm test:e2e
# PromptTrail 単体の場合
pnpm --filter prompt-trail test:e2e
```

4173 の listener は、macOS / Linux では次で確認できます。

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Windows PowerShell では次を使います。

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen
```

### 判断と次のアクション

1. Chromium が導入済みかを確認します。
2. 4173 の既存 process が PromptTrail 用か、所有者と用途を確認します。別用途なら安全に停止できるかを判断してから再実行します。
3. Playwright は `http://127.0.0.1:4173` を `strictPort` で使います。CI は既存 server を再利用せず、ローカルだけが同じ URL の既存 server を再利用できます。
4. Desktop だけ失敗する場合は Desktop project、Mobile だけなら Pixel 5 相当 viewport と該当 artifact を比較します。両方なら Vite 起動、route、browser IndexedDB 経路など共通原因から確認します。
5. failure artifact を確認します。`apps/prompt-trail/playwright-report/` は HTML report、`apps/prompt-trail/test-results/` は失敗時の trace / screenshot を含みます。CI では同じパスが failure artifact として upload されます。artifact がない場合は E2E 前の step で止まっていないか確認します。

**やってはいけない回避策:** 4173 の process を用途確認なしに強制終了すること、CI と同じでない server を再利用して成功扱いにすること、片方の project 失敗を無視すること。  
**復旧後の成功判定:** Desktop と Mobile の両 project が終了コード 0 で完了します。続けて production build を確認します。  
**関連正本:** [品質ゲートと開発運用](quality-gates.md)、[ローカル開発](local-development.md)。

## 12. production build / preview

**症状:** TypeScript / Vite build error、import path 不正、preview 前の未 build、古い成果物、dev 成功・preview 失敗が発生します。  
**対象工程:** production build / preview。

### 最初の確認

```bash
pnpm --filter prompt-trail build
pnpm --filter prompt-trail preview
```

Workspace 全体の最終確認には `pnpm build` を使用します。

### 判断と次のアクション

- build が失敗した場合は、最初の TypeScript または Vite error、import path、型エラーを確認します。dev 成功は production build 成功を保証しません。
- preview 前に build を完了させます。表示が古い場合は、現在の branch / commit で build したか、起動中の preview がどの成果物を使っているかを確認します。
- preview の 4173 が競合した場合は、Vite が提示する `Local:` URL を使用します。E2E の固定 4173 と同時実行しません。

**やってはいけない回避策:** dev が動くことだけで production build を省略すること、build していない成果物を preview すること。  
**復旧後の成功判定:** build が終了コード 0 で完了し、preview で production 成果物を表示できます。  
**関連正本:** [ローカル開発](local-development.md)。

## 13. ローカル成功・CI失敗

同じ失敗を再現する前に、対象 commit SHA が同じか、ローカル作業ツリーが dirty でないかを確認します。CI の最初の失敗 step を基準に、以降の未実行 step と混同しません。

| 確認項目            | 確認内容                                      |
| ------------------- | --------------------------------------------- |
| commit / 作業ツリー | `git rev-parse HEAD` と `git status --short`  |
| Runtime             | Node.js / pnpm version と Corepack            |
| install             | `pnpm install --frozen-lockfile` の実施有無   |
| OS                  | CI の Ubuntu とローカル OS の差               |
| Chromium            | CI の `--with-deps` 実行結果                  |
| E2E server          | CI は既存 server を再利用しないこと           |
| Playwright CI 設定  | `forbidOnly`、worker、reporter の CI 時差     |
| 外部要因            | 接続先、HTTP status、同じ commit の再実行結果 |

CI と同じ順序の確認が必要なら、[ローカル開発](local-development.md)の CI 相当の通し確認へ戻ります。外部ネットワークなどの一時障害と判断する場合も、失敗ログと再実行前後の結果を PR に残し、品質ゲートの失敗を自動的に無視しません。  
**復旧後の成功判定:** 同じ head commit で最初に失敗した gate と、必要な全品質ゲートが成功します。

## 14. Deploy成功・CI失敗

Deploy 成功は配信できたこと、CI 成功は品質ゲートを通過したことを意味します。両者を同じ成功とは扱いません。

| 状態              | 切り分け                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| CI NG + Deploy OK | 配信は成功、品質は NG。最初の CI failure を優先して診断します。                       |
| CI OK + Deploy NG | 品質は OK。Deploy、artifact、SPA fallback、Vite base、secret など配信系を診断します。 |

Deploy workflow の詳細、Hosted Preview の責務、公開データの扱いは[Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md)を正とします。本書へ workflow 設定を重複させません。

## 15. 復旧後の再確認

障害箇所だけで完了にせず、影響範囲に応じて正常系・品質ゲートへ戻ります。

| 復旧箇所          | 再確認                                  |
| ----------------- | --------------------------------------- |
| Runtime / Install | frozen install 以降の正常系・品質ゲート |
| Lint / Format     | 対象 gate と `git diff`                 |
| Unit Test         | Unit Test、必要に応じて E2E / build     |
| E2E               | Desktop / Mobile E2E、build             |
| Build / Preview   | build、preview 表示確認                 |
| CI                | 同じ head commit の全品質ゲート         |

## 16. Issue / PR に残す証跡

次を秘密情報なしで記録します。

- 症状、対象 branch、commit SHA、実行環境。
- 失敗 command / CI step / Playwright project。
- error の要約、原因、実施した復旧。
- 再実行 command と復旧後の結果。
- 一時障害の場合は、接続先種別・HTTP status と再実行前後の結果。

## 17. 関連文書

- [ローカル開発](local-development.md): 正常系の構築・起動・build・preview。
- [品質ゲートと開発運用](quality-gates.md): 品質判断、PR 前確認、短い初動表。
- [Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md): Hosted Preview / Deploy の運用判断。
- [root README](../../README.md): リポジトリ全体の入口。
- [PromptTrail README](../../apps/prompt-trail/README.md): アプリ固有の入口。
