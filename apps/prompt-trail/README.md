# PromptTrail

PromptTrail は、AI を活用した作業の Trail を追跡するローカルファーストなアプリケーションです。**Project / Prompt / Context / Recipe / Run / Link** の 6 モデルを扱い、Chat、Issue、PR、Commit、Document などの成果物を紐付けます。

## 現在のアプリケーション構成

- `/` は Public Alpha Guideを表示し、DashboardとFeedbackへの入口を提供します。
- 現行のGlobal Navigationは「はじめに」と「Dashboard」です。Prompt Library、Context Library、Recipe Builderの既存routeはdirect accessできますが、未完成の間は主要Navigationに表示しません。
- `/runs/:runId` は Run Detail、未知の URL は Not Found と Dashboard への回復導線を提供します。
- ブラウザの IndexedDB を使うため、新しい browser / origin では Dashboard が empty state になる場合があります。これはローカル起動失敗を意味しません。

Phase 1のPublic Alpha公開は完了しています。Phase 2では、Prompt Libraryを実データへ接続した時点で主要Navigationへ戻し、Prompt資産管理、Trail名・Trail種別、過去Trailへの到達性を補完してから利用観察を行う計画です。詳細は[Roadmap](../../docs/product/prompt-trail/roadmap.md)を参照してください。

## 最短起動

依存取得とコマンドは、アプリ配下ではなくリポジトリルートで実行します。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

PromptTrail 単体を明示する場合は次を使います。

```bash
pnpm --filter prompt-trail dev
```

通常は `http://localhost:5173/` を開き、ポート競合時は Vite の `Local:` URL を使用します。

## 主なコマンド

```bash
# Workspace 全体
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build

# PromptTrail 単体
pnpm --filter prompt-trail lint
pnpm --filter prompt-trail test
pnpm --filter prompt-trail test:watch
pnpm --filter prompt-trail test:e2e:install
pnpm --filter prompt-trail test:e2e
pnpm --filter prompt-trail build
pnpm --filter prompt-trail preview
```

`test:watch` はローカル開発専用で、CI では使用しません。Playwright Chromium はローカル初回、browser cache 削除後、Playwright 更新後に `test:e2e:install` で導入します。

## Documentation

- [PromptTrail Phase 0 Technical Baseline](../../docs/architecture/prompt-trail/README.md)
- [Application Architecture](../../docs/product/prompt-trail/application-architecture.md)
- [PromptTrail Data Model](../../docs/architecture/prompt-trail/data-model.md)
- [ローカル開発の正本](../../docs/development/local-development.md)
- [品質ゲートと開発運用](../../docs/development/quality-gates.md)
- [環境・起動・品質ゲートのトラブルシューティング](../../docs/development/troubleshooting.md)
- [Deployment and Hosted Preview](../../docs/product/prompt-trail/deployment-and-preview.md)
- [PromptTrail Overview](../../docs/product/prompt-trail/overview.md)
- [Functional Requirements](../../docs/product/prompt-trail/functional-requirements.md)
- [Roadmap](../../docs/product/prompt-trail/roadmap.md)
