# AI Workbench

AI Workbench は、AI を活用した知的生産・開発作業のためのツール群を育てるモノレポです。

最初のアプリは `apps/prompt-trail` に配置する **PromptTrail** です。PromptTrail は、Prompt・Context・Recipe・Run・Link を作業資産として管理し、AI への依頼から Chat、Issue、PR、成果物までの Trail を追跡できるようにすることを目指します。

詳細な要件、ロードマップ、設計判断は `docs/` 配下のドキュメントを正本として管理します。

## 最短セットアップ

このリポジトリは pnpm Workspace として管理します。npm / yarn の lockfile は利用せず、依存関係はルートで `pnpm install --frozen-lockfile` を実行して取得します。

前提条件は次のファイルを正とします。

- Node.js: `.nvmrc` に記載した `20.20.0` 以上
- pnpm: root `package.json` の `packageManager` に記載した `10.28.1` 以上
- Workspace 対象: `pnpm-workspace.yaml` に記載した `apps/*`

```bash
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` を実行すると、PromptTrail の Vite 開発サーバーが起動します。既定では `http://localhost:5173/` を開きます。5173 が利用中の場合は Vite が別ポートを表示するため、ターミナルに表示された `Local:` の URL を正としてブラウザで開いてください。停止するときは起動中のターミナルで `Ctrl+C` を押します。

## コマンドの使い分け

品質ゲートの実行順序、変更種別ごとの PR 前確認、失敗時プレイブック、main ブランチ保護の推奨は [品質ゲートと開発運用](docs/development/quality-gates.md) を正本とします。この README は日常的に使うコマンドへの入口です。

ルートコマンドは Workspace 全体の標準入口です。今後アプリやパッケージが増えた場合も、各 Workspace パッケージに同名スクリプトがあれば集約実行します。

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
pnpm format
pnpm format:check
```

PromptTrail だけを対象にする場合は `--filter prompt-trail` を使います。アプリ単体の開発・検証ではこちらを使うと対象が明確になります。

```bash
pnpm --filter prompt-trail dev
pnpm --filter prompt-trail build
pnpm --filter prompt-trail preview
pnpm --filter prompt-trail test
pnpm --filter prompt-trail test:watch
```

## PR 前の最小確認

変更種別ごとのローカル確認は次を目安にします。PR CI では main 向け PR および main への push に対して Install、Lint、Format Check、Unit Test、Chromium 導入、E2E、Build を実行します。詳細な判断基準は [品質ゲートと開発運用](docs/development/quality-gates.md) を参照してください。

| 変更種別                                | PR 前の最小確認                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| 文書のみ                                | `pnpm format:check`                                                          |
| TypeScript / React / CSS                | `pnpm lint`、`pnpm format:check`、`pnpm test`、`pnpm build`                  |
| 画面表示・HTML・Vite・Playwright 設定   | `pnpm lint`、`pnpm format:check`、`pnpm test`、`pnpm test:e2e`、`pnpm build` |
| `package.json` / lockfile / CI workflow | `pnpm install --frozen-lockfile`、全品質ゲート                               |

## 静的品質チェック

ESLint と Prettier は、ローカル開発と CI で同じ結果になる静的品質ゲートとして扱います。CI では自動修正を行わず、違反があれば Lint または Format Check の独立ステップを失敗させます。

```bash
pnpm lint
pnpm format:check
pnpm format
pnpm --filter prompt-trail lint
```

- `pnpm lint`: Workspace 全体の標準 Lint 入口です。各パッケージの `lint` スクリプトを集約し、warning も失敗として扱います。
- `pnpm --filter prompt-trail lint`: PromptTrail 単体の TypeScript / TSX を ESLint Flat Config で確認します。
- `pnpm format:check`: Prettier 対象ファイルの整形差分を検出します。CI ではこの確認だけを実行し、書き換えません。
- `pnpm format`: ローカルで Prettier 対象ファイルを整形します。Format Check で失敗した場合は、差分を確認したうえで実行してください。

## Unit / Component Test

PromptTrail は Vitest と React Testing Library を使い、Node.js 上の jsdom 環境でコンポーネントの意味構造と表示内容を検証します。Unit Test は静的な Welcome Page の意味構造を jsdom 上で高速に検証します。実ブラウザ E2E、Router、IndexedDB、API mock、カバレッジは Unit Test には混在させません。

```bash
pnpm test
pnpm --filter prompt-trail test
pnpm --filter prompt-trail test:watch
```

- `pnpm test`: Workspace 全体の標準テスト入口です。CI ではこのコマンドを 1 回実行します。
- `pnpm --filter prompt-trail test`: PromptTrail 単体の CI 向け非 watch 実行です。
- `pnpm --filter prompt-trail test:watch`: ローカル開発中の watch 実行です。CI では終了しない process を避けるため使用しません。

テストが失敗した場合は、失敗した assertion が Welcome Page の利用者向け文言・見出し・アクセシブルな構造の変更によるものか、テスト環境の依存解決によるものかを切り分けます。意図した文言変更であれば、CSS class や内部配列順ではなく、ユーザーが認識する role / text に基づいてテストを更新してください。

## Build と production preview

production build は、ルート入口とアプリ単体入口の両方で確認できます。

```bash
pnpm --filter prompt-trail build
pnpm build
```

production build 後の表示確認は PromptTrail の preview サーバーで行います。

```bash
pnpm --filter prompt-trail preview
```

preview は既定では `http://localhost:4173/` を表示します。通常の `pnpm dev` と `pnpm --filter prompt-trail preview` では、既定ポートが利用中の場合に Vite が代替ポートを提示します。その場合はログの `Local:` に表示された URL を正としてブラウザで開いてください。停止方法は開発サーバーと同じく `Ctrl+C` です。

