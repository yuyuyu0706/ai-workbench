# 品質ゲートと開発運用

この文書は、AI Workbench / PromptTrail の品質ゲートと開発運用に関する唯一の正本です。root `README.md` は日常コマンドへの入口、`apps/prompt-trail/README.md` は PromptTrail 固有の入口として扱います。環境構築から preview までの正常系手順は [ローカル開発](local-development.md) を正とし、品質判断と失敗時の運用判断は本書を優先します。

## 目的と対象

対象は、既存の pnpm Workspace、ESLint、Prettier、Vitest、React Testing Library、Playwright Chromium、Vite build、GitHub Actions CI を、後続の機能開発で迷わず継続利用するための運用標準です。

本書では次を定義します。

- 品質ゲートの実行順序、責務、標準コマンド。
- 変更種別ごとの PR 前ローカル確認基準。
- PR CI を全変更に対する最終確認として扱う方針。
- Install、Lint、Format Check、Unit Test、Chromium 導入、E2E、Build の失敗時プレイブック。
- Unit Test と E2E の責務境界、Chromium 導入と npm 依存取得の切り分け、failure artifact の確認方法。
- main ブランチ保護の推奨設定と、GitHub 実設定を別判断として扱う方針。

## 非対象

本運用標準では、品質ゲートやテストツールを追加しません。次は別 Issue で扱います。

- ESLint、Prettier、Vitest、Playwright、Vite、pnpm、GitHub Actions の新規導入、バージョン更新、大幅な設定変更。
- Unit Test、E2E、fixture、mock、Router wrapper、IndexedDB mock、coverage、snapshot、visual regression、アクセシビリティ自動監査の追加。
- CI cache、Playwright browser cache、retry、並列実行、artifact 保存期間の変更。
- GitHub branch protection、required reviewer、administrator bypass、merge queue、Actions secrets、repository settings の実設定変更。

## CI の実行順序

GitHub Actions の `Quality and build` job は、main 向け PR および main への push に対する最終確認です。実行順序は次を正とします。

| 順序 | ゲート                      | 標準コマンド                                              | 役割                                                                                               |
| ---- | --------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1    | Install dependencies        | `pnpm install --frozen-lockfile`                          | root `package.json` と `pnpm-lock.yaml` に基づき、再現可能に npm 依存を取得する。                  |
| 2    | Lint                        | `pnpm lint`                                               | TypeScript / TSX の静的品質、React Hooks、React Fast Refresh ルールを確認する。                    |
| 3    | Format Check                | `pnpm format:check`                                       | Prettier 対象ファイルの整形差分を検出する。CI では自動修正しない。                                 |
| 4    | Unit Test                   | `pnpm test`                                               | jsdom 上で Application Shell、Router、Dashboard、Repository の利用者向け振る舞いを高速に確認する。 |
| 5    | Install Playwright Chromium | `pnpm --filter prompt-trail test:e2e:install --with-deps` | npm 依存とは分離して、Chromium と OS 依存を明示取得する。                                          |
| 6    | E2E                         | `pnpm test:e2e`                                           | Vite Web Server へ Chromium で接続し、Desktop / Mobile の最小体験を確認する。                      |
| 7    | Build workspace             | `pnpm build`                                              | Workspace 全体が production build 可能であることを確認する。                                       |

CI は副作用を持たない確認として扱います。Format Check で失敗しても CI 上で `pnpm format` は実行せず、ローカルで整形し、差分をレビューしたうえでコミットします。

## ローカル確認と PR CI の役割

ローカル確認は PR 前の自己確認です。毎回すべての品質ゲートを機械的に実行するのではなく、変更種別に応じた最小確認を行います。

PR CI は main 向け PR および main への push に対して全品質ゲートを実行する最終確認です。ローカルで最小確認を通していても、PR CI の `Quality and build` が失敗した場合はマージ判断を保留します。

| 変更種別                                | PR 前の最小確認                                                              | PR CI での最終確認 |
| --------------------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| 文書のみ                                | `pnpm format:check`                                                          | 全品質ゲート       |
| TypeScript / React / CSS                | `pnpm lint`、`pnpm format:check`、`pnpm test`、`pnpm build`                  | 全品質ゲート       |
| 画面表示・HTML・Vite・Playwright 設定   | `pnpm lint`、`pnpm format:check`、`pnpm test`、`pnpm test:e2e`、`pnpm build` | 全品質ゲート       |
| `package.json` / lockfile / CI workflow | `pnpm install --frozen-lockfile`、全品質ゲート                               | 全品質ゲート       |

## Unit Test と E2E の責務境界

Unit / Component Test は Vitest、React Testing Library、jsdom を使い、利用者が認識する role、heading、text、主要表示を高速に確認します。CSS class、実装配列順、snapshot などの内部実装詳細に寄せすぎない方針です。

E2E は Playwright Chromium を使い、jsdom では確認できない次の観点へ集中します。

