# Lv3-1：設計・合意形成（Prompt実行体験）

- 対象Issue：[#305](https://github.com/yuyuyu0706/ai-workbench/issues/305)
- 親Lv2 Issue：[#304 P3-4：Promptの実行体験を成立させる](https://github.com/yuyuyu0706/ai-workbench/issues/304)
- 親Lv1 Issue：[#270 Phase 3：Guided Execution Foundation](https://github.com/yuyuyu0706/ai-workbench/issues/270)
- 位置づけ：コード変更を含まない設計合意文書。この内容がマージされてから、Lv3-2（単体実行・
  結果記録）・Lv3-3（対話型実行）の実装に着手する。

## 決定事項（チャットでの合意内容）

### 実行の入口はTrail Detail一本化

- **Trail Detail**：既存のRunに対して「実行」ボタンをクリックすると、共通実行ロジック
  （`executeRun`）を呼び、その場で結果が更新される。**これが唯一の実行入口**。
- **Prompt Library**：実行機能は持たない。代わりに「このPromptから作られたTrail」を検索して
  開く導線のみを追加する（検索はクエリのみ。Trail・Run作成やAI呼び出しは一切行わない）。

### Prompt Library検索の応答性

- `promptSnapshot.promptId`をDexieのindexへ追加する（`trailId`追加時と同じ、データ変換を
  伴わないindex追加のみのバージョンアップ）。
- 一致するRunを全件スキャンではなくindex経由で検索する。
- 表示は直近N件＋必要なら「すべて見る」とし、無制限に一覧化しない（Dashboardと同じ考え方）。

### Trail:Promptの関係は当面「間接参照」のまま

- Prompt:Run（`promptSnapshot.promptId`経由）・Trail:Run（`trailId`経由）は既に実装済み。
- Trail:Promptは直接の関係を持たず、Runを介して間接的にしか辿れない。**この間接参照は
  P3-6以降も無くならない**（実行時点の記録として残り続ける）。
- P3-6で直接管理化（TrailがPromptの一覧を直接保持する）を追加すると、「まだ実行していない、
  計画段階のPrompt」もTrailへ表示できるようになる。これは間接参照の置き換えではなく、
  間接参照でできなかったことを可能にする追加の関係である。

### Trail Detailの複数Prompt一覧化は見送るが、優先度を上げて申し送る

- 現段階のTrail Detailは単一Run表示のまま変更しない。
- 「Trail Detailを開くとPromptが順番に一覧で並び、1ボタンでRun化できる」という体験は、
  P3-6（1 Trail : 複数Prompt/Run/Step対応）のスコープとする。#270へ、**早い段階での着手を
  希望する優先申し送り**として記録する（本Issueでは #270 自体の更新は行わず、申し送り内容の
  記録のみを本文書に残す）。

## 成果物（シーケンス図・ER図）

以下3点を本Issueの成果物として添付・参照する。

1. **実行シーケンス図**（[lv3-1-execution-sequence.html](assets/lv3-1-execution-sequence.html)）：
   Trail Detailから「実行」をクリックし、共通実行ロジック→AI Execution Gateway→
   Claude API（外部）→Repositoryへの保存、という一連の流れを示す。`[画面]` `[部品]` `[外部]`
   `[DB]`のタグと、外部アクター（Claude API）の破線・配色による区別を含む。
2. **Prompt Library検索シーケンス図**
   （[lv3-1-prompt-library-related-trail-search-sequence.html](assets/lv3-1-prompt-library-related-trail-search-sequence.html)）：
   Promptから紐づくTrailを検索し、Trail Detailへ遷移するまでの流れを示す。
3. **ER図**（[lv3-1-trail-prompt-run-step-erd.html](assets/lv3-1-trail-prompt-run-step-erd.html)）：
   Project／Trail／Prompt／Run／Stepの関係性を示す。実装済みの関係（Trail:Run、Prompt:Run）と、
   P3-4 Lv3-3で追加予定の関係（Run:Step）、P3-6で検討する関係（Trail:Prompt間接参照→直接管理の
   追加）を区別して示す。

## 実装への申し送り（Lv3-2・Lv3-3向け）

### 共通実行ロジックの配置

- 新規モジュール（例：`apps/prompt-trail/src/run-execution/`）へ、Trail Detailから呼び出せる
  共通関数（例：`executeRun(repository, run): Promise<Run>`）を切り出す。
  - 内部で`callGatewayExecute`を呼び、成功時は`Run.output`を更新したRunをRepository経由で
    保存する。
  - 失敗時のエラーハンドリングを一箇所に集約する。

### Trail Detail側の実装

- `RunStepSection`（既存、P3-2 Lv4-2で作成済み）へ「実行」ボタンを追加する。
- クリック時、そのRunを共通実行ロジックへ渡す。実行中・成功・失敗の状態表示を追加する。

### Prompt Library側の実装

- `promptSnapshot.promptId`のDexie index追加（migration、データ変換なし）。
- 「このPromptから作られたTrail」を検索するRepositoryクエリを新設する（直近N件、index経由）。
- Prompt Library（Popover等）へ、検索結果へのリンクを表示するUIを追加する。
- **実行機能・Trail作成機能は追加しない**（既存の「Trail作成」導線とは別物として扱う）。

### Max Tokens既定値の見直し

- `apps/prompt-trail/api/src/functions/execute.ts`・`claude-provider.ts`の
  `DEFAULT_MAX_TOKENS`（現状1024）を、実装計画のような長文を扱えるよう見直す（8192目安）。

### 対話型実行（Lv3-3）のDomain拡張

- `Run`型が単一の`output: string | null`ではなく、複数メッセージ（往復履歴＝Step）を
  保持できる形へ拡張する。既存の`finalPrompt`・`evaluation`・`improvementNote`とは独立した
  fieldとして追加する（既存fieldの意味は変更しない）。
- Dexie Schema migrationを伴う（Lv3-3着手時に具体的なバージョン・移行内容を設計する）。
- [ADR 0009](../../adr/0009-gateway-external-dependencies-and-domain-representation.md)への
  追記、または新ADRとして、「1 Run＝1対話全体、Stepは対話内の往復」という拡張方針を記録する
  （実際の追記はLv3-3で実施。本Issueでは方針のみを記録する）。

## 対象範囲

- 本設計合意文書、シーケンス図2点、ER図1点。
- ADR 0009への追記方針（実際の追記はLv3-3で実施）。

## 非対象

- 実装コード全般（Lv3-2・Lv3-3で実施）。
- Trail:Promptの直接管理化、Trail Detailの複数Prompt一覧化（P3-6。優先申し送り）。
- 文脈取得能力（親Issue等の自動参照。#270に未割当の論点として記録済み）。

## 受入条件

- [x] 本設計合意文書・シーケンス図2点・ER図がマージされている。
- [ ] #270へ、Trail Detailの複数Prompt一覧化（P3-6）の優先申し送りが記録されている
      （本文書に記録済み。#270自体への反映は別途実施）。
- [x] Lv3-2・Lv3-3が、本文書の申し送り内容に沿って着手可能な状態になっている。
