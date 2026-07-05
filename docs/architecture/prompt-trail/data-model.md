# Prompt Trail Data Model

Prompt Trail は、AI への依頼から成果までの Trail を Project、Prompt、Context、Recipe、Run、Link の 6 モデルで構造化します。この文書は、全モデルで共有するエンティティ規約と、Project、Prompt、Context、Recipe、Run、Link の最小ドメイン契約を記録します。

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

## Recipe モデル

Recipe は Project 配下で再利用する、Prompt 1 件と Context 0 件以上の組合せです。`BaseEntity<'recipe'>` を合成し、Prompt／Context の本文・状態・scope は複製せず、常に可変参照として保持します。

| Field         | Type                   | Meaning                                                              |
| ------------- | ---------------------- | -------------------------------------------------------------------- |
| `projectId`   | `ProjectId`            | Recipe を所有する Project です。                                     |
| `title`       | `string`               | Recipe のタイトルです。                                              |
| `description` | `string \| null`       | Recipe の説明です。未設定時は `null` です。                          |
| `promptId`    | `PromptId`             | Recipe が参照する Prompt です。必ず 1 件だけ保持します。             |
| `contextIds`  | `readonly ContextId[]` | Recipe が参照する Context の順序付き配列です。未選択時は空配列です。 |

`contextIds` の配列順は、後続の最終 Prompt 組み立て時に Context を適用する順序です。Recipe は再利用可能な作業パターンを表すため、参照先 Prompt／Context が更新されると、次回以降の実行では更新後の資産を参照します。

## Run モデル

Run は Recipe から作成される実行記録であり、`BaseEntity<'run'>` と `ArchivableEntity` を合成します。Recipe が可変参照を保持するのに対し、Run は実行時点の Prompt／Context、入力値、最終 Prompt を固定保存する証跡です。

| Field              | Type                                             | Meaning                                                                            |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `projectId`        | `ProjectId`                                      | Run が所属する Project です。                                                      |
| `recipeId`         | `RecipeId`                                       | Run の作成元 Recipe です。                                                         |
| `promptSnapshot`   | `PromptSnapshot`                                 | 実行時点の Prompt ID、タイトル、Markdown 本文を固定保存します。                    |
| `contextSnapshots` | `readonly ContextSnapshot[]`                     | 実行時点の Context ID、タイトル、Markdown 本文を Recipe の適用順で固定保存します。 |
| `inputValues`      | `{ readonly [variableName: string]: JsonValue }` | Recipe 変数名をキーにした JSON 互換値の辞書です。未入力時は空オブジェクトです。    |
| `finalPrompt`      | `string`                                         | 実行時に組み立てられた最終依頼本文です。                                           |
| `status`           | `RunStatus`                                      | Run の進行状態です。                                                               |
| `evaluation`       | `RunEvaluation \| null`                          | Run の評価です。未評価時は `null` です。                                           |
| `improvementNote`  | `string \| null`                                 | 改善メモです。未設定時は `null` です。                                             |
| `archivedAt`       | `UtcDateTimeString \| null`                      | Run を履歴化する日時です。未アーカイブ時は `null` です。                           |

`PromptSnapshot` は `promptId`、`title`、`body` を持ち、`ContextSnapshot` は `contextId`、`title`、`body` を持ちます。これにより、元の Prompt／Context が更新、無効化、論理削除されても、過去 Run の依頼内容を再現できます。`contextSnapshots` の配列順は Recipe で選択された Context 適用順を保持します。

`RunStatus` は初期候補として `draft`、`prepared`、`executed`、`in-progress`、`done` だけを許容します。アーカイブ状態は `status` に `archived` を追加せず、`archivedAt` だけで表します。`RunEvaluation` は `good`、`needs-improvement`、`failed` だけを許容し、未評価は `null` で表します。

## Link モデル

Link は Run に直接所属する Trail 関係データです。単なる URL 配列ではなく、Chat、Issue、Pull Request、Commit、Release などを type／role 付きで辿れるようにします。`BaseEntity<'link'>` を合成し、登録日時は `createdAt` を利用します。

| Field        | Type             | Meaning                                                         |
| ------------ | ---------------- | --------------------------------------------------------------- |
| `runId`      | `RunId`          | Link が所属する Run です。                                      |
| `url`        | `string`         | 外部または内部成果への URL です。                               |
| `title`      | `string \| null` | Link のタイトルです。未設定時は `null` です。                   |
| `type`       | `LinkType`       | Link 対象の種別です。                                           |
| `role`       | `LinkRole`       | Trail 上での役割です。                                          |
| `summary`    | `string \| null` | Link 内容の要約です。未設定時は `null` です。                   |
| `externalId` | `string \| null` | GitHub 番号や外部システム ID などです。未設定時は `null` です。 |

`LinkType` は `chat`、`issue`、`pull-request`、`commit`、`release`、`document`、`external` だけを許容します。`LinkRole` は `source`、`reference`、`execution`、`output`、`result` だけを許容します。URL 自動判別、GitHub API 連携、外部ステータス同期、最終確認日時はここでは扱いません。

