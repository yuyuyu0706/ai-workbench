# PromptTrail Phase 0 Technical Baseline

この文書は、**P0-5 完了、P0-6-2-1 / P0-6-2-2 反映済み**の PromptTrail を横断して読むための Phase 0 技術ベースラインです。詳細な設計や手順を複製せず、「どの問いをどの正本で確認するか」を示します。

## 技術構造サマリ

PromptTrail は pnpm Workspace 内の React / TypeScript / Vite SPA です。browser origin ごとの IndexedDB を Dexie 経由で利用し、Repository を永続化の公開境界として扱います。Runtime は bootstrap と Provider で Repository を公開し、React Router と AppShell が画面を接続します。Dashboard だけが Repository の実データを読み取り、他の主要 Page は静的な開始状態です。品質判断は CI を含む品質ゲート、成果物の配信・表示確認は Hosted Preview の責務です。

## Phase 0 実装状態

| 領域                                 | Phase 0 状態                     | 正本                                                                                                                                                     |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace / Build                    | 実装済み                         | [manifests](../../../package.json) / [Local Development](../../development/local-development.md)                                                         |
| Lint / Format / Unit / E2E / CI      | 実装済み                         | [Quality Gates](../../development/quality-gates.md)                                                                                                      |
| 6 Domain Models / Dexie / Repository | 実装済み                         | [Data Model](data-model.md)                                                                                                                              |
| Runtime / Bootstrap / Provider       | 実装済み                         | [Application Architecture](../../product/prompt-trail/application-architecture.md)                                                                       |
| Dashboard                            | Repository 実データ接続済み      | [Application Architecture](../../product/prompt-trail/application-architecture.md)                                                                       |
| Prompt / Context / Recipe            | 静的 start state                 | [Application Architecture](../../product/prompt-trail/application-architecture.md) / [Screen Structure](../../product/prompt-trail/screen-transition.md) |
| Run Detail                           | route parameter を受ける静的骨格 | [Application Architecture](../../product/prompt-trail/application-architecture.md) / [Screen Structure](../../product/prompt-trail/screen-transition.md) |
| Sample Seed                          | 明示実行として実装済み           | [Application Architecture](../../product/prompt-trail/application-architecture.md) / [Data Model](data-model.md)                                         |
| Hosted Preview                       | 実装済み                         | [Deployment and Hosted Preview](../../product/prompt-trail/deployment-and-preview.md)                                                                    |
| CRUD / 検索 / Recipe 実行など        | Phase 1 以降                     | [Functional Requirements](../../product/prompt-trail/functional-requirements.md) / [Roadmap](../../product/prompt-trail/roadmap.md)                      |

通常起動時に Fresh DB へ自動 Seed はしません。Sample Seed は通常起動と独立した明示経路です。Phase 0 の実装済み範囲と、Phase 1 以降の目標要件は区別して確認します。

## 正本責務マップ

| 知りたいこと                      | 正本                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Product の目的・範囲              | [Overview](../../product/prompt-trail/overview.md)                                    |
| 将来を含む目標機能要件            | [Functional Requirements](../../product/prompt-trail/functional-requirements.md)      |
| Phase 別実装計画                  | [Roadmap](../../product/prompt-trail/roadmap.md)                                      |
| Application 構造・依存・状態責務  | [Application Architecture](../../product/prompt-trail/application-architecture.md)    |
| Domain / Persistence / Repository | [Data Model](data-model.md)                                                           |
| 画面・Route・利用導線             | [Screen Structure](../../product/prompt-trail/screen-transition.md)                   |
| 正常系の環境構築                  | [Local Development](../../development/local-development.md)                           |
| 障害診断・復旧                    | [Troubleshooting](../../development/troubleshooting.md)                               |
| 品質判断・PR 前確認・CI           | [Quality Gates](../../development/quality-gates.md)                                   |
| Hosted Preview / Deploy           | [Deployment and Hosted Preview](../../product/prompt-trail/deployment-and-preview.md) |
| 重要な設計判断                    | [ADR](../../adr/)                                                                     |

## 品質責務

| 領域                    | 責務                                                             | 正本                                                                                  |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Lint                    | TypeScript / React の静的品質を確認する                          | [Quality Gates](../../development/quality-gates.md)                                   |
| Format Check            | Prettier 対象ファイルの整形差分を検出する                        | [Quality Gates](../../development/quality-gates.md)                                   |
| Unit / Component        | jsdom 上の Domain、Repository、UI 振る舞いを確認する             | [Quality Gates](../../development/quality-gates.md)                                   |
| E2E                     | Browser、Route、IndexedDB、Desktop / Mobile の利用体験を確認する | [Quality Gates](../../development/quality-gates.md)                                   |
| Build                   | production build の成立を確認する                                | [Quality Gates](../../development/quality-gates.md)                                   |
| PR CI                   | main マージ前の最終品質判断を行う                                | [Quality Gates](../../development/quality-gates.md)                                   |
| Hosted Preview / Deploy | 成果物の配信・表示を確認する                                     | [Deployment and Hosted Preview](../../product/prompt-trail/deployment-and-preview.md) |

> Deploy 成功 ≠ 品質保証成功

品質判断は [Quality Gates](../../development/quality-gates.md)、配信判断は [Deployment and Hosted Preview](../../product/prompt-trail/deployment-and-preview.md) を正本とします。PR 前のローカル確認は早期のフィードバックであり、PR CI は main マージ前の最終判断です。

## 設計判断の索引

| 判断                                                      | 確認先                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| モノレポと共通化のタイミング                              | [ADR 0001](../../adr/0001-ai-workbench-monorepo.md) / [Monorepo Structure](../monorepo-structure.md) |
| Local-first の保存境界と同期の非対象                      | [ADR 0002](../../adr/0002-prompt-trail-local-first.md) / [Data Model](data-model.md)                 |
| Phase 0 の採用技術と意図的非採用                          | [ADR 0003](../../adr/0003-prompt-trail-technology-stack.md)                                          |
| Repository 境界、6 モデル、Snapshot、schema version 1     | [Data Model](data-model.md)                                                                          |
| Runtime、依存注入、Dashboard 状態、Sample Seed の起動経路 | [Application Architecture](../../product/prompt-trail/application-architecture.md)                   |

## P0-6-3 統合受入の参照先

統合受入では、次を順に参照して Phase 0 の実装・文書・品質・配信の整合を確認します。

1. [Application Architecture](../../product/prompt-trail/application-architecture.md) — 起動、依存、Dashboard と Page の現在状態。
2. [Data Model](data-model.md) — 6 モデル、Dexie schema version 1、Repository と Sample Seed。
3. [Screen Structure](../../product/prompt-trail/screen-transition.md) — route、画面導線、recovery route。
4. [Quality Gates](../../development/quality-gates.md) — ローカル確認、PR CI、品質判断。
5. [Deployment and Hosted Preview](../../product/prompt-trail/deployment-and-preview.md) — 配信と hosted 表示確認。
6. [ADR 0001](../../adr/0001-ai-workbench-monorepo.md)、[ADR 0002](../../adr/0002-prompt-trail-local-first.md)、[ADR 0003](../../adr/0003-prompt-trail-technology-stack.md) — 設計判断。

このベースラインは正本の索引です。実装、設定、依存関係、lockfile、将来機能の仕様は変更しません。
