# ADR 0006: External Execution Boundary

## Status

Accepted

## Context

Roadmap の Phase 3〜4（[roadmap.md](../../product/prompt-trail/roadmap.md)）は、Trail から ChatGPT / Codex などの外部 AI 実行環境へ直接連携する「AI Execution Gateway」を将来投資として位置付けています（P3-3 以降）。実装着手前に、PromptTrail Domain と外部実行環境との責務境界を定義しておくことで、Trail / Run の設計が特定の実行プロバイダに依存しないことを保証します。

## Decision

- PromptTrail Domain（Trail、Run、PromptSnapshot、ContextSnapshot）は、外部 AI 実行環境の呼び出し方法・認証・応答形式を一切知りません。Domain が保持するのは「何を実行依頼したか（Snapshot・`finalPrompt`）」と「実行後にどう記録するか（Run の `status` / `evaluation` / `improvementNote`、Link）」であり、「どう実行するか」は含みません。
- 外部実行環境との連携は、Domain の外側に位置する Gateway 層（未実装）が担います。Gateway は Run の `finalPrompt` を入力として受け取り、実行結果を Link や将来の Run 拡張として書き戻す、という単方向の依存のみを持ちます。Domain から Gateway への依存は発生させません。
- 現時点では Gateway の具体的な API 形状、対応プロバイダ（ChatGPT / Codex など）、認証方式、リトライ・エラー処理は未確定であり、本 ADR ではその実装方針を確定しません。実装は P3-3 以降の別 Issue で扱います。
- 本 ADR が確定するのは境界の位置（Domain と Gateway を分離すること）のみです。

## Consequences

- Trail / Run の Domain 設計は、将来どの外部実行環境を採用しても変更を必要としません。
- Gateway 未実装の間は、Run の実行記録は引き続き利用者が手動で Link として登録する現行フロー（P0〜P2 の Public Alpha Direct Run 相当）を維持します。
- Gateway の具体設計（実行トリガー UI、非同期実行状態の Run への反映方法など）は、着手時に本 ADR を前提として別途 ADR 化します。
