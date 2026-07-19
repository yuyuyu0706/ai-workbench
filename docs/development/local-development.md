# ローカル開発

## 1. 目的と対象

この文書は、PromptTrail を新しいローカル環境で再現するための、環境構築から production preview までの**正常系手順の唯一の正本**です。障害の詳細診断は [環境・起動・品質ゲートのトラブルシューティング](troubleshooting.md)、PR の品質判断は [品質ゲートと開発運用](quality-gates.md)、Hosted Preview / Deploy の運用は [Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md) を正とします。

各工程では、目的、実行場所、コマンド、成功判定、次の工程を示します。

## 2. 一次情報と優先順位

コマンドやバージョンをこの文書で独自に定義しません。実装仕様は次を優先します。

| 情報                                         | 一次情報                                            |
| -------------------------------------------- | --------------------------------------------------- |
| Node.js 推奨バージョン                       | `.nvmrc`                                            |
| Node.js / pnpm 最低要件、pnpm 固定バージョン | root `package.json`                                 |
| Workspace 標準コマンド                       | root `package.json`                                 |
| PromptTrail 固有コマンド                     | `apps/prompt-trail/package.json`                    |
| CI 実行順序                                  | `.github/workflows/ci.yml`                          |
| E2E の server、port、browser project         | `apps/prompt-trail/playwright.config.ts`            |
| Route                                        | `apps/prompt-trail/src/app/router.tsx`、`routes.ts` |

現在の基準は Node.js 推奨値 `20.20.0`、Node.js 最低要件 `>=20.20.0`、pnpm 固定値 `10.28.1` です。再現性は `.nvmrc` と `packageManager` の固定値を基準にします。

## 3. 対象環境と前提

- Node.js と Corepack を利用できる環境が必要です。
- 依存取得は Workspace root で行います。`apps/prompt-trail` 配下で npm / yarn の個別 install は行いません。
- npm / yarn の lockfile は生成しません。

## 4. Repository を取得する

**目的:** Workspace の root を取得して作業場所を確定します。  
**実行場所:** 任意の親ディレクトリ。

```bash
git clone <SSH または HTTPS の repository URL>
cd ai-workbench
```

**成功判定:** root に `package.json`、`pnpm-workspace.yaml`、`.nvmrc` が存在します。  
**次の工程:** Node.js を準備します。

## 5. Node.js を準備する

**目的:** 実装が要求する Node.js を利用します。  
**実行場所:** Workspace root。

```bash
node --version
```

必要なら nvm を利用できますが、nvm は必須ではありません。

```bash
nvm install
nvm use
node --version
```

**成功判定:** `.nvmrc` の `20.20.0` を使用し、root `package.json` の `>=20.20.0` を満たします。  
**次の工程:** Corepack と pnpm を準備します。

## 6. Corepack / pnpm を準備する

**目的:** manifest で固定された pnpm を有効化します。  
**実行場所:** Workspace root。

```bash
corepack enable
pnpm --version
```

**成功判定:** `pnpm --version` が root `package.json` の `packageManager` にある `10.28.1` です。  
**次の工程:** frozen install で依存を取得します。

## 7. 依存を取得する

**目的:** lockfile に固定された依存を再現可能に取得します。  
**実行場所:** Workspace root。

```bash
pnpm install --frozen-lockfile
```

**成功判定:** 終了コードが 0、`pnpm-lock.yaml` が変更されず、npm / yarn の lockfile が生成されません。manifest と lockfile が不一致でも `--no-frozen-lockfile` へ変更しません。  
**次の工程:** Vite dev server を起動します。

## 8. Vite dev server を起動する

**目的:** 日常開発用の Vite dev server で PromptTrail を開きます。  
**実行場所:** Workspace root。

```bash
# Workspace 全体の標準入口
pnpm dev

# PromptTrail 単体を明示する入口
pnpm --filter prompt-trail dev
```

**成功判定:** 通常は `http://localhost:5173/` が表示されます。5173 が競合する場合は Vite ログの `Local:` URL を使用します。停止は `Ctrl+C` です。  
**次の工程:** ブラウザで現行 Route を確認します。

## 9. ブラウザを確認する

**目的:** Application Shell、Router、Dashboard が起動していることを確認します。  
**実行場所:** 起動した dev server を開くブラウザ。

- `/` から `/dashboard` へ遷移する。
- Dashboard と Global Navigation を表示できる。
- `/prompts`、`/contexts`、`/recipes/builder` に到達できる。
- `/runs/:runId` が Run Detail として定義されている。
- unknown route が Not Found と Dashboard への回復導線を表示する。
- Desktop / Mobile 幅で重大なレイアウト崩れがない。

**成功判定:** 上記の画面と遷移を確認できます。Fresh Browser では IndexedDB が空のため Dashboard が empty state になる可能性がありますが、異常ではありません。production application に test-only Seed UI を追加せず、sample data の表示を起動成功の必須条件にしません。  
**次の工程:** 静的品質を確認します。

## 10. lint / format check を実行する

**目的:** 静的解析と整形差分を確認します。  
**実行場所:** Workspace root。

```bash
pnpm lint
pnpm format:check
```

整形が必要な場合だけ、次を実行します。

```bash
pnpm format
```

