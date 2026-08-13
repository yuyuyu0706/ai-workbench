# ADR 0004: Workspace / Project Responsibility

## Status

Accepted

## Context

PromptTrail は Phase 0〜2 を通じて Project を唯一の所有境界として扱ってきました。Phase 3 の Trail 分離検討（[Roadmap Rebaseline Issue #259](https://github.com/yuyuyu0706/ai-workbench/issues/259)、[P2-6 Scope Decision #268](https://github.com/yuyuyu0706/ai-workbench/issues/268)）では、複数 Project を束ねる上位境界（Investment Hypothesis 4、以下 Hypothesis 4）の要否が論点になりましたが、Phase 2 時点の利用証拠からは判断できず、Roadmap は「Default Workspace のみ、CRUD・切替は対象外」で P3-1 に進む方針を確定しました。Trail を Project から独立させるにあたり、Project の直上に位置する境界を Domain 上どう表現するかを決める必要があります。

## Decision

- 新しい Workspace Model を追加し、Project の上位所有境界とします。`Workspace { id, name, createdAt, updatedAt, deletedAt }` を持ち、archive 状態は持ちません。
- Project は `workspaceId: WorkspaceId` を持ち、Workspace に所属します。既存 Project は migration で `DEFAULT_WORKSPACE_ID` に一括所属させます。
- Project の既存責務（Prompt / Context / Recipe / Run / Trail の scope 境界、Repository bundler としての役割）は変更しません。Workspace は Project の集合を束ねるだけで、Project が持つ asset scope や参照整合性には関与しません。
- 今回実装するのは Default Workspace のみです。Workspace の CRUD API、複数 Workspace の作成・切替 UI、Workspace 単位の権限やメンバー管理は実装しません。
- Hypothesis 4（複数 Workspace が実際に必要かどうか）は今回の証拠からは判断せず、判断を確定しません。追加の利用観察により Hypothesis が支持された場合に、CRUD・切替 UI・Workspace 単位の権限モデルを別途設計します。支持されない場合は Workspace を「将来のための予約された概念」として維持するか、モデルごと廃止するかを再検討します。

## Consequences

- Project は今後も Prompt / Context / Recipe / Run / Trail の直接の所有境界であり続け、既存 Repository API・参照整合性ルールへの影響はありません。
- Workspace の追加は 1 Store・1 属性の追加に留まり、schema migration は Default Workspace の作成と Project への `workspaceId` 一括付与のみを行います。
- 複数 Workspace の実運用（切替 UI、Workspace 単位の一覧・作成・削除）は本 ADR の対象外であり、着手判断は Hypothesis 4 の追加検証結果に委ねます。
