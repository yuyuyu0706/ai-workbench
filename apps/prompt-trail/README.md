# PromptTrail

PromptTrail は、AI を活用した作業の Trail を追跡するローカルファーストなアプリケーションです。**Project / Prompt / Context / Recipe / Run / Link** の 6 モデルを扱い、Chat、Issue、PR、Commit、Document などの成果物を紐付けます。

## 現在のアプリケーション構成

- `/` は `/dashboard` へ遷移します。
- Dashboard と Global Navigation から Prompt Library、Context Library、Recipe Builder へ移動できます。
- `/runs/:runId` は Run Detail、未知の URL は Not Found と Dashboard への回復導線を提供します。
- ブラウザの IndexedDB を使うため、新しい browser / origin では Dashboard が empty state になる場合があります。これはローカル起動失敗を意味しません。

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

- [ローカル開発の正本](../../docs/development/local-development.md)
- [品質ゲートと開発運用](../../docs/development/quality-gates.md)
- [環境・起動・品質ゲートのトラブルシューティング](../../docs/development/troubleshooting.md)
- [Deployment and Hosted Preview](../../docs/product/prompt-trail/deployment-and-preview.md)
- [PromptTrail Overview](../../docs/product/prompt-trail/overview.md)
- [Functional Requirements](../../docs/product/prompt-trail/functional-requirements.md)
- [Roadmap](../../docs/product/prompt-trail/roadmap.md)
