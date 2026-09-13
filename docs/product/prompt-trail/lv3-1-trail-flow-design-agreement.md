# Lv3-1：設計・合意形成（Trail as Prompt Flow）

- 対象Issue：[#332](https://github.com/yuyuyu0706/ai-workbench/issues/332)
- 親Lv2 Issue：[#331 P3-6：Trail を Prompt のフロー設計として成立させる](https://github.com/yuyuyu0706/ai-workbench/issues/331)
- 親Lv1 Issue：[#270 Phase 3：Guided Execution Foundation](https://github.com/yuyuyu0706/ai-workbench/issues/270)
- 位置づけ：コード変更を含まない設計合意文書。この内容がマージされてから、Lv3-2（Domain・
  Schema・Repository）以降の実装に着手する。P3-4 Lv3-1（[#305](https://github.com/yuyuyu0706/ai-workbench/issues/305)／
  PR [#306](https://github.com/yuyuyu0706/ai-workbench/pull/306)）、P3-5 Lv3-1
  （[#324](https://github.com/yuyuyu0706/ai-workbench/issues/324)／
  PR [#325](https://github.com/yuyuyu0706/ai-workbench/pull/325)）と同じ形式を踏襲する。

## 決定事項（チャットでの合意内容）

### Domainモデルはエンティティ型を採る

- 新エンティティ`TrailStep`を独立したストア（`trailSteps`）として追加する。
- 却下理由：配列型（`Trail.promptIds`）は`PromptId`以外を表現できず、人間がマージするような
  Promptを持たない工程を並べられない。埋め込み型（`Trail.steps`にオブジェクト配列）は表現力
  はあるが、`Run`から参照する先が「Trail内の配列要素」になるためDexieのindexを張れず、Step
  単位の一覧取得が毎回Trail全件走査になる。
- ADR 0005でTrailをRunから切り出したのと同じ手口であり、`PROMPT_TRAIL_ENTITY_KINDS`に種別を
  1つ足す形に収まる。

### `TrailStep`の形

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
- 理由：Trailあたりの Step数は「アプリ開発Trail」でも7件程度で、再採番のコストは無視できる。
  疎な間隔（10, 20, 30…）や分数順序は、再採番を避けられる代わりに「見た目の順序と値が
  一致しない」状態を生み、デバッグとテストが難しくなる。
- `(trailId, order)`の一意性はrepository側で検証する。`ensureUniqueContextIds`と同じ位置
  づけである。

### `kind`は最小の2値から始める

- Lv3-2時点では`prompt`（Promptを実行する工程）と`manual`（人手の工程）の2値とする。
- `promptId`は`kind === 'prompt'`のとき必須、`manual`のとき`null`とする。この整合はrepository
  で検証する。
- エージェント実行の種別は、P3-5側（Lv3-3〜Lv3-6）の結論が出てから追加する。`kind`は文字列
  ユニオンで保持するため、値の追加にmigrationは不要である。
- 却下理由：`promptId`必須にすると人手の工程を並べられない。Recipe経由で解決する案は、
  Recipeが「Prompt 1本＋Contextの並び」という別の抽象であり、Stepとは粒度が合わない。

### `Run.trailStepId`を必須とし、既存Runはbackfillする

- `Run`に`trailStepId: TrailStepId`を追加し、必須とする。
- 既存Runはmigrationで1 Run : 1 Stepを作って紐付ける。
- 却下理由：null許容にすると「設計に属さないRun」という例外状態が永久に残り、UIとクエリの
  両方で分岐を持ち続けることになる。Step側が`runIds`を持つ案は、同じStepを複数回実行した
  場合の表現が苦しく、`Link`が`runId`にぶら下がる既存の向きとも逆になる。
- **副作用（Lv3-2への申し送り）**：Runを作るすべての経路がStepも用意する必要が出る。ADR 0005
  でDirect RunがTrailを作るようにしたのと同じ構図であり、`createDirectRunFromPrompt`を含む
  既存の生成経路の洗い出しがLv3-2の作業に含まれる。

### migrationはv9→v10の単一トランザクションで行う

方針は次のとおり。実装はLv3-2で行う。

1. `metadata.ts`の`PROMPT_TRAIL_SCHEMA_VERSION`を10へ、`PromptTrailStoreName`に`trailSteps`を
   追加する。
2. `schemaV10`を`schemaV9`のスプレッドで定義し、
   `trailSteps: 'id, trailId, promptId, updatedAt, deletedAt'`を追加、`runs`に
   `trailStepId`のindexを追加する。
3. `version(10).stores(schemaV10).upgrade(migrateToV10)`を追加する。
4. `migrateToV10`の処理：既存Runを`trailId`でグループ化し、各グループ内で`createdAt`の昇順に
   `order`を1から採番する（ADR 0005のbackfill以降に1 Trail : 複数Runが生じている可能性がある
   ため、`order`を一律1にしない）。Run 1件につき`TrailStep` 1件を`step-${run.id}`で作成する。
   `trailId`は`run.trailId`、`kind`は`prompt`、`title`は`run.promptSnapshot.title`、`promptId`
   は`run.promptSnapshot.promptId`から埋める。`run.trailStepId = 'step-' + run.id`を設定する。
5. すべてを単一の`upgrade()`トランザクション内で行い、失敗時は全体がロールバックされるように
   する。`v4-to-v5.ts`と同じ方針・同じコメント粒度で残す。

却下理由：2段階（v10でストア追加、v11でbackfill）は中間状態のDBが世に出る。backfillしない案
は「`Run.trailStepId`を必須とする」決定と矛盾する。

### ADRは新規に0011を起こし、0005を部分supersedeする

- 新ADR`docs/adr/0011-trail-as-prompt-flow.md`を起票する。
- ADR 0005のStatusを「Accepted（P3-1時点）／Partially superseded by ADR 0011」へ変更し、0011
  への参照を追記する。本文は書き換えない。
- 理由：「Trailはtitleとkindのみ」はP3-1時点の判断としては正しく、履歴として残す価値がある。
  ADR 0008→0010で採った部分supersedeの前例に揃える。

### 用語は「Message」「Step」に整理する（#331の認識を修正）

調査の結果、衝突しているのは3概念ではなく1つであることが分かった。

- 「Trailを構成する工程」と「アプリ開発TrailのSTEP4〜10」は、型とインスタンスの関係である。
  アプリ開発TrailのSTEP4は、DomainのStepの1つとして表現される。別概念ではないため、別語に
  する必要がない。
- 実質的に衝突しているのは、ERDが対話の往復を`STEP`と呼んでいる点のみである。コードは既に
  `ConversationMessage` / `messages`と呼んでおり、ERDの表記がコードから外れているだけである。

決定は次のとおり。

| 概念                             | 呼称                  | 型名                                        | 対応                                         |
| -------------------------------- | --------------------- | ------------------------------------------- | -------------------------------------------- |
| 対話の往復（`role` / `content`） | Message               | `ConversationMessage`（既存）               | ERDの`STEP`エンティティを`MESSAGE`へ改名する |
| Trailを構成する工程              | Step                  | `TrailStep`（エンティティ種別`trail-step`） | 新規                                         |
| アプリ開発TrailのSTEP4〜10       | STEP4〜10（現状維持） | —                                           | 改名しない。Stepのインスタンスとして扱う     |

- 却下理由：アプリ開発Trail側をStage等へ改名する案は、「アプリ開発TrailのStageは、Domainの
  Stepとして表現される」という無駄な対応表を生む。加えて#270・#323・#326・ADR 0010・設計
  合意文書・各検討書に散らばる「STEP4〜10」をすべて書き換えることになり、番号の繰り下げ
  作業と同時に行うと事故る。
- 会話・文書上は「Step」と呼び、型名のみ`TrailStep`とする。

### Trail DetailのUI範囲は「一覧表示＋編集」まで

- 本Lv2（P3-6）の範囲は、Stepの一覧表示（Lv3-3）と、追加・並び替え・削除（Lv3-4）まで。
- 「1ボタンでRun化できる」体験はP3-7（Thin Vertical Slice）とする。
- 理由：#331のゴールに「追加・並び替え・削除ができる」が含まれており、一覧表示のみだと
  フローを作る手段が無く「アプリ開発TrailのSTEP4〜10をアプリ内に表現できる」を満たせない。

### 繰り下げは、過去の記録と現行の決定で書き分ける

| 対象                                                                    | 性質             | 対応                                                                                                            |
| ----------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `docs/adr/0010-agent-execution-shape.md`                                | 現在有効な決定   | `P3-6`を`P3-7`へ単純に直す（1箇所）                                                                             |
| `docs/product/prompt-trail/lv3-1-agent-execution-design-agreement.md`   | 過去の合意の記録 | 「P3-6（現P3-7）」の形で併記する                                                                                |
| `docs/product/prompt-trail/lv3-1-prompt-execution-design-agreement.md`  | 過去の合意の記録 | 同上                                                                                                            |
| `docs/product/prompt-trail/assets/lv3-1-trail-prompt-run-step-erd.html` | 現況を示す図     | `P3-6`は「P3-6（現P3-7）」へ。`STEP`エンティティは`MESSAGE`へ改名。`TRAIL }o..o{ PROMPT`の関係更新はLv3-5で行う |
| GitHub Issue #270                                                       | 現行のツリー     | Lv2ツリーに本Lv2を追加し、旧P3-6をP3-7へ繰り下げる（本Issueでは記録のみ。反映は別途）                           |
| GitHub Issue #323・#326                                                 | 現行の管理Issue  | 「UI導線はP3-6」等をP3-7へ直す（本Issueでは記録のみ。反映は別途）                                               |

- 理由：`lv3-1-*.md`は当時の合意の記録なので、記述を消さずに現在地も分かる形にする。ADR 0010
  は過去の記録ではなく現在有効な決定なので、直接直す。

### Lv3-1は分割しない

- 1 Lv3・1 PRで完結させる。P3-4 Lv3-1（#305／PR #306）、P3-5 Lv3-1（#324／PR #325）と同じ形。
- ただしIssue #270・#323・#326の更新はPR外の作業として残る。

## 成果物

以下2点を本Issueの成果物として添付・参照する。

1. **Domainモデル図（ER図）**
   （[lv3-1-trail-flow-erd.html](assets/lv3-1-trail-flow-erd.html)）：
   `PROJECT ||--o{ TRAIL`・`TRAIL ||--o{ TRAIL_STEP`（`order`を持つ、新規）・
   `TRAIL_STEP ||--o{ RUN`（`TRAIL}o..o{PROMPT`の間接参照に代わる直接管理、新規）・
   `TRAIL_STEP }o--o| PROMPT`（0または1の任意参照、新規）・`RUN ||--o{ LINK`（既存）を示す。
   新規・変更箇所と既存で変わらない箇所を、配色または注記で区別する。
2. **migration手順図**
   （[lv3-1-trail-step-migration-sequence.html](assets/lv3-1-trail-step-migration-sequence.html)）：
   v9の状態（Runが`trailId`を持つ）からv10の状態（TrailStepが生まれ、Runが`trailStepId`を
   持つ）への変換を、上記4手順の順で示す。同一`trailId`に複数Runがある場合の`order`採番
   （`createdAt`昇順）を明示し、単一トランザクションで実行され失敗時は全体がロールバック
   されることを注記する。

## 実装への申し送り（Lv3-2以降向け）

| 宛先              | 申し送り内容                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lv3-2             | Runを作るすべての経路（`createDirectRunFromPrompt`を含む）を洗い出し、Stepも併せて用意するよう改める。ADR 0005でDirect RunがTrailを作るようにしたのと同じ構図                               |
| Lv3-2             | `metadata.ts`の`PROMPT_TRAIL_SCHEMA_VERSION`と`PromptTrailStoreName`、`common.ts`の`PROMPT_TRAIL_ENTITY_KINDS`の3箇所を同時に更新する必要がある                                             |
| Lv3-2             | migrationは`v4-to-v5.ts`と同じ粒度でコメントを残す。スキーマのみの変更ではないため、テストは`database-migration.test.ts`に追加する                                                          |
| Lv3-2             | `src/developer-data/scenarios/`のシナリオデータがStepを含むよう更新が必要。Lv4-3の検証導線でも既存Runを使うため、Step付きのRunが用意できていないと後続が詰まる                              |
| Lv3-3・Lv3-4      | 並び替えはTrail配下のStepを単一トランザクションで再採番する。楽観ロックは`updateTrailMetadata`の`expectedUpdatedAt`パターンに合わせる                                                       |
| Lv3-5             | ERDの`TRAIL }o..o{ PROMPT`（間接参照・Run経由、P3-6（現P3-7）で直接管理を検討）を、`TRAIL_STEP`経由の実装済みの関係（`TRAIL \|\|--o{ TRAIL_STEP`／`TRAIL_STEP }o--o\| PROMPT`）へ書き換える |
| Lv3-5             | `functional-requirements.md`に反映が必要かを判断する                                                                                                                                        |
| P3-5 Lv3-3〜Lv3-6 | 「Stepの種別としてSTEP4を定義し、それを実行できるようにする」という形へissue本文を書き換えてから着手する。`TrailStepKind`へエージェント実行の種別を追加するのはこのタイミング               |
| P3-5 Lv4-3        | 本Lv2完了後に再開する。保存先は`Run`と`Link`（`Run.trailStepId`経由でStepに紐付く）となる                                                                                                   |

## #270・#323・#326関連の申し送り事項（記録のみ）

以下は、#332の完了条件が求める#270・#323・#326の更新内容である。**本Issueでは各Issue自体の
更新は行わず、申し送り内容の記録のみを本文書に残す**。

- #270本文のLv2ツリーへ本Lv2（P3-6：Trail を Prompt のフロー設計として成立させる）を追加し、
  旧P3-6として記録されていた「UIからの連結」の内容をP3-7として繰り下げる。
- #323・#326の「UI導線はP3-6」等の記述を、P3-7へ直す。

## 対象範囲

- 本設計合意文書、図2点、ADR 0011の起票、ADR 0005のStatus更新、ADR 0010・設計合意文書2本・
  ERDの繰り下げ反映。
- #270・#323・#326本文への反映方針（記録のみ。実際の反映は別途実施）。

## 非対象

- 実装コード全般（Lv3-2以降）。
- `TrailStep`の型定義ファイルの追加、migrationの実装、repositoryの拡張（いずれもLv3-2）。
- Trail DetailのUI（Lv3-3・Lv3-4）。
- ERDの`TRAIL–PROMPT`関係の更新、`roadmap.md`へのP3-6節追加（Lv3-5）。
- `kind`へのエージェント実行の種別の追加（P3-5側の結論待ち）。

## 受入条件

- [x] 本設計合意文書・図2点がマージされている。
- [x] ADR 0011が起票され、決定内容が記録されている。
- [x] ADR 0005のStatusが更新され、本文は書き換えられていない。
- [x] ADR 0010の`P3-6`が`P3-7`へ直っている。
- [x] 設計合意文書2本とERDで、`P3-6`が「P3-6（現P3-7）」の形で併記されている。
- [ ] #270・#323・#326が更新されている（本文書に記録済み。各Issue自体への反映は別途実施）。
- [x] Lv3-2が、本文書の申し送り内容に沿って着手可能な状態になっている。
