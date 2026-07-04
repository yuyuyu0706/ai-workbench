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

ルートコマンドは Workspace 全体の標準入口です。今後アプリやパッケージが増えた場合も、各 Workspace パッケージに同名スクリプトがあれば集約実行します。

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm format:check
```

PromptTrail だけを対象にする場合は `--filter prompt-trail` を使います。アプリ単体の開発・検証ではこちらを使うと対象が明確になります。

```bash
pnpm --filter prompt-trail dev
pnpm --filter prompt-trail build
pnpm --filter prompt-trail preview
```

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

preview は既定では `http://localhost:4173/` を表示します。4173 が利用中の場合も Vite のログに表示された `Local:` の URL を正としてください。停止方法は開発サーバーと同じく `Ctrl+C` です。

## ブラウザ確認観点

開発サーバーまたは preview サーバーを起動し、PC 幅とモバイル幅で次を確認します。

- document title が `PromptTrail` であること。
- Welcome Page が表示されること。
- Prompt・Context・Recipe・Run・Link の 5 つの管理モデルが表示されること。
- `Local first` と `Phase 0` の説明が表示されること。
- PC 幅とモバイル幅で大きな崩れがないこと。
- Phase 0 の静的 Welcome Page として、動作しないボタン、疑似ナビゲーション、保存・検索機能が表示されないこと。

Playwright は現時点では恒久依存として追加しません。スクリーンショット取得は、実ブラウザ確認を補助する任意の確認に留めます。

## よくある失敗と切り分け

- **pnpm が見つからない / バージョンが違う**: `corepack enable` を実行し、`pnpm --version` が root `package.json` の `packageManager` と整合するか確認します。
- **Node.js のバージョンが違う**: `.nvmrc` を参照し、利用している Node.js を `20.20.0` 以上に切り替えます。
- **lockfile 差異で install が失敗する**: 標準は `pnpm install --frozen-lockfile` です。依存更新が必要な場合は、本テーマとは別に理由を明確にして `pnpm-lock.yaml` を更新します。
- **npm registry に接続できない**: `pnpm install --frozen-lockfile` のエラーに出る接続先、HTTP status、プロキシ設定、ネットワーク制約を確認します。依存追加や lockfile 更新で回避しないでください。
- **Lint が失敗する**: `pnpm lint` または `pnpm --filter prompt-trail lint` を実行し、未使用変数、React Hooks ルール、React Fast Refresh ルールの指摘を確認します。warning も失敗として扱うため、警告を残さず修正します。
- **Format Check が失敗する**: `pnpm format:check` の出力で対象ファイルを確認し、ローカルで `pnpm format` を実行してから差分をレビューします。CI では `prettier --write` を実行しません。
- **ポート競合**: Vite が `Port 5173 is in use, trying another one...` のように代替ポートを表示します。固定ポート設定は導入せず、ログに表示された URL を開きます。

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
