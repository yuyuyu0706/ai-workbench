# ADR 0010: Agent Execution Shape

## Status

Accepted

## Context

[ADR 0008](0008-gateway-implementation-shape.md)は、P3-3（GitHub / AI Execution Gateway）の
技術構成を「ブラウザ→Managed Function→AI API・GitHub API」という軽量構成に限定し、
ステップ3（自律的な実装・PR作成）以降で必要になる、リポジトリのcheckout・AIコーディング
エージェントの実行・テスト・PR作成というCI環境そのものを要する構成については、「ステップ3
着手時にあらためて技術構成を検討し、別ADRとして記録する」として先送りしていた。

その後、#302（GitHub Issue作成のHTTPエンドポイント直接実装）のレビューを経て、「Issueの
構造化判断を誰が担うか」という論点から案B（外部エージェントへ委譲）が採用され、Guided
Executionの7ステップモデルのうちステップ2（ISSUE作成）も、Managed Functionの単発API呼び出しで
完結する軽量側から、エージェント実行を要する重量側へ移動した。これに伴い、P3-5「エージェント
実行基盤を構築する」がLv2として新設され、本ADRはそのLv3-1（設計・合意形成）で確定した
技術構成を記録する。

[ADR 0009](0009-gateway-external-dependencies-and-domain-representation.md)は、GitHub認証方式
としてFine-grained Personal Access Token（`GITHUB_PAT`、対象リポジトリの`Issues: write`のみ）を
採用し、Gateway（Managed Function）用として運用することを決定済みである。本ADRが対象とする
エージェント実行は、Gatewayとは別の実行主体・別の認証方式を必要とするため、ADR 0009のPAT運用
方針との関係を明確にする必要がある。

## Decision

### エージェント実行環境：GitHub Actions ＋ Claude Code Action

- 実行環境はGitHub Actionsとし、エージェント本体は公式のClaude Code Actionを用いる。Azure
  Container Apps Jobs等は採用しない。
- 理由：既存の`ci.yml`で、checkout・Node・pnpm環境が既に動作しており、Secret管理・タイムアウト
  制御もGitHub標準機構に乗る。Azure側を選ぶと、SWA Managed Functionの実行時間制限を超える
  長時間処理の受け皿と、リポジトリcheckout環境の両方を新規に用意することになる。
- `ANTHROPIC_API_KEY`はGitHub ActionsのSecretsへ保管する。SWA Application Settings側の既存キー
  （Gateway用）とは別管理とする。用途（Gateway／エージェント）が異なるためである。

### トリガー方式：`repository_dispatch`を主経路、`workflow_dispatch`を手動フォールバック

- プログラムからの起動は`repository_dispatch`を用いる。STEP起動にはissue番号・STEP種別・
  前STEPの成果物といった構造化payloadが必要であり、任意JSONを`client_payload`へ載せられるため。
- `workflow_dispatch`のinputsは文字列10個までの制約があり、実装方針.md本文のような長文の
  受け渡しに向かない。そのため主経路には採用しない。
- 手動起動・再実行用に`workflow_dispatch`も併設する。PromptTrail側が動作しない状況でも
  Actions UIから起動でき、障害時の回避手段になる。
- ADR 0008は`workflow_dispatch`のみに言及していたが、本ADRで`repository_dispatch`を主経路と
  する判断へ更新する。

### 権限モデル：`GITHUB_TOKEN` ＋ ワークフロー単位の`permissions:`（STEP別・弱い順）

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

- `GITHUB_TOKEN`を採用する。ジョブ終了で自動失効し、権限がコードとしてレビュー対象になる
  ためである。Fine-grained PAT（ADR 0009で採用済みの`GITHUB_PAT`）は有効期限管理が必要で、
  漏洩時の影響範囲も大きい。
- ADR 0009の`GITHUB_PAT`はGateway（Managed Function）用として存続させ、エージェント実行では
  使わない。用途による意図的な分離である。

### 実行結果の受領：GitHub Source of Truthを基本、Actions APIのPullを最小限併用

- 成果物の正本はGitHub側（Issue、PR、コメント、Actionsのartifact）に置く。PromptTrailは
  `Link`として参照を保持する。[ADR 0007](0007-github-source-of-truth.md)「GitHub Source of
  Truth」と整合する。
