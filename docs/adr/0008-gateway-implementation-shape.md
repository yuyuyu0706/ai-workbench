# ADR 0008: Gateway Implementation Shape

## Status

Accepted

## Context

[ADR 0006](0006-external-execution-boundary.md)は、外部実行環境との連携をDomainの外側の
Gateway層が担うことを定義したが、Gatewayの具体的なAPI形状・技術構成は未確定のまま、
「実装は P3-3 以降の別Issueで扱う」として先送りしていた。P3-3（GitHub / AI Execution Gateway）の
検討過程で、Guided Executionが目指す7ステップのモデル（開発テーマ→PLAN生成→ISSUE作成→
実装・PR→レビュー→マージ→Issue更新→親Issue引継ぎ）が明確になり、各ステップの技術的難易度に
大きな段差があることが判明した。ステップ1・2・4・6・7は単発のAPI呼び出しで完結する一方、
ステップ3（実装・PR作成）のみ、リポジトリのcheckout、AIコーディングエージェントの実行、
テスト、PR作成という、CI環境そのものを要する非同期・長時間処理である。

## Decision

- P3-3では、Guided Executionの最初のThin Vertical Slice（PLAN＋ISSUE、ステップ1・2）の
  基盤のみを対象とする。ステップ3以降（自律的な実装・PR作成を含む）は、技術的難易度の
  段差が大きいため、別テーマとして切り出す。
- P3-3のGateway技術構成は、「ブラウザ（React App）→ fetch() → Azure Static Web Apps
  Managed Function → AI API呼び出し（PLAN生成）・GitHub API呼び出し（Issue作成）」という
  軽量な構成とする。Managed FunctionがAI API・GitHub APIを直接呼び出す。
- workflow_dispatch／GitHub Actions連携は、本Decisionでは採用しない。この仕組みが必要になるのは
  CI環境を要するステップ3以降であり、P3-3の対象外である。ステップ3着手時に、あらためて
  技術構成を検討し、別ADRとして記録する。
- 秘密情報（AI APIキー、GitHub token）はAzure Static Web AppsのApplication Settingsで管理し、
  クライアント側には一切露出させない。
- 「マージ」（ステップ5）は、常に自動実行しないという技術的制約ではなく、「承認」という
  人間の判断ポイントを必ず設けるという設計原則として扱う。ステップ5自体をPromptとして
  定義することは妨げないが、承認アシスト機能の本格実装はP3-3の対象外とする。

## Consequences

- P3-3の実装規模は、workflow_dispatch／GitHub Actions連携を含む場合と比べて大幅に小さくなる。
  Managed Functionの新設、AI API・GitHub API呼び出しのみで完結する。
- ステップ3（自律的な実装・PR作成）の技術検討・実装は、規模の異なる別テーマとして
  将来のIssueで扱う。着手時には、workflow_dispatch／GitHub Actions連携を含む、より重い
  技術構成の検討が必要になる。
- Gatewayの秘密情報管理・呼び出し方針が明確になったことで、P3-3配下のLv3-3以降
  （Managed Function基盤の新設）の設計に直接活用できる。
