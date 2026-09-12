# エージェント実行運用手順（停止手段・起動・確認）

- 対象Issue：[#327](https://github.com/yuyuyu0706/ai-workbench/issues/327)
- 親Lv3 Issue：[#326 Lv3-2：実行基盤](https://github.com/yuyuyu0706/ai-workbench/issues/326)
- 対象ワークフロー：`.github/workflows/agent-step.yml`（`PromptTrail Agent Step`）
- 位置づけ：ADR 0010（Agent Execution Shape）で合意した停止手段を、Actions UIでの実操作手順として記録する運用文書。設計の決定理由はADR 0010を参照する。

## 停止手段の一覧

| 手段                               | 内容                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeout-minutes`                  | ジョブが10分を超えると自動的に停止する。ダミー処理は数秒で終わるため、ハングした場合の上限として機能する。                                              |
| Actions UIからのcancel             | 実行中のrunをActions画面から即時停止できる。手動介入による緊急停止手段。                                                                                |
| ワークフローの無効化               | `workflow_dispatch`による新規起動のみを止める手段。実行中のrunは止まらないため、実行中のrunを止めたい場合は別途cancelが必要。                           |
| `concurrency`による多重起動抑止    | 同一`promptTrailRunId`の重複起動はキューイングされ、実行中のジョブが強制停止されることはない（`cancel-in-progress: false`）。                           |
| 起動用PATの失効（Lv4-2で追加予定） | PromptTrail側からの起動経路を遮断する手段。Lv4-1時点ではPromptTrailからの起動用PATが未導入のため、項目のみ記載する。具体的な失効手順はLv4-2で追記する。 |

## 緊急停止の手順

### 実行中のrunを止める

1. GitHubリポジトリの「Actions」タブを開く。
2. 左側のワークフロー一覧から「PromptTrail Agent Step」を選択する。
3. 停止したい実行中のrun（黄色い実行中アイコン）をクリックする。
4. run詳細画面右上の「Cancel workflow」を選択する。
5. runのステータスが「Canceled」に変わることを確認する。

### 起動そのものを止める

1. 「Actions」タブ→「PromptTrail Agent Step」を開く。
2. 画面右上の「...」（その他のオプション）から「Disable workflow」を選択する。
3. ワークフロー名の横に「This workflow is disabled.」と表示され、`workflow_dispatch`からの新規起動ができなくなることを確認する。
4. 再開する場合は同じメニューから「Enable workflow」を選択する。

## 起動方法

`agent-step.yml`は`workflow_dispatch`のみをトリガーとする。PromptTrail本体からの自動起動経路が未実装の間、および障害時のフォールバック経路として、Actions UIから手動起動する。

1. 「Actions」タブ→「PromptTrail Agent Step」を開く。
2. 「Run workflow」ボタンを選択する。
3. 対象ブランチを選ぶ（通常は`main`）。
4. 各inputを入力する。
   - `step`：実行するSTEP種別。Lv4-1時点では`dummy`のみ選択できる。
   - `issueNumber`：対象Issue番号。任意項目で、Lv4-1では記録のみに使う。
   - `promptTrailRunId`：呼び出し元のRun IDを表す文字列。必須。英数字と`.` `_` `-`のみ使用できる（artifact名に使われるため）。artifact名・job summary・`concurrency`のグループ分けに使われる。
   - `forceFailure`：`false`（既定）で正常終了、`true`で最後のステップを意図的に失敗させる。
5. 「Run workflow」を実行し、run一覧に新しいrunが現れることを確認する。

## 確認方法

### 成功時（`forceFailure: false`）

1. runが緑色の「Success」で完了することを確認する。
2. run詳細画面のジョブサマリ（job summary）に、入力した`step`／`issueNumber`／`promptTrailRunId`／`forceFailure`とrun IDが表示されていることを確認する。
3. run詳細画面の「Artifacts」欄から`agent-output-<promptTrailRunId>`をダウンロードし、`output.md`の内容がjob summaryと同じであることを確認する。

### 失敗時（`forceFailure: true`）

1. runが赤色の「Failure」で完了することを確認する。
2. それでも「Artifacts」欄に`agent-output-<promptTrailRunId>`が残っていることを確認する（`output.md`が生成済みであれば、artifactアップロードは`if: always()`のため失敗時も実行される）。
3. job summaryにも入力値が反映されていることを確認する（失敗ステップはjob summary出力より後に実行されるため）。

### `promptTrailRunId`の形式エラーで失敗した場合

- run詳細画面の`Validate promptTrailRunId`ステップに`::error::`注釈が表示されていれば、原因は入力値の形式エラーである（英数字と`.` `_` `-`以外の文字を含んでいる）。この場合`output.md`は生成されず、Upload artifactもスキップされる。