## 保存表現の null / array 規約

永続化済みエンティティでは、単一の任意値は `null` で表し、`undefined` は保存表現に使いません。複数値は、値がない場合も `null` ではなく空配列で表します。

Project の `description` と `repositoryUrl`、Recipe の `description`、Run の `evaluation` と `improvementNote`、Link の `title`、`summary`、`externalId` は単一任意値として `null` を許容します。Project、Prompt、Context の `tags`、Recipe の `contextIds`、Run の `contextSnapshots` は、値がない場合も空配列です。Run の `inputValues` は未入力時に空オブジェクトです。Prompt／Context の `scope: "global"` では `projectId` を持たず、`scope: "project"` では `projectId` を必須にすることで、保存表現で `undefined` に意味を持たせない共通規約と整合させます。

この規約により IndexedDB、Export / Import、将来の同期処理で欠損値の意味を揃えます。

## 永続化マッピング v1

P0-3-2 の Dexie schema version 1 では、Project、Prompt、Context、Recipe、Run、Link の 6 モデルを 1 モデル 1 Store で保存します。主キーは各モデルの `id` をそのまま利用し、DB auto increment や保存専用 ID は導入しません。

| Model   | Store      | Primary key | v1 の最小インデックス                                                     | 保存境界                                                                   |
| ------- | ---------- | ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Project | `projects` | `id`        | `updatedAt`, `archivedAt`, `deletedAt`                                    | Project レコード単体として保存します。                                     |
| Prompt  | `prompts`  | `id`        | `scope`, `projectId`, `status`, `updatedAt`, `deletedAt`                  | Markdown 本文、タグ、状態、scope を Prompt レコードへ保存します。          |
| Context | `contexts` | `id`        | `scope`, `projectId`, `status`, `updatedAt`, `deletedAt`                  | Markdown 本文、タグ、状態、scope を Context レコードへ保存します。         |
| Recipe  | `recipes`  | `id`        | `projectId`, `promptId`, `updatedAt`, `deletedAt`                         | Prompt 1 件と Context 0 件以上への可変参照を Recipe レコードへ保存します。 |
| Run     | `runs`     | `id`        | `projectId`, `recipeId`, `status`, `updatedAt`, `archivedAt`, `deletedAt` | 実行時点の Snapshot、入力値、最終 Prompt を Run レコードへ埋め込みます。   |
| Link    | `links`    | `id`        | `runId`, `createdAt`, `deletedAt`                                         | Run に所属する Trail 関係データを独立 Store として保存します。             |

`tags`、Markdown 本文、URL、`externalId`、`kind`、`summary`、Snapshot 内部項目は v1 では索引化しません。タグ検索、本文検索、URL 検索、高度な絞り込み、複合索引は、実利用の必要性を確認した後の schema version で判断します。

`Recipe.contextIds` は順序を持つ配列のまま `recipes` レコードへ保存し、Context 参照の中間 Store は作りません。この配列順は Context の適用順であり、保存・取得・Run 作成時に並び替えません。

`Run.promptSnapshot`、`Run.contextSnapshots`、`Run.inputValues`、`Run.finalPrompt` は `runs` レコードへ埋め込み、Snapshot 専用 Store や入力値専用 Store へ分解しません。Snapshot は作成後に元 Prompt／Context が更新、deprecated／disabled、論理削除されても書き換えず、過去 Run の再現性を優先します。

Link は Run ごとの増減と `createdAt` による時系列取得を行うため、Run レコード内の配列ではなく `links` Store へ独立保存します。Link には `projectId` を重複保存せず、所属 Project は `Link -> Run -> Project` の参照で辿ります。

## 参照整合・更新時の検証契約

IndexedDB／Dexie schema は外部キー制約を提供しないため、次の検証は P0-3-3 の Repository／Storage アクセス層で実装する契約とします。Dexie schema version 1 では Store 名、主キー、索引だけを定義し、参照整合の実行時検証は行いません。

| 対象操作                                  | 検証契約                                                                                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project 専用 Prompt／Context の作成・更新 | `scope: "project"` の資産は、存在し `deletedAt = null` の Project を `projectId` に持ちます。`scope: "global"` の資産は `projectId` を持ちません。                                                                            |
| Recipe の作成・更新                       | Recipe は存在し `deletedAt = null` の Project に所属します。参照 Prompt は存在し、`deletedAt = null` かつ `status !== "deprecated"` です。参照 Context はすべて存在し、`deletedAt = null` かつ `status !== "disabled"` です。 |
| Recipe の scope 判定                      | Project 専用 Prompt／Context を参照する場合、その資産の `projectId` は Recipe の `projectId` と一致します。global Prompt／Context は任意の Project の Recipe から参照できます。                                               |
| Recipe の Context 順序                    | `contextIds` は重複を持たず、配列順を Context 適用順として保存します。空配列は Context 未選択を表す有効な状態です。                                                                                                           |
| Run の作成                                | 作成元 Recipe は存在し `deletedAt = null` です。Recipe の `projectId` と Run の `projectId` は一致します。                                                                                                                    |
| Run Snapshot の作成                       | `promptSnapshot.promptId` は作成時点の `Recipe.promptId` と一致します。`contextSnapshots` の元 `contextId`、配列順、配列長は作成時点の `Recipe.contextIds` と一致します。                                                     |
| Link の作成・更新                         | Link は存在し `deletedAt = null` の Run に `runId` で所属します。Project 所属は `Link -> Run -> Project` で解決し、Link には `projectId` を追加しません。                                                                     |

