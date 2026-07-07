# PromptTrail Application Architecture

このドキュメントは **P0-4-1 完了時点** の PromptTrail アプリケーション構造図を補足するものです。図を主情報とし、この Markdown では図の目的、読み方、現時点の境界と更新条件のみを簡潔に整理します。

![PromptTrail application architecture at P0-4-1](assets/application-architecture-phase0.png)

## 図の目的と読み方

この図は、PromptTrail の起動導線、Runtime から Repository／DB への依存注入、UI が利用できる境界を確認するための構造図です。実装済みの導線と、後続 P0-4 で拡張予定の領域を混在させ、現在どこまでが有効なアプリケーション境界かを把握できるようにしています。

### 凡例

- **実線**: P0-4-1 完了時点で実装済みの依存・呼び出し。
- **破線**: 後続 P0-4 で実装予定の依存・構成。
- **赤注記**: 禁止事項または設計上の注意点。

## 現行の主導線

P0-4-1 完了時点の起動から UI 表示までの主導線は次の通りです。

```text
index.html
  → main.tsx
  → mountPromptTrailApplication()
  → ApplicationBootstrap
  → PromptTrailRepositoryProvider
  → App
```

`main.tsx` は `#root` を取得し、`mountPromptTrailApplication()` を呼び出します。`mountPromptTrailApplication()` は Runtime を生成または受け取り、React root の中で `ApplicationBootstrap` と `App` を組み立てます。`ApplicationBootstrap` は Runtime の初期化状態を管理し、初期化完了後に `PromptTrailRepositoryProvider` へ同一 Repository instance を渡します。

## Runtime と Repository 公開境界

Runtime はアプリケーション起動時に単一の PromptTrail DB instance を生成または受け取り、その同一 DB を `PromptTrailRepository` へ注入します。UI へは DB そのものではなく、Runtime が保持する同じ Repository instance だけを `PromptTrailRepositoryProvider` 経由で公開します。

この境界により、UI は Repository の公開 API だけを利用します。UI コンポーネント、Page、将来の Router／AppShell は Dexie や IndexedDB へ直接アクセスしてはいけません。DB schema や IndexedDB 固有の詳細は Repository／DB 層の責務として閉じ込めます。

## 各領域の責務

- **Runtime**: DB instance の作成または受け取り、Repository への DB 注入、DB open／close を含むライフサイクル管理を担う。
- **Bootstrap**: Runtime 初期化の実行、起動中／失敗／準備完了の表示切り替え、準備完了後の Provider 配置を担う。
- **Provider**: Runtime が公開する同一 Repository instance を React Context として UI に渡す境界を担う。
- **Repository／DB**: Dexie／IndexedDB を使った永続化、DB schema、Repository 公開契約、ドメインデータ操作を担う。
- **共通 UI Foundation**: Button、PageHeader、StateMessage、デザイントークンなど、Page 実装から再利用する UI 基盤を担う。

## 後続 P0-4 の予定領域

Router、AppShell、主要 Pages は後続 P0-4 の予定領域です。P0-4-1 完了時点では、これらのアプリケーション構成要素は未実装であり、現在の `App` は WelcomePage を表示する最小構成です。

後続実装では、Router／AppShell／Pages も Repository 公開 API を利用する UI 層として扱い、Dexie／IndexedDB へ直接アクセスしない原則を維持します。

## 更新トリガー

この図と補足ドキュメントは、次の変更が入ったときに更新を検討します。

- Router／AppShell／主要 Pages の実装。
- Runtime／Bootstrap／Provider の責務または依存関係の変更。
- DB schema／Repository 公開契約の変更。
- 共通 UI Foundation の責務、構成、依存関係の変更。
