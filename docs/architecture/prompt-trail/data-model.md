# Prompt Trail Data Model

Prompt Trail は、AI への依頼から成果までの Trail を Project、Prompt、Context、Recipe、Run、Link の 6 モデルで構造化します。この文書は、全モデルで共有するエンティティ規約と、知識資産の基礎となる Project、Prompt、Context の最小ドメイン契約を記録します。

## 共通エンティティ種別

Prompt Trail の共通ドメイン契約では、次の 6 種類をエンティティ種別として扱います。

- `project`
- `prompt`
- `context`
- `recipe`
- `run`
- `link`

これらは `apps/prompt-trail/src/domain/common.ts` の `PromptTrailEntityKind` として公開し、後続の個別モデル、Dexie schema、Repository、画面モデルが同じ種別名を参照できるようにします。

## ID 規約

各モデルの ID は、実行時・永続化時には通常の文字列として扱います。一方で TypeScript 上では `EntityId<Kind>` による nominal typing を使い、Project ID と Prompt ID など、異なるモデル種別の ID を誤って代入しにくくします。

現時点では ID 生成処理、意味付き ID、DB auto increment の採用有無は未確定です。本 Issue では ID の共通型契約のみを定義し、生成責務は後続 Issue に委ねます。

## 日時規約

日時は ISO 8601 UTC 文字列を前提とし、`UtcDateTimeString` として表します。保存例は `2026-07-04T00:00:00.000Z` のように UTC を明示する形式です。

日時の生成・検証補助関数はまだ追加しません。現段階では型エイリアスと設計規約に留め、実行時バリデーションが必要になった時点で責務を限定して追加します。

## 共通監査項目とライフサイクル

永続化済みエンティティは、`BaseEntity<Kind>` として次の項目を持ちます。

| Field       | Meaning                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| `id`        | モデル種別に紐づく ID。永続化表現は文字列です。                             |
| `createdAt` | エンティティを作成した UTC 日時です。                                       |
| `updatedAt` | 内容更新、論理削除、復元、アーカイブ状態変更のたびに更新する UTC 日時です。 |
| `deletedAt` | 論理削除日時です。通常取得から除外する状態を表し、未削除時は `null` です。  |

`deletedAt` はデータ保護と復元可能性のための論理削除状態です。通常の一覧や候補取得では `deletedAt !== null` のエンティティを除外する前提です。

`archivedAt` は履歴として保持するが通常の利用候補から外す業務状態です。すべてのモデルに必須ではないため、`ArchivableEntity` を archive 可能なモデルにだけ合成します。未アーカイブ時は `null` です。

Project の `archivedAt`、Prompt の `deprecated`、Context の `disabled`、共通の `deletedAt` は統合しません。それぞれの責務は次のとおりです。

| State                  | Applies to | Responsibility                                                                             |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `archivedAt !== null`  | Project    | Project を履歴として残し、通常の利用対象から外します。                                     |
| `status: "deprecated"` | Prompt     | Prompt を削除せず、新規利用候補から外します。                                              |
| `status: "disabled"`   | Context    | Context を削除せず、新規利用候補から外します。                                             |
| `deletedAt !== null`   | All models | 復元可能な論理削除です。通常取得から除外し、archive/deprecated/disabled と別扱いにします。 |

## Scope 規約

Prompt や Context など、後続モデルで共通資産と Project 専用資産の両方になり得るものは `AssetScope` を採用します。

| Scope         | Shape                                        | Rule                                                 |
| ------------- | -------------------------------------------- | ---------------------------------------------------- |
| Global asset  | `{ scope: "global" }`                        | 共通資産を表し、`projectId` を持ちません。           |
| Project asset | `{ scope: "project", projectId: ProjectId }` | Project 専用資産を表し、`projectId` を必須にします。 |

この判別可能 union により、共通資産へ `projectId` を保存したり、Project 専用資産から `projectId` を欠落させたりする組合せを型で作りにくくします。

Project 自身は共通資産／Project 専用資産ではなく、Project 専用資産の所有境界です。そのため Project モデルには `AssetScope` を合成しません。

## Project モデル

Project は作業資産を束ねる単位です。`BaseEntity<'project'>` と `ArchivableEntity` を合成し、次の最小属性だけを持ちます。

