# ADR 0005: Trail / Run Responsibility

## Status

Accepted

## Context

Phase 0〜2 の Run は、実行証跡（Prompt Snapshot、Context Snapshot、`inputValues`、`finalPrompt`、評価）に加えて `trailTitle` と `trailKind` という「作業単位としての名前・種別」を直接保持していました。この設計は 2 つの課題を露呈しました。

1. [Issue #266](https://github.com/yuyuyu0706/ai-workbench/issues/266) で報告された Trail 名バグ: Trail の名前や種別が Run 1 件に強く結びついているため、Trail としての作業単位と個々の実行記録という 2 つの概念が 1 モデルに混在し、名称更新やバグ修正が Run の実行証跡の不変性と衝突しました。
2. Phase 3 で想定する「1 つの作業（Trail）の中で複数回 Prompt を実行し、複数の Run/Step を積み重ねる」利用像を、Run 1 件 = Trail 1 件という現行モデルでは表現できません。

Roadmap の Phase 3 Architecture Hypothesis（[roadmap.md](../../product/prompt-trail/roadmap.md)）は、Trail を独立した Domain Model として切り出す方向性を示しています。

## Decision

- 新しい Trail Model を追加します。`Trail { id, projectId, title, kind, createdAt, updatedAt, deletedAt, archivedAt }`。Trail は Project に直接属する独立エンティティであり、AssetScope（Global / Project）は持ちません。Trail は常に Project の下にあります。
- Run から `trailTitle` / `trailKind` を削除し、`trailId: TrailId` を追加します。Run は従来どおり Prompt Snapshot、Context Snapshot、`inputValues`、`finalPrompt`、`status`、`evaluation`、`improvementNote` という実行時点の不変証跡を保持し続けます。
- PromptSnapshot は Trail ではなく Run に残します。Snapshot は「その回の実行で何を投げたか」という Run 固有の証跡であり、Trail（作業単位の名前・種別）が変わっても Run ごとの Snapshot は独立して保持されるべきだからです。将来 1 Trail に複数 Run が紐付いても、各 Run は自分自身の Snapshot を持ちます。
- 今回の migration は 1 Run : 1 Trail の 1 対 1 backfill に留めます。1 Trail に対する複数 Run の作成・表示 UI、Trail 単位の実行ステータス集約は実装しません（将来課題）。
- `Run.projectId` は Trail 経由で冗長に導出可能になりましたが、既存 Repository・Query 実装への影響を避けるため、当面は Run にも維持します。冗長 field の削除は別 Issue で判断します。

## Consequences

- Trail 名・Trail 種別の変更は Trail Store の更新で完結し、Run の実行証跡（Snapshot・`finalPrompt` など）に触れません。Issue #266 のようなバグ発生時の影響範囲を Trail に限定できます。
- 将来「1 Trail に複数 Run」を実装する際は、Trail Model・`Run.trailId` を変更せずに Run 側の作成フローを拡張するだけで済みます。
- schema migration は Run 1 件につき Trail 1 件を作成するため、既存データ量に比例して Trail Store のレコード数が増えます。
- `Run.projectId` の重複は解消されないままなので、参照整合性チェックは Run/Trail 双方の `projectId` 一致を検証し続けます。重複解消は将来の Issue で扱います。