- 実行の成否・進行状況は、PromptTrailがGitHub Actions APIを参照して取得する（Pull型）。
- Push型（エージェントがPromptTrailのAPIへ完了通知をPOSTする方式）は採用しない。PromptTrailは
  Local-first（[ADR 0002](0002-prompt-trail-local-first.md)）でサーバ側DBを持たず、ブラウザが
  閉じている間に届いた通知を保存する場所が存在しないためである。
- Pull型の実装範囲（ポーリング間隔、どの画面から取得するか等）はLv3-2で設計する。

### STEP間の入出力契約

| STEP   | 入力                       | 出力                                 | 出力の置き場所                                    |
| ------ | -------------------------- | ------------------------------------ | ------------------------------------------------- |
| STEP4  | 親Lv1 issue番号            | 実装方針.md                          | Actions artifact ＋ job summary（→ `Run.output`） |
| STEP5  | 実装方針.md本文（payload） | 子issue                              | GitHub Issue（→ `Link`）                          |
| STEP6  | 子issue番号                | 開発ブランチ・PR                     | GitHub PR（→ `Link`）                             |
| STEP7  | PR番号                     | レビューコメント                     | PRコメント（→ `Link`）                            |
| STEP8  | レビュー結果               | マージ済みPR                         | 人間が操作。結果のみ記録                          |
| STEP9  | マージ済みPR番号           | 更新済み子issue                      | GitHub Issue                                      |
| STEP10 | 子issue番号                | 更新済み親issue・クローズ済み子issue | GitHub Issue                                      |

- STEP4の成果物はActions artifactおよびjob summaryへ出力する。親issueへのコメント投稿
  （`issues: write`）やリポジトリへのコミット（`contents: write`）を選ぶと、STEP4が
  read-onlyでなくなり、権限階段の出発点が消えるためである。

### STEP8の人間承認ゲート

- STEP8（マージ）はエージェント実行の対象に含めない。技術的な制約ではなく、「承認」という
  人間の判断ポイントを必ず設けるという設計原則として扱う。マージ判断はy.k.が握る唯一の
  関所である。
- STEP8完了からSTEP9/10への接続は、P3-5では手動トリガーを既定とする。
  `pull_request: types: [closed]`による自動起動は設計の選択肢として記録するが、
  P3-5では実装しない。「P3-5は各STEPが個別に動作するところまで、UIからの連結はP3-6」
  という境界と整合させるためである。

### P3-4 Gateway実行との併存

- 画面からの`/api/execute`実行（文脈は手貼り）と、エージェント経由のSTEP4（文脈を自動取得）を
  当面併存させる。一本化の判断はLv3-7（サイクル一巡検証）の実績を見てから行う。P3-4で成立した
  対話型実行（確認質問への往復）は現状Gateway側にしかない能力であり、エージェント経由が
  同等の対話性を持てるかが未実証のためである。
- 新設するエージェント実行の経路は、P3-4のGateway実行の経路を置き換えるものではなく、
  追加の経路として並存させる。

## Consequences

- `GITHUB_TOKEN`で作成したPR・pushは、他のワークフロー（`ci.yml`）をトリガーしない
  という既知の制約がある。STEP6で作成したPRにCIを走らせる必要がある場合、PATまたは
  GitHub Appを例外として採用するかどうかの判断が必要になるが、**本ADRではこの判断を
  行わず、Lv3-6へ申し送る**。
- ADR 0009の`GITHUB_PAT`はGateway専用として維持され、本ADRが導入する`GITHUB_TOKEN`とは
  用途が重複しない。将来Lv3-6で例外的にPATを使う判断がなされた場合も、Gateway用PATとは
  別スコープ・別目的として扱う必要がある。
- Local-first（ADR 0002）の方針を、エージェント実行の結果受領方式においても再確認した。
  PromptTrailにサーバ側の永続領域を新設しない限り、Push型の通知受領は成立しないため、
  Pull型（Actions APIポーリング）が唯一の選択肢となる。
- P3-3のGateway実行経路とP3-5のエージェント実行経路が併存することで、実装・運用の複雑さは
  一時的に増すが、STEP4の一本化判断をLv3-7まで遅らせることで、拙速な統合による手戻りを
  避けられる。
