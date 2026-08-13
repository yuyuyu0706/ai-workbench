# ADR 0007: GitHub Source of Truth

## Status

Accepted

## Context

Roadmap の Phase 3〜4（[roadmap.md](../../product/prompt-trail/roadmap.md)）は、Issue 作成・PR 参照など GitHub 上のリソースを Trail の実行証跡として正本化する方向性を、Investment Hypothesis 3・6（AI / GitHub への手動転記の負荷、Execution Integration への優先投資）の裏付けとして示しています。現行の Link Model は GitHub Issue / PR への手動 URL 登録のみをサポートしており、GitHub 側の状態変化（Issue Close、PR Merge など）を PromptTrail 側が正本として扱う仕組みは未設計です。実装着手前に、PromptTrail Domain と GitHub 上のリソースとの責務境界を定義しておく必要があります。

## Decision

- PromptTrail Domain（Trail、Run、Link）は、GitHub 上のリソース（Issue、PR、Commit、Release）そのものを複製・キャッシュしません。Link は現行どおり `url` / `type` / `externalId` などの参照情報のみを保持し、GitHub 側の本文・状態は都度 GitHub を正本として参照します。
- 「GitHub を Source of Truth とする」とは、PromptTrail が GitHub 上のリソースの内容や状態を独自に上書き・再定義しないことを意味します。PromptTrail 側で保持するのは参照（Link）と、参照時点のスナップショットが必要な場合に限った最小限の表示用メタデータです。
- GitHub 連携の具体的な実装（Webhook 受信、GitHub API によるステータス同期、Issue/PR 作成の自動化）は本 ADR では確定しません。実装は P3-3 以降の別 Issue で扱います。
- 本 ADR が確定するのは境界の位置（PromptTrail は GitHub の内容を複製しない）のみです。

## Consequences

- GitHub 連携が未実装の間も、Link Model は現行の手動 URL 登録フローをそのまま維持できます。
- 将来 GitHub 連携を実装する際も、Trail / Run / Link の Domain 設計を GitHub 固有の状態機械に合わせて変更する必要はありません。連携層は Domain の外側に追加されます。
- GitHub 側のリソースが削除・変更された場合の PromptTrail 側の扱い（Link の無効化表示など）は、連携実装時に別途設計します。