これらの契約により、global／project scope の混在、Project 専用資産の他 Project 混入、Recipe の Context 重複、Run と Recipe の Project 不一致、Snapshot 順序の不一致、削除済み Run への Link 追加を Repository 境界で検出できるようにします。

## 削除・アーカイブ時の保持契約

Prompt Trail では Trail の欠損を避けるため、Project、Prompt、Context、Recipe、Run、Link の物理削除と自動カスケード削除を行いません。soft delete、archive、deprecated、disabled は関連レコードを自動変更せず、各レコード自身の状態として保存します。

| 状態変更                          | 保持契約                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project の soft delete／archive   | 配下の Prompt、Context、Recipe、Run、Link を自動削除・自動 archive しません。通常取得から Project を除外し、履歴・復元用の明示的な取得経路で扱います。            |
| Prompt の soft delete／deprecated | 既存 Recipe は参照を保持します。新規 Recipe 候補や Recipe 更新時の参照先からは除外し、既存 Run は `promptSnapshot` により実行時点の内容を再現します。             |
| Context の soft delete／disabled  | 既存 Recipe は `contextIds` を保持します。新規 Recipe 候補や Recipe 更新時の参照先からは除外し、既存 Run は `contextSnapshots` により実行時点の内容を再現します。 |
| Recipe の soft delete             | 既存 Run は `recipeId` と Snapshot を保持します。Recipe 削除を理由に Run や Link を自動削除しません。                                                             |
| Run の soft delete／archive       | Link を物理削除せず、Run 復元時に Trail を回復できるようにします。通常の Run 一覧からは除外または archive 除外します。                                            |
| Link の soft delete               | Link 自身を通常取得から除外します。所属 Run や Project の状態は変更しません。                                                                                     |

参照資産が削除、deprecated、disabled になった Recipe は残し、後続 UI や Repository の取得結果で実行不可状態を導出できるようにします。既存 Run は固定 Snapshot を正本とし、元資産の現在状態に追従して書き換えません。

## 通常取得条件・既定の並び順

通常取得は、利用者が日常的に選択・実行・追跡する対象だけを返す取得経路です。archive 済み、削除済み、deprecated、disabled の閲覧／復元は、通常取得とは別の明示的な取得経路として扱います。

| 対象         | 通常取得条件                                                                                           | 既定の並び順     |
| ------------ | ------------------------------------------------------------------------------------------------------ | ---------------- |
| Project 選択 | `deletedAt = null` かつ `archivedAt = null`                                                            | `updatedAt` 降順 |
| Prompt 候補  | `deletedAt = null`、`status = "active"`、`scope = "global"` または指定 Project の `scope = "project"`  | `updatedAt` 降順 |
| Context 候補 | `deletedAt = null`、`status = "enabled"`、`scope = "global"` または指定 Project の `scope = "project"` | `updatedAt` 降順 |
| Recipe 一覧  | `deletedAt = null`、指定 Project の `projectId`                                                        | `updatedAt` 降順 |
| Run 一覧     | `deletedAt = null`、指定 Project の `projectId`、通常は `archivedAt = null`                            | `updatedAt` 降順 |
| Link 一覧    | `deletedAt = null`、指定 Run の `runId`                                                                | `createdAt` 昇順 |

Project archive 後に配下資産、Recipe、Run をどの画面で閲覧するかは後続 UI 設計で決めます。本契約ではデータを保持し、通常取得から除外することだけを定義します。

## 意図的な未確定事項

本 Issue では Project、Prompt、Context、Recipe、Run、Link のドメイン契約を確定し、次の事項は後続 Issue で扱います。

- Recipe 専用の Context 適用範囲、Prompt 変数の解析・入力形式・必須チェック・初期値
- Prompt 版管理、複製履歴、Prompt 派生元、Context の文字数・推定トークン数、URL 形式検証、タグの重複除去・大小文字正規化
- ID 生成処理、Entity Factory、DB auto increment、意味付き ID
- Dexie schema、IndexedDB `version(1)`、テーブル、索引、DB 初期化
- Repository / Storage、保存・取得・更新・soft delete の実装
- React Router、CRUD 画面、Dashboard、サンプルデータ、Export / Import、同期、認証
