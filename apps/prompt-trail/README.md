# PromptTrail

PromptTrail は、Prompt・Context・Recipe・Run・Link を扱うローカルファーストなアプリケーションです。

AI への依頼を単なるプロンプトとして保存するだけでなく、背景情報、作業レシピ、実行履歴、外部リンクをまとめて管理し、Chat、Issue、PR、Commit、Document などの成果物を紐付けます。

## 目的

- Prompt と Context を再利用可能な作業資産として管理します。
- Recipe によって Prompt と Context を組み合わせ、安定した依頼文を生成します。
- Run と Link によって、実際に利用した依頼と Chat、Issue、PR、Commit、Document などの成果物を紐付けます。
- ChatGPT による構想整理、GitHub Issue 化、Codex への実装依頼、PR 確認までの流れを一本の Trail として辿れるようにします。

## 最短手順

リポジトリルートで前提条件と依存関係を確認します。

```bash
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
```

前提条件は root の `.nvmrc`、root `package.json` の `packageManager`、`pnpm-lock.yaml` を正とします。標準の依存取得は `pnpm install --frozen-lockfile` です。

## 開発サーバー

Workspace 全体の入口から PromptTrail を起動する場合は、リポジトリルートで次を実行します。

```bash
pnpm dev
```

PromptTrail 単体を明示して起動する場合は、次を実行します。

```bash
pnpm --filter prompt-trail dev
```

どちらも Vite 開発サーバーを起動します。既定 URL は `http://localhost:5173/` です。ポートが使われている場合は Vite が代替ポートを表示するため、ログの `Local:` に表示された URL をブラウザで開いてください。停止は `Ctrl+C` です。

## 静的品質チェック

PromptTrail の TypeScript / TSX は、root の ESLint Flat Config で確認します。React Hooks と React Fast Refresh の基本ルールも対象です。

```bash
pnpm --filter prompt-trail lint
```

Workspace 全体の品質ゲートとしては、リポジトリルートで次を実行します。

```bash
pnpm lint
pnpm format:check
```

整形差分を直す場合のみ、ローカルで次を実行します。CI は自動修正せず、Lint と Format Check の違反を失敗として表示します。

```bash
pnpm format
```

## Build と preview

PromptTrail 単体の build は次で確認します。

```bash
pnpm --filter prompt-trail build
```

Workspace 全体の build 入口は次です。

```bash
pnpm build
```

production build の表示確認は次で行います。

```bash
pnpm --filter prompt-trail preview
```

preview は既定では `http://localhost:4173/` を表示します。4173 が利用中の場合は、開発サーバーと同様に Vite ログの `Local:` URL を正とします。停止は `Ctrl+C` です。

## ブラウザ確認観点

開発サーバーまたは preview サーバーで、PC 幅とモバイル幅の両方を確認します。

- document title が `PromptTrail` であること。
- Welcome Page が表示されること。
- Prompt・Context・Recipe・Run・Link の 5 つの管理モデルが表示されること。
- `Local first` の説明が表示されること。
- `Phase 0` の説明が表示されること。
- 大きなレイアウト崩れがないこと。
- Phase 0 の静的画面として、動作しないボタン、疑似ナビゲーション、保存・検索機能が表示されないこと。

Playwright はこの段階では恒久依存として追加しません。スクリーンショットは実ブラウザ確認後の補助確認としてのみ扱います。

## よくある失敗と切り分け

- **pnpm が使えない**: `corepack enable` を実行し、`pnpm --version` が root `package.json` の `packageManager` と整合するか確認します。
- **Node.js が古い**: root `.nvmrc` の `20.20.0` 以上に切り替え、`node --version` を確認します。
- **`pnpm install --frozen-lockfile` が lockfile 差異で失敗する**: `pnpm-lock.yaml` と `package.json` の差異を確認します。依存更新が必要な場合は別テーマとして理由を明確にします。
- **npm registry に接続できない**: エラーに表示される接続先、HTTP status、プロキシ設定、ネットワーク制約を確認します。
- **Lint が失敗する**: `pnpm --filter prompt-trail lint` の出力を確認し、TypeScript / TSX の未使用変数、React Hooks、React Fast Refresh の指摘を warning も含めて解消します。
- **Format Check が失敗する**: root で `pnpm format:check` の対象ファイルを確認し、必要に応じて `pnpm format` を実行して差分をレビューします。CI では自動整形しません。
- **5173 / 4173 が使えない**: Vite が代替ポートを表示します。固定ポート設定は導入せず、ログに出た URL を開きます。

## 現在の状態

現時点では Phase 0 の静的 Welcome Page です。画面遷移、保存、検索、データ管理、E2E テストは後続テーマで扱います。

## Documentation

- [PromptTrail Overview](../../docs/product/prompt-trail/overview.md)
- [Functional Requirements](../../docs/product/prompt-trail/functional-requirements.md)
- [Roadmap](../../docs/product/prompt-trail/roadmap.md)
- [Architecture Decision Records](../../docs/adr/)
