# Prompt Trail Data Model

Prompt Trail は、AI への依頼から成果までの Trail を Project、Prompt、Context、Recipe、Run、Link の 6 モデルで構造化します。この文書は、個別モデルや IndexedDB schema を定義する前に全モデルで共有するエンティティ規約を記録します。

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

## Scope 規約

Prompt や Context など、後続モデルで共通資産と Project 専用資産の両方になり得るものは `AssetScope` を採用します。

| Scope         | Shape                                        | Rule                                                 |
| ------------- | -------------------------------------------- | ---------------------------------------------------- |
| Global asset  | `{ scope: "global" }`                        | 共通資産を表し、`projectId` を持ちません。           |
| Project asset | `{ scope: "project", projectId: ProjectId }` | Project 専用資産を表し、`projectId` を必須にします。 |

この判別可能 union により、共通資産へ `projectId` を保存したり、Project 専用資産から `projectId` を欠落させたりする組合せを型で作りにくくします。

## 保存表現の null / array 規約

永続化済みエンティティでは、単一の任意値は `null` で表し、`undefined` は保存表現に使いません。複数値は、値がない場合も `null` ではなく空配列で表します。

この規約により IndexedDB、Export / Import、将来の同期処理で欠損値の意味を揃えます。

## 意図的な未確定事項

本 Issue では共通契約だけを確定し、次の事項は後続 Issue で扱います。

- Project、Prompt、Context、Recipe、Run、Link の個別属性・状態値・画面要件
- どの個別モデルを archive 可能にするか
- ID 生成処理、Entity Factory、DB auto increment、意味付き ID
- Dexie schema、IndexedDB `version(1)`、テーブル、索引、DB 初期化
- Repository / Storage、保存・取得・更新・soft delete の実装
- React Router、CRUD 画面、Dashboard、サンプルデータ、Export / Import、同期、認証
