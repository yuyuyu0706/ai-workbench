# AI Workbench

AI Workbench は、AI を活用した知的生産・開発作業のためのツール群を育てるモノレポです。

最初のアプリは `apps/prompt-trail` に配置する **PromptTrail** です。PromptTrail は、Prompt・Context・Recipe・Run・Link を作業資産として管理し、AI への依頼から Chat、Issue、PR、成果物までの Trail を追跡できるようにすることを目指します。

詳細な要件、ロードマップ、設計判断は `docs/` 配下のドキュメントを正本として管理します。

## 開発環境

このリポジトリは pnpm Workspace として管理します。npm / yarn の lockfile は利用せず、依存関係はルートで `pnpm install` を実行して取得します。

- Node.js: `.nvmrc` に記載した `20.20.0` 以上
- pnpm: `package.json` の `packageManager` に記載した `10.28.1` 以上
- Workspace 対象: `apps/*`

```bash
corepack enable
pnpm install
```

ルートの `dev` / `build` / `test` / `lint` スクリプトは、各 Workspace パッケージに同名スクリプトが追加された際に集約実行するための入口です。

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