**成功判定:** lint と `format:check` が終了コード 0 で完了します。`format:check` は副作用のない確認、`format` はファイルを書き換える修正コマンドです。  
**次の工程:** Unit / Component Test を実行します。

## 11. Unit / Component Test を実行する

**目的:** Vitest、React Testing Library、jsdom により、利用者が認識する role、heading、text、状態表示を高速に確認します。実ブラウザ、Vite Web Server、Desktop / Mobile 表示は E2E の責務です。  
**実行場所:** Workspace root。

```bash
# 標準確認
pnpm test

# PromptTrail 単体を確認する場合の代替
pnpm --filter prompt-trail test
```

**成功判定:** 標準確認の `pnpm test`、または PromptTrail 単体の代替である `pnpm --filter prompt-trail test` が終了コード 0 で完了します。どちらか一方の完了後に E2E と build へ進めます。

開発中に継続して監視する場合だけ、次を使用します。終了しないため、E2E や build の前提となる通常手順には含めません。

```bash
pnpm --filter prompt-trail test:watch
```

`test:watch` はローカル開発専用で、CI では使用しません。
**次の工程:** 初回など必要な場合は Playwright Chromium を導入します。

## 12. Playwright Chromium を導入する

**目的:** Browser E2E 用の Chromium を準備します。  
**実行場所:** Workspace root。

```bash
pnpm --filter prompt-trail test:e2e:install
```

ローカル初回、browser cache 削除後、Playwright 更新後に実行します。毎回の E2E 前に必要な工程ではありません。CI では OS 依存を含めて次を実行します。

```bash
pnpm --filter prompt-trail test:e2e:install --with-deps
```

**成功判定:** Chromium の導入が終了コード 0 で完了します。  
**次の工程:** Browser E2E を実行します。

## 13. Browser E2E を実行する

**目的:** Playwright で実ブラウザの Router、Dashboard、browser IndexedDB 経路、Desktop / Mobile 表示を確認します。  
**実行場所:** Workspace root。

```bash
pnpm test:e2e
pnpm --filter prompt-trail test:e2e
```

E2E は Playwright が `pnpm exec vite` を管理し、`http://127.0.0.1:4173` を `strictPort` で使用します。Desktop Chrome と Pixel 5 相当 Mobile の project を実行します。production preview は E2E server として利用しません。ローカルでは同じ URL の既存 server を再利用できます。

**成功判定:** Desktop / Mobile の E2E が終了コード 0 で完了します。4173 は `strictPort` で固定のため競合すると失敗します。詳しい診断は[環境・起動・品質ゲートのトラブルシューティング](troubleshooting.md#11-browser-e2e)を参照してください。
**次の工程:** production build を実行します。

## 14. production build を実行する

**目的:** production 成果物を生成できることを確認します。  
**実行場所:** Workspace root。

```bash
# PromptTrail 単体
pnpm --filter prompt-trail build

# Workspace 全体（CI 相当の最終確認）
pnpm build
```

**成功判定:** 対象の build が終了コード 0 で完了します。  
**次の工程:** production preview を確認します。

## 15. production preview を確認する

**目的:** production build 成果物を Vite preview server で確認します。  
**実行場所:** Workspace root。事前に build を完了します。

```bash
pnpm --filter prompt-trail preview
```

**成功判定:** 通常は `http://localhost:4173/` に production 成果物が表示されます。競合時は Vite の `Local:` URL を使用します。`preview` は日常開発の `dev` や Playwright 管理の E2E Web Server とは異なります。  
**次の工程:** 必要に応じて CI 相当の通し確認を実行します。

## 16. CI 相当の通し確認

**目的:** GitHub Actions の `Quality and build` と同じ順序でローカル確認します。  
**実行場所:** Workspace root。

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm test
pnpm --filter prompt-trail test:e2e:install
pnpm test:e2e
pnpm build
```

CI では Chromium 導入に `--with-deps` を付けます。順序は Install dependencies → Lint → Format Check → Unit Test → Install Playwright Chromium → E2E → Build workspace です。

**成功判定:** 各コマンドが終了コード 0 で完了します。  
**次の工程:** PR の品質判断は [品質ゲートと開発運用](quality-gates.md) に従います。

## 17. dev / E2E / preview の比較

| 種別    | 目的                  | 標準ポート | サーバー                      |
| ------- | --------------------- | ---------: | ----------------------------- |
| dev     | 日常開発              |       5173 | Vite dev server               |
| E2E     | 実ブラウザ自動テスト  |  4173 固定 | Playwright 管理の Vite server |
| preview | production build 確認 |       4173 | Vite preview server           |

- 通常の dev / preview は競合時に代替ポートを提示します。
- E2E は `strictPort` のため 4173 が競合すると失敗します。
- origin が異なる場合、IndexedDB は共有されません。dev、preview、Hosted Preview で同じローカルデータが表示されなくても、直ちに異常とは判断しません。

## 18. 関連文書

- [root README](../../README.md): リポジトリ全体の最短入口。
- [PromptTrail README](../../apps/prompt-trail/README.md): アプリ固有の入口。
- [品質ゲートと開発運用](quality-gates.md): 品質判断、PR 前確認、失敗時の初動。
- [環境・起動・品質ゲートのトラブルシューティング](troubleshooting.md): 環境・起動・品質ゲート障害の詳細診断と復旧。
- [Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md): Hosted Preview / Deploy の運用。