| Field           | Type                | Meaning                                            |
| --------------- | ------------------- | -------------------------------------------------- |
| `name`          | `string`            | Project 名です。                                   |
| `description`   | `string \| null`    | Project の説明です。未設定時は `null` です。       |
| `tags`          | `readonly string[]` | Project 分類用タグです。値がない場合も空配列です。 |
| `repositoryUrl` | `string \| null`    | 関連リポジトリ URL です。未設定時は `null` です。  |

Project は `archivedAt` により履歴化できますが、Prompt／Context の `status` や soft delete とは別の業務状態として扱います。

## Prompt モデル

Prompt は再利用可能な Markdown 依頼テンプレートです。`BaseEntity<'prompt'>` と `AssetScope` を合成し、global asset と project asset の両方を表せます。

| Field    | Type                | Meaning                                           |
| -------- | ------------------- | ------------------------------------------------- |
| `title`  | `string`            | Prompt のタイトルです。                           |
| `body`   | `string`            | Markdown 本文です。                               |
| `kind`   | `PromptKind`        | Prompt の用途種別です。                           |
| `status` | `PromptStatus`      | Prompt の利用状態です。                           |
| `tags`   | `readonly string[]` | Prompt 分類用タグです。値がない場合も空配列です。 |

`PromptKind` は初期候補として `chat-consultation`、`codex-request`、`issue-creation`、`design-review`、`incident-analysis`、`other` だけを許容します。`PromptStatus` は `draft`、`active`、`deprecated` だけを許容します。これらは型と `as const` の公開定数として提供しますが、表示ラベル、多言語化、並び順はここでは扱いません。

## Context モデル

Context は背景、制約、設計原則などを表す再利用可能な Markdown 知識資産です。`BaseEntity<'context'>` と `AssetScope` を合成し、global asset と project asset の両方を表せます。

| Field    | Type                | Meaning                                            |
| -------- | ------------------- | -------------------------------------------------- |
| `title`  | `string`            | Context のタイトルです。                           |
| `body`   | `string`            | Markdown 本文です。                                |
| `kind`   | `ContextKind`       | Context の用途種別です。                           |
| `status` | `ContextStatus`     | Context の利用状態です。                           |
| `tags`   | `readonly string[]` | Context 分類用タグです。値がない場合も空配列です。 |

`ContextKind` は初期候補として `project-overview`、`technical-architecture`、`development-rules`、`glossary`、`output-rules`、`other` だけを許容します。`ContextStatus` は `enabled`、`disabled` だけを許容します。これらは型と `as const` の公開定数として提供しますが、表示ラベル、多言語化、並び順はここでは扱いません。

## 保存表現の null / array 規約

永続化済みエンティティでは、単一の任意値は `null` で表し、`undefined` は保存表現に使いません。複数値は、値がない場合も `null` ではなく空配列で表します。

Project の `description` と `repositoryUrl` は単一任意値として `null` を許容します。Project、Prompt、Context の `tags` は、値がない場合も空配列です。Prompt／Context の `scope: "global"` では `projectId` を持たず、`scope: "project"` では `projectId` を必須にすることで、保存表現で `undefined` に意味を持たせない共通規約と整合させます。

この規約により IndexedDB、Export / Import、将来の同期処理で欠損値の意味を揃えます。

## 意図的な未確定事項

本 Issue では Project、Prompt、Context の知識資産モデルだけを確定し、次の事項は後続 Issue で扱います。

- Recipe、Run、Link の個別属性・状態値・参照関係・Snapshot
- Recipe 専用の Context 適用範囲、Context 差し込み順、Prompt 変数の解析・入力形式・必須チェック・初期値
- Prompt 版管理、複製履歴、Prompt 派生元、Context の文字数・推定トークン数、URL 形式検証、タグの重複除去・大小文字正規化
- ID 生成処理、Entity Factory、DB auto increment、意味付き ID
- Dexie schema、IndexedDB `version(1)`、テーブル、索引、DB 初期化
- Repository / Storage、保存・取得・更新・soft delete の実装
- React Router、CRUD 画面、Dashboard、サンプルデータ、Export / Import、同期、認証