## ブラウザ確認観点

開発サーバーまたは preview サーバーを起動し、PC 幅とモバイル幅で次を確認します。

- document title が `PromptTrail` であること。
- Welcome Page が表示されること。
- Prompt・Context・Recipe・Run・Link の 5 つの管理モデルが表示されること。
- `Local first` と `Phase 0` の説明が表示されること。
- PC 幅とモバイル幅で大きな崩れがないこと。
- Phase 0 の静的 Welcome Page として、動作しないボタン、疑似ナビゲーション、保存・検索機能が表示されないこと。

## Browser E2E Test

PromptTrail は Playwright による Chromium E2E を、Unit / Component Test とは独立した品質ゲートとして持ちます。Unit Test は jsdom 上で見出しや意味構造を高速に確認し、E2E は Vite Web Server に実ブラウザで接続できること、document title、Welcome Page の主要表示、Desktop / Pixel 5 相当 Mobile 幅の最小体験を確認します。

ブラウザバイナリは `pnpm install` や postinstall では取得しません。初回またはブラウザキャッシュを消した後に、明示的に Chromium を導入してください。

```bash
pnpm --filter prompt-trail test:e2e:install
pnpm --filter prompt-trail test:e2e
pnpm test:e2e
```

- `pnpm --filter prompt-trail test:e2e:install`: Playwright の Chromium を明示取得します。CI では OS 依存も含めるため `--with-deps` を付けて実行します。
- `pnpm --filter prompt-trail test:e2e`: PromptTrail の Desktop / Mobile Chromium E2E を実行します。Playwright 設定により `http://127.0.0.1:4173/` を `strictPort` で固定使用します。4173 が競合した場合は代替ポートへ切り替わらず失敗します。既存プロセスが PromptTrail の開発サーバーであれば再利用できますが、別用途なら停止してから再実行してください。
- `pnpm test:e2e`: Workspace 全体の標準 E2E 入口です。Unit Test とは分けて実行し、失敗原因を切り分けます。

## よくある失敗と切り分け

- **pnpm が見つからない / バージョンが違う**: `corepack enable` を実行し、`pnpm --version` が root `package.json` の `packageManager` と整合するか確認します。
- **Node.js のバージョンが違う**: `.nvmrc` を参照し、利用している Node.js を `20.20.0` 以上に切り替えます。
- **lockfile 差異で install が失敗する**: 標準は `pnpm install --frozen-lockfile` です。依存更新が必要な場合は、本テーマとは別に理由を明確にして `pnpm-lock.yaml` を更新します。
- **npm registry に接続できない**: `pnpm install --frozen-lockfile` のエラーに出る接続先、HTTP status、プロキシ設定、ネットワーク制約を確認します。依存追加や lockfile 更新で回避しないでください。
- **Lint が失敗する**: `pnpm lint` または `pnpm --filter prompt-trail lint` を実行し、未使用変数、React Hooks ルール、React Fast Refresh ルールの指摘を確認します。warning も失敗として扱うため、警告を残さず修正します。
- **Format Check が失敗する**: `pnpm format:check` の出力で対象ファイルを確認し、ローカルで `pnpm format` を実行してから差分をレビューします。CI では `prettier --write` を実行しません。
- **E2E の Chromium 導入が失敗する**: `pnpm --filter prompt-trail test:e2e:install` のエラーに出る Playwright CDN、DNS、Proxy、TLS、OS 依存の情報を確認します。npm registry の依存取得や lockfile 更新で回避せず、ブラウザ導入ステップの問題として切り分けます。
- **E2E が失敗する**: `pnpm --filter prompt-trail test:e2e` を再実行し、固定ポート `4173` の競合、Vite dev server の起動、Desktop / Mobile project のどちらで失敗したか、`apps/prompt-trail/playwright-report/` と `apps/prompt-trail/test-results/` の trace / screenshot を確認します。4173 が競合している場合は、既存プロセスが PromptTrail の開発サーバーかを確認し、別用途なら停止してから再実行します。
- **Test が失敗する**: `pnpm test` または `pnpm --filter prompt-trail test` を実行し、Welcome Page の見出し、5 つの管理モデル、`Local first`、`Phase 0` の期待値が現在の利用者向け表示と一致しているか確認します。watch が必要なローカル調査では `pnpm --filter prompt-trail test:watch` を使いますが、CI では使いません。
- **ポート競合**: 通常の `pnpm dev` と `preview` は、Vite が `Port 5173 is in use, trying another one...` のように代替ポートを表示した場合、ログに表示された `Local:` URL を開きます。一方、`pnpm test:e2e` は `127.0.0.1:4173` 固定かつ `strictPort` のため、4173 が競合すると代替ポートへ切り替わらず失敗します。

## 構成

- `apps/`: アプリケーション本体を配置します。
- `docs/`: プロダクト、アーキテクチャ、ADR などのドキュメントを配置します。
- `.github/`: GitHub の Issue テンプレートやワークフローを配置します。

## プロダクト

- **PromptTrail**: AI との会話、開発依頼、GitHub Issue、PR、成果物までのつながりを Trail として管理するローカルファーストなワークベンチです。

## Documentation

- [PromptTrail Overview](docs/product/prompt-trail/overview.md)
- [Functional Requirements](docs/product/prompt-trail/functional-requirements.md)
- [Roadmap](docs/product/prompt-trail/roadmap.md)
- [Architecture Decision Records](docs/adr/)
- [Quality Gates and Development Operations](docs/development/quality-gates.md)