- Vite Web Server へ実ブラウザで接続できること。
- document title が期待通りであること。
- Application Shell、Router、Dashboard、主要 Route、browser IndexedDB 経路が Desktop / Pixel 5 相当 Mobile 幅で動作すること。
- 固定 `http://127.0.0.1:4173/` を `strictPort` で使う E2E 実行時に、Vite dev server が起動または再利用できること。4173 が別用途で利用中の場合、E2E は代替ポートへ切り替わらず失敗すること。

Unit Test と E2E は同じ表示を別レイヤーから確認しますが、細かな DOM 期待値を重複させないことで、失敗原因の切り分けと保守性を優先します。

## Chromium 導入と npm 依存取得の切り分け

`pnpm install --frozen-lockfile` は npm registry から JavaScript 依存を取得するゲートです。Playwright の Chromium 導入は `pnpm --filter prompt-trail test:e2e:install` で明示的に行い、postinstall では取得しません。

この分離により、lockfile 不整合や npm registry 障害と、Playwright CDN、DNS、Proxy、TLS、Ubuntu package source、OS 依存の障害を混同しないようにします。Chromium 導入が失敗した場合、依存追加や lockfile 更新で回避せず、ブラウザ導入ステップの問題として調査します。

## 失敗時プレイブック

| ゲート               | 初動                                                                                                                                                                                                  | 再実行コマンド                                         | 主な調査先                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Install dependencies | Node.js / pnpm version、lockfile 差分、npm registry 接続先を確認する。                                                                                                                                | `pnpm install --frozen-lockfile`                       | `.nvmrc`、root `package.json`、`pnpm-lock.yaml`、HTTP status、Proxy 設定                     |
| Lint                 | 失敗したファイルと rule を確認し、warning も解消する。                                                                                                                                                | `pnpm lint`、`pnpm --filter prompt-trail lint`         | ESLint 出力、TypeScript / TSX、React Hooks、React Fast Refresh                               |
| Format Check         | 対象ファイルを確認し、必要な場合だけローカルで整形する。                                                                                                                                              | `pnpm format:check`、修正時は `pnpm format`            | Prettier 出力、整形後の git diff                                                             |
| Unit Test            | 失敗した role / heading / text が現在の利用者向け表示と一致するか確認する。                                                                                                                           | `pnpm test`、`pnpm --filter prompt-trail test`         | Vitest 出力、Application Shell / Router / Dashboard / Repository、jsdom setup                |
| Chromium 導入        | Playwright CDN、DNS、Proxy、TLS、OS 依存のどこで失敗したか確認する。                                                                                                                                  | `pnpm --filter prompt-trail test:e2e:install`          | エラー URL、HTTP status、証明書、Ubuntu package source                                       |
| E2E                  | Desktop / Mobile のどちらで失敗したか、固定 4173 ポート、Vite 起動、artifact を確認する。4173 が競合した場合は既存プロセスが PromptTrail の開発サーバーかを確認し、別用途なら停止してから再実行する。 | `pnpm test:e2e`、`pnpm --filter prompt-trail test:e2e` | `apps/prompt-trail/playwright-report/`、`apps/prompt-trail/test-results/`、trace、screenshot |
| Build workspace      | TypeScript / Vite build のエラー箇所を確認する。                                                                                                                                                      | `pnpm build`、`pnpm --filter prompt-trail build`       | build 出力、import path、型エラー、Vite 設定                                                 |

外部ネットワーク、GitHub Actions hosted runner、Playwright CDN、Ubuntu package source などが原因と疑われる場合は、コード不備と混同しません。ただし例外扱いにする前に、失敗ログ、接続先、HTTP status、再実行前後の結果を PR に記録し、同じコミットで再実行しても再現するかを確認します。

## Failure artifact の確認

E2E 失敗時、CI は Playwright の report と test results を artifact としてアップロードします。確認対象は次です。

- `apps/prompt-trail/playwright-report/`: Playwright HTML report。
- `apps/prompt-trail/test-results/`: 失敗時の trace、screenshot など。

ローカルでは `pnpm --filter prompt-trail test:e2e` を再実行し、同じ project、viewport、URL で再現するかを確認します。artifact が存在しない場合は、E2E 以前の Install、Lint、Format Check、Unit Test、Chromium 導入で失敗していないかを先に確認します。

## main ブランチ保護の推奨

main への変更は原則 PR 経由とし、`Quality and build` の成功を required check 候補とします。推奨設定は次です。

- Require a pull request before merging: 推奨。
- Require status checks to pass before merging: 推奨。
- Required status check 候補: `Quality and build`。
- Require branches to be up to date before merging: 運用負荷を見ながら判断。
- Required reviewer 数、administrator bypass、conversation resolution、merge queue: 現時点では未確定。必要性が明確になった時点で別途判断する。

本書は推奨と判断条件を記録するものであり、GitHub の branch protection 実設定は変更しません。個人開発・AI 駆動開発で緊急修正が必要な場合でも、例外理由、CI 結果、再確認コマンドを PR または作業ログに残すことを推奨します。

## 追加品質施策の扱い

coverage 閾値、CI cache、Playwright browser cache、retry、Firefox / WebKit、visual regression、アクセシビリティ自動監査は、現時点では導入しません。運用実績から必要性が確認できた場合に、別 Issue として目的、コスト、失敗時の扱いを定義してから追加します。
