# AI Workbench

AI Workbench は、AI を活用した知的生産・開発作業のためのツール群を育てる pnpm Workspace のモノレポです。最初のアプリケーションは `apps/prompt-trail` の **PromptTrail** です。

PromptTrail は、**Project / Prompt / Context / Recipe / Run / Link** の 6 モデルを作業資産として管理し、AI への依頼から Chat、Issue、PR、成果物までの Trail を追跡します。

## 最短セットアップ

リポジトリルート（root `package.json`、`pnpm-workspace.yaml`、`.nvmrc` がある場所）で実行します。Node.js と pnpm の正確な要件は、それぞれ `.nvmrc`、root `package.json` の `engines` と `packageManager` を正とします。

```bash
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

通常は Vite の `http://localhost:5173/` を開きます。ポート競合時は、Vite が表示する `Local:` URL を使用してください。

環境構築、ブラウザ確認、品質確認、build、production preview までの正常系手順と成功判定は、[ローカル開発](docs/development/local-development.md) を唯一の正本とします。

## 主なコマンド

root のコマンドは Workspace 全体の標準入口です。PromptTrail 単体を明示する場合は `--filter prompt-trail` を使います。

```bash
pnpm dev
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build

pnpm --filter prompt-trail dev
pnpm --filter prompt-trail preview
```

`pnpm format:check` は副作用のない確認、`pnpm format` はファイルを書き換える修正コマンドです。品質ゲートの実行順序、PR 前確認、失敗時の調査は [品質ゲートと開発運用](docs/development/quality-gates.md) を参照してください。

## Documentation

- [PromptTrail README](apps/prompt-trail/README.md)
- [ローカル開発](docs/development/local-development.md)
- [品質ゲートと開発運用](docs/development/quality-gates.md)
- [PromptTrail Overview](docs/product/prompt-trail/overview.md)
- [Functional Requirements](docs/product/prompt-trail/functional-requirements.md)
- [Roadmap](docs/product/prompt-trail/roadmap.md)
- [Deployment and Hosted Preview](docs/product/prompt-trail/deployment-and-preview.md)
- [Architecture Decision Records](docs/adr/)
