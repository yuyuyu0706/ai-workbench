# ADR 0011: Trail as Prompt Flow

## Status

Accepted

## Context

[ADR 0005](0005-trail-run-responsibility.md)は、TrailをRunから独立したエンティティとして
切り出したが、「1 Trailに対する複数Runの作成・表示UI、Trail単位の実行ステータス集約は
実装しません（将来課題）」として、Trail内でPromptの並びを直接管理することを将来課題に
残していた。

現行のER図（`docs/product/prompt-trail/assets/lv3-1-trail-prompt-run-step-erd.html`）は、
`TRAIL }o..o{ PROMPT : "間接参照・Run経由（P3-6で直接管理を検討）"`として、TrailとPromptが
Runを介してしか辿れない間接参照であることを明示している。P3-4 Lv3-1
（[#305](https://github.com/yuyuyu0706/ai-workbench/issues/305)）の設計合意文書は、この
直接管理化を「早い段階での着手を希望する優先申し送り」として#270へ記録していた。

さらに、製品コンセプト（PromptTrail：Promptを軸にした一連の作業の流れ）とDomainの実態
（RunTrail：実行記録の束ね）の間に乖離がある。Trailが「これから実行する計画段階のPrompt」
を表現できず、実行済みのRunの集合としてしか存在できないことが、この乖離の具体的な現れで
ある。本ADRは、[#331](https://github.com/yuyuyu0706/ai-workbench/issues/331)（P3-6：Trail
をPromptのフロー設計として成立させる）のLv3-1（設計・合意形成）で確定した、この乖離を
解消するためのDomainモデル・migration方針・用語整理を記録する。

## Decision

### Domainモデルはエンティティ型を採る

- 新エンティティ`TrailStep`を独立したストア（`trailSteps`）として追加する。
- 却下理由：配列型（`Trail.promptIds`）は`PromptId`以外を表現できず、人間がマージする
  ような工程を並べられない。埋め込み型（`Trail.steps`にオブジェクト配列）は表現力はある
  が、`Run`から参照する先が「Trail内の配列要素」になるためDexieのindexを張れず、Step単位
  の一覧取得が毎回Trail全件走査になる。
- ADR 0005でTrailをRunから切り出したのと同じ手口であり、`PROMPT_TRAIL_ENTITY_KINDS`に
  種別を1つ足す形に収まる。

### `TrailStep`の形

`TrailStep`は次のfieldを持つ。

| field      | 型                 | 内容                                     |
| ---------- | ------------------ | ---------------------------------------- |
| `id`       | `TrailStepId`      | `BaseEntity<'trail-step'>`               |
| `trailId`  | `TrailId`          | 所属するTrail                            |
| `order`    | `number`           | Trail内での順序                          |
| `kind`     | `TrailStepKind`    | 工程の種別                               |
| `title`    | `string`           | 工程の名前。Prompt名とは独立に付けられる |
| `promptId` | `PromptId \| null` | 参照するPrompt。`kind`によりnullを許す   |
| `note`     | `string \| null`   | 補足                                     |

`BaseEntity`の`createdAt` / `updatedAt` / `deletedAt`は既存どおり持つ。`ArchivableEntity`は
付けない。Trail側でarchiveされるため、Step単独のarchiveは不要である。

### 順序は`order: number`の連番で持ち、並び替え時に再採番する

- `order`は1から始まる連番とし、Trail内で一意とする。
- 並び替えは、対象Trail配下のStepを単一トランザクションで再採番する方式を採る。
- 理由：Trailあたりの Step数は少数（例：アプリ開発Trailで7件程度）であり、再採番のコスト
  は無視できる。疎な間隔（10, 20, 30…）や分数順序は、再採番を避けられる代わりに「見た目の
  順序と値が一致しない」状態を生み、デバッグとテストが難しくなる。
- `(trailId, order)`の一意性はrepository側で検証する。`ensureUniqueContextIds`と同じ
  位置づけである。

### `kind`は最小の2値から始める

- Lv3-2時点では`prompt`（Promptを実行する工程）と`manual`（人手の工程）の2値とする。
- `promptId`は`kind === 'prompt'`のとき必須、`manual`のとき`null`とする。この整合は
  repositoryで検証する。
- エージェント実行の種別は、P3-5側（Lv3-3〜Lv3-6）の結論が出てから追加する。`kind`は
  文字列ユニオンで保持するため、値の追加にmigrationは不要である。
- 却下理由：`promptId`必須にすると人間がマージするような工程を並べられない。Recipe経由で
  解決する案は、Recipeが「Prompt 1本＋Contextの並び」という別の抽象であり、Stepとは粒度が
  合わない。

### `Run.trailStepId`を必須とし、既存Runはbackfillする

- `Run`に`trailStepId: TrailStepId`を追加し、必須とする。
- 既存Runはmigrationで1 Run : 1 Stepを作って紐付ける。
- 却下理由：null許容にすると「設計に属さないRun」という例外状態が永久に残り、UIとクエリの
  両方で分岐を持ち続けることになる。Step側が`runIds`を持つ案は、同じStepを複数回実行した
  場合の表現が苦しく、`Link`が`runId`にぶら下がる既存の向きとも逆になる。

### migrationはv9→v10の単一トランザクションで行う

方針は次のとおり。実装はLv3-2で行う。

1. `metadata.ts`の`PROMPT_TRAIL_SCHEMA_VERSION`を10へ、`PromptTrailStoreName`に
   `trailSteps`を追加する。
2. `schemaV10`を`schemaV9`のスプレッドで定義し、
   `trailSteps: 'id, trailId, promptId, updatedAt, deletedAt'`を追加、`runs`に
   `trailStepId`のindexを追加する。
3. `version(10).stores(schemaV10).upgrade(migrateToV10)`を追加する。
4. `migrateToV10`の処理：既存Runを`trailId`でグループ化し、各グループ内で`createdAt`の
   昇順に`order`を1から採番する（ADR 0005のbackfill以降に1 Trail : 複数Runが生じている
   可能性があるため、`order`を一律1にしない）。Run 1件につき`TrailStep` 1件を`trail-step-${run.id}`
   で作成する。`trailId`は`run.trailId`、`kind`は`prompt`、`title`は
   `run.promptSnapshot.title`、`promptId`は`run.promptSnapshot.promptId`から埋める。
   `run.trailStepId = 'trail-step-' + run.id`を設定する。
5. すべてを単一の`upgrade()`トランザクション内で行い、失敗時は全体がロールバックされる
   ようにする。`v4-to-v5.ts`と同じ方針・同じコメント粒度で残す。

却下理由：2段階（v10でストア追加、v11でbackfill）は中間状態のDBが世に出る。backfillしない
案は「`Run.trailStepId`を必須とする」決定と矛盾する。

### 用語は「Message」「Step」に整理する

調査の結果、衝突しているように見えたのは3概念ではなく1組の型・インスタンス関係と、
表記の1件のずれであることが分かった。

- 「Trailを構成する工程」と「アプリ開発TrailのSTEP4〜10」は、型とインスタンスの関係に
  ある。アプリ開発TrailのSTEP4は、DomainのStepの1つとして表現される。別概念ではないため、
  別語にする必要がない。STEP4〜10の番号表記は改名しない。
- 実質的に衝突しているのは、ERDが対話の往復を`STEP`と呼んでいる点のみである。コードは
  既に`ConversationMessage` / `messages`と呼んでおり、ERDの表記がコードから外れているだけ
  である。ERDの`STEP`エンティティは`MESSAGE`へ改名する。
- 会話・文書上は工程を「Step」と呼び、型名のみ`TrailStep`とする。

### Trail DetailのUI範囲は「一覧表示＋編集」まで

- 本Lv2（P3-6）の範囲は、Stepの一覧表示（Lv3-3）と、追加・並び替え・削除（Lv3-4）まで
  とする。
- 「1ボタンでRun化できる」体験はP3-7（Thin Vertical Slice）とする。

## Consequences

- Runを作るすべての経路（`createDirectRunFromPrompt`を含む）がStepも用意する必要が出る。
  ADR 0005でDirect RunがTrailを作るようにしたのと同じ構図であり、経路の洗い出しがLv3-2の
  作業に含まれる。
- v9→v10のmigrationは、アップグレード自体は失敗時にロールバックされるが、成功後にv9へ
  戻す手段は無い。`v4-to-v5.ts`と同じ方針・コメント粒度でLv3-2にて慎重に実装する必要が
  ある。
- `kind`の値は後から追加でき、その際にmigrationは不要である。エージェント実行の種別は
  P3-5側の結論を待って追加する。
- 用語をMessage / Stepに整理したことで、ERDの表記（`MESSAGE`）がコードの命名
  （`ConversationMessage`）と一致する。
