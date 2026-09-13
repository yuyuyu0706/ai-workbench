# Lv3-1：設計・合意形成（エージェント実行基盤）

- 対象Issue：[#324](https://github.com/yuyuyu0706/ai-workbench/issues/324)
- 親Lv2 Issue：[#323 P3-5：エージェント実行基盤を構築する](https://github.com/yuyuyu0706/ai-workbench/issues/323)
- 親Lv1 Issue：[#270 Phase 3：Guided Execution Foundation](https://github.com/yuyuyu0706/ai-workbench/issues/270)
- 位置づけ：コード変更を含まない設計合意文書。この内容がマージされてから、Lv3-2（実行基盤）
  以降の実装に着手する。P3-4 Lv3-1（[#305](https://github.com/yuyuyu0706/ai-workbench/issues/305)／
  PR [#306](https://github.com/yuyuyu0706/ai-workbench/pull/306)）と同じ形式を踏襲する。

## 決定事項（チャットでの合意内容）

### エージェント実行環境：GitHub Actions ＋ Claude Code Action

- 実行環境はGitHub Actionsとし、エージェント本体は公式のClaude Code Actionを用いる。
- 理由：`ci.yml`で既にcheckout・Node・pnpm環境が動作しており、Secret管理とタイムアウト制御も
  GitHub標準機構に乗る。Azure側（Container Apps Jobs等）を選ぶと、SWA Managed Functionの
  実行時間制限を超える長時間処理の受け皿と、リポジトリcheckout環境の両方を新規に用意する
  ことになる。
- `ANTHROPIC_API_KEY`はGitHub ActionsのSecretsへ保管する（SWA Application Settings側の既存キー
  とは別管理。Gateway用とエージェント用で用途が異なるため）。

### トリガー方式：`workflow_dispatch`を唯一の経路とする

- プログラムからの起動・手動起動のいずれも`workflow_dispatch`を用いる。`repository_dispatch`
  は採用しない。Fine-grained PATから`repository_dispatch`を呼ぶには`Contents: write`が必要で
  あり、起動用PAT（`GITHUB_DISPATCH_PAT`）に`Actions: write`のみを持たせる方針と両立しない
  ことがLv4-2で判明したための是正である。
- `workflow_dispatch`のinputsは文字列10個までの制約があるため、STEP間では長文payloadを渡さず、
  後続STEPへは前STEPのrun idのみを渡し、Actions APIでartifactを取得しに行く。
- dispatch APIはrun idを返さないため、run名（`run-name:`に埋め込んだ識別子）で突き合わせる。
- ADR 0008は`workflow_dispatch`のみに言及していた。本文書は当初`repository_dispatch`を主経路と
  する判断へ更新していたが、Lv4-2での是正によりADR 0010と同じく`workflow_dispatch`のみの
  記述へ戻す。

### 権限モデル：STEP別`permissions:`（弱い順）

- 各STEPを別ワークフローとし、それぞれの`permissions:`ブロックで必要最小限を宣言する。

| STEP                                | 対応Lv3  | `permissions:`宣言                         |
| ----------------------------------- | -------- | ------------------------------------------ |
| STEP4 実装方針生成                  | Lv3-3    | `contents: read` のみ                      |
| STEP5 子issue作成                   | Lv3-4    | `contents: read` / `issues: write`         |
| STEP9 子issue更新                   | Lv3-4    | `contents: read` / `issues: write`         |
| STEP10 親issue更新・子issueクローズ | Lv3-4    | `contents: read` / `issues: write`         |
| STEP7 PRレビュー                    | Lv3-5    | `contents: read` / `pull-requests: write`  |
| STEP6 実装・PR作成                  | Lv3-6    | `contents: write` / `pull-requests: write` |
| STEP8 マージ                        | （なし） | エージェント実行しない。人間承認ゲート     |

### 実行結果の受領：Pull型（Actions APIポーリング）、Push型は不採用

- 成果物の正本はGitHub側（Issue、PR、コメント、Actionsのartifact）に置く。PromptTrailは
  `Link`として参照を保持する（ADR 0007「GitHub Source of Truth」と整合）。
- 実行の成否・進行状況は、PromptTrailがGitHub Actions APIをPullして取得する。
- Push型（エージェントがPromptTrailのAPIへ完了通知をPOSTする方式）は採用しない。PromptTrailは
  Local-first（ADR 0002）でサーバ側DBを持たず、ブラウザが閉じている間に届いた通知を保存する
  場所が存在しないためである。
- Pull型の実装範囲（ポーリング間隔、どの画面から取得するか等）はLv3-2で設計する。

### STEP間の入出力契約

| STEP   | 入力             | 出力                                 | 出力の置き場所                                    |
| ------ | ---------------- | ------------------------------------ | ------------------------------------------------- |
| STEP4  | 親Lv1 issue番号  | 実装方針.md                          | Actions artifact ＋ job summary（→ `Run.output`） |
| STEP5  | 前STEPのrun ID   | 子issue                              | GitHub Issue（→ `Link`）                          |
| STEP6  | 子issue番号      | 開発ブランチ・PR                     | GitHub PR（→ `Link`）                             |
| STEP7  | PR番号           | レビューコメント                     | PRコメント（→ `Link`）                            |
| STEP8  | レビュー結果     | マージ済みPR                         | 人間が操作。結果のみ記録                          |
| STEP9  | マージ済みPR番号 | 更新済み子issue                      | GitHub Issue                                      |
| STEP10 | 子issue番号      | 更新済み親issue・クローズ済み子issue | GitHub Issue                                      |

- STEP4の成果物はActions artifactおよびjob summaryへ出力する。親issueへのコメント投稿や
  リポジトリへのコミットを選ぶと、STEP4がread-onlyでなくなり、権限階段の出発点が消えるため。
- STEP5の起動時は、`workflow_dispatch`のinputsへ前STEPのrun idのみを渡す。STEP5（を起動する
  Managed Function）が、そのrun idを使ってActions APIから実装方針.mdの本文を取得する。

### STEP8：人間承認ゲート、STEP9/10への接続は手動

- STEP8（マージ）はエージェント実行の対象に含めない。人間承認ゲートとして明示的に定義する。
- STEP8完了からSTEP9/10への接続は、P3-5では手動トリガーを既定とする。
  `pull_request: types: [closed]`による自動起動は設計の選択肢として記録するが、
  P3-5では実装しない。
- 理由：「P3-5は各STEPが個別に動作するところまで、UIからの連結はP3-6（現P3-7）」という#323で合意済みの
  境界と整合させるため。自動起動を入れるとP3-5がP3-6（現P3-7）のスコープへはみ出す。

### STEP4とP3-4 Gateway実行の関係：当面併存

- 画面からの`/api/execute`実行（文脈は手貼り）と、エージェント経由のSTEP4（文脈を自動取得）を
  当面併存させる。
- 一本化の判断はLv3-7（サイクル一巡検証）の実績を見てから行う。P3-4で成立した対話型実行
  （確認質問への往復）は現状Gateway側にしかない能力であり、エージェント経由が同等の対話性を
  持てるかが未実証のため。

### `GITHUB_TOKEN`と`GITHUB_PAT`の分離

- エージェント実行では`GITHUB_TOKEN`を採用する。ジョブ終了で自動失効し、権限がコードとして
  レビュー対象になるため。
- ADR 0009で採用済みの`GITHUB_PAT`（Fine-grained PAT）はGateway（Managed Function）用として
  存続させ、エージェント実行では使わない。有効期限管理・漏洩時の影響範囲の観点からも用途を
  分離する。
- ワークフローを起動する側（Managed Function）は、対象リポジトリの`Actions: write`のみを持つ
  専用のFine-grained PAT（`GITHUB_DISPATCH_PAT`）を用いる。ワークフロー内の`GITHUB_TOKEN`、
  ADR 0009の`GITHUB_PAT`（Gateway用）のいずれとも別のトークンである。`repository_dispatch`が
  `Contents: write`を要求するため起動経路として採らないことは、上記トリガー方式のとおり。
- 既知の制約：`GITHUB_TOKEN`で作成したPR・pushは他のワークフロー（`ci.yml`）をトリガーしない。
  STEP6で作成したPRにCIを走らせる必要がある場合のみ、PATまたはGitHub Appを例外として検討する。
  **この判断はLv3-6へ申し送る（本Lv3-1では方針のみ記録し、決定しない）**。

## 成果物（対比図・シーケンス図・マッピング図）

以下3点を本Issueの成果物として添付・参照する。

1. **サイクル順序・実装順序対比図**
   （[lv3-1-agent-step-order.html](assets/lv3-1-agent-step-order.html)）：
   サイクル順序（STEP4→5→6→7→8→9→10、STEP8は人間判断として区別。STEP10→STEP4のループは
   環として描かない）と、実装順序（Lv3-3→Lv3-4→Lv3-5→Lv3-6、権限の弱い順。Lv3-2は4つ全ての
   土台として区別）を、二段構成で対比する。
2. **エージェント実行シーケンス図**
   （[lv3-1-agent-execution-sequence.html](assets/lv3-1-agent-execution-sequence.html)）：
   利用者→PromptTrail［画面］→Managed Function（新規エンドポイント）［部品］→GitHub API：
   repository_dispatch［外部］→GitHub Actions Workflow［外部］（checkout・`GITHUB_TOKEN`・
   permissions宣言、Claude Code Action実行、成果物出力）→PromptTrailによるActions APIポーリング
   ［外部］→Run.output/Linkの保存［DB］という一連の流れを示す。停止手段（`timeout-minutes`宣言、
   Actions UIからのcancel、ワークフロー無効化）を注記として含む。
3. **STEP間入出力・権限マッピング図**
   （[lv3-1-agent-step-io-permissions.html](assets/lv3-1-agent-step-io-permissions.html)）：
   STEP4〜10を行、入力／処理／出力の置き場所／`permissions:`宣言を列とする表。STEP8は
   人間承認ゲートとして視覚的に区別する。

## 実装への申し送り（Lv3-2以降向け）

| 宛先  | 申し送り内容                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lv3-2 | `ci.yml`のcheckout〜pnpm installの並びを流用する。`timeout-minutes`を必ず宣言する。Pull型の結果取得（ポーリング間隔、取得する画面）を設計する。停止手段（cancel・ワークフロー無効化）の手順を文書化する |
| Lv3-3 | STEP4は`contents: read`のみで動作すること、書き込みが一切発生しないことを受入条件に含める。成果物はartifact／job summaryへ出力する                                                                      |
| Lv3-4 | STEP5・9・10を1ワークフローにまとめるか3本に分けるかは、実装時に判断してよい（権限は同一のため）                                                                                                        |
| Lv3-5 | STEP8（人間マージ）の結果をどう記録するかを設計する。自動化はしない                                                                                                                                     |
| Lv3-6 | `GITHUB_TOKEN`で作成したPRが`ci.yml`をトリガーしない制約への対処（PAT／GitHub Appの採用可否）をここで決定する                                                                                           |
| Lv3-7 | PromptTrail自身の実開発テーマで一巡する。一巡後、STEP4のGateway実行との一本化可否を判断する                                                                                                             |

## #270関連の申し送り事項（記録のみ）

以下は、#324の完了条件が求める#270本文の更新内容である。**本Issueでは #270 自体の更新は
行わず、申し送り内容の記録のみを本文書に残す**。

- #270本文のP3-6（現P3-7）の「問い」を、P3-5／P3-6（現P3-7）の分担（P3-5：STEP4〜10が個別にエージェント実行として
  動作しRunとして記録される状態まで／P3-6（現P3-7）：それらをUIから連結してワンストップで回す体験）に
  合わせて書き換える必要がある。
- #270本文の「未割当の論点：文脈取得能力」（親Issue・コードベースを自動参照してPromptへ埋め
  込む能力）について、STEP4のエージェント化（親Lv1 issue番号を入力に実装方針.mdを生成する
  こと）によって回収される旨を追記する必要がある。

## 対象範囲

- 本設計合意文書、図3点、ADR 0010の起票、ADR 0008のStatus更新、roadmap.mdのPhase 3節更新。
- #270本文への反映方針（記録のみ。実際の反映は別途実施）。

## 非対象

- 実装コード全般（Lv3-2以降）。
- ワークフローファイルの作成（Lv3-2）。
- Managed Functionへのトリガー用エンドポイント追加（Lv3-2）。
- `GITHUB_TOKEN`のCI非トリガー制約への対処方針の決定（Lv3-6へ申し送り）。
- STEP9/10の自動起動、UIからのエージェント実行導線（いずれもP3-6（現P3-7））。

## 受入条件

- [x] 本設計合意文書・図3点がマージされている。
- [x] ADR 0010が起票され、決定内容が記録されている。
- [x] ADR 0008のStatusが更新され、本文は書き換えられていない。
- [x] `roadmap.md`のPhase 3節が更新されている。
- [ ] #270本文のP3-6（現P3-7）「問い」の書き換え、「未割当の論点：文脈取得能力」への追記が行われている
      （本文書に記録済み。#270自体への反映は別途実施）。
- [x] Lv3-2が、本文書の申し送り内容に沿って着手可能な状態になっている。
