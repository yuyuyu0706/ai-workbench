# PromptTrail Overview

PromptTrail は、AI を活用した知的生産・開発作業における Prompt、Context、Recipe、Run、Link を管理し、依頼から成果物までの Trail を追跡するためのローカルファーストなワークベンチです。

```text
Prompt / Context
      ↓
    Recipe
      ↓
      Run
      ↓
Chat → Issue → PR → Commit / Release
```

## 目的

PromptTrail の目的は、AI との会話、開発依頼、GitHub Issue、PR、成果物が分散しやすい課題を解決することです。

Prompt を保存するだけではなく、背景情報、制約、設計原則、実行履歴、成果へのつながりを再利用可能な作業資産として残します。これにより、ChatGPT による構想整理、GitHub Issue 化、Codex への実装依頼、PR 確認という流れを一本の Trail として辿れるようにします。

## 解決したい課題

- AI との会話、Issue、PR、Commit、資料が別々の場所に残り、後から関係性を追いにくい。
- 過去にうまくいった依頼文や背景情報を、次の作業で再利用しにくい。
- Prompt の改善履歴だけでは、どの成果物につながったかを判断しにくい。
- GitHub 運用において、Chat で決めた内容と Issue／PR の対応関係が失われやすい。
- AI への依頼品質を高めるための Context や Recipe が個人の記憶に依存しやすい。

## 想定利用者

- ChatGPT や Codex を使って設計、実装、レビュー、ドキュメント作成を行う開発者。
- GitHub Issue や PR を中心に、AI 活用の履歴と成果を整理したい個人開発者。
- プロンプト、背景情報、依頼テンプレートを再利用可能な資産として育てたいユーザー。
- ローカルファーストに作業記録を管理し、必要に応じて外部リンクだけを紐付けたいユーザー。

## 基本コンセプト

PromptTrail は、AI への依頼を一回限りのテキストではなく、次の作業へ活かせる Trail として扱います。

- **Prompt / Context**: 依頼テンプレートと背景情報を分けて管理する。
- **Recipe**: Prompt と Context を組み合わせ、用途ごとの作業レシピとして保存する。
- **Run**: 実際に生成・利用した依頼を、実行時点のスナップショットとして残す。
- **Link**: Chat、Issue、PR、Commit、Document などの外部接続を Run に紐付ける。
- **Trail**: Chat → Issue → PR → Commit / Release の流れを後から辿れるようにする。

## 管理対象

| 管理対象 | 役割 |
| --- | --- |
| Project | 作業資産を束ねる単位 |
| Prompt | 再利用可能な依頼テンプレート |
| Context | 背景、制約、設計原則 |
| Recipe | Prompt と Context を組み合わせた作業レシピ |
| Run | 実際に生成・利用した依頼の記録 |
| Link | Chat、Issue、PR、資料などの外部接続 |

## MVP の範囲

MVP は Phase 3 完了時点とします。Phase 3 完了時点で、PromptTrail を日常の AI 活用・GitHub 運用に投入できる状態を目指します。

MVP には次を含めます。

- Project、Prompt、Context の管理。
- Recipe による Prompt 生成。
- Run 履歴の保存。
- Chat、Issue、PR、Commit、Document などへの Link 登録。
- Chat → Issue → PR の Trail 確認。
- ローカルファーストなデータ保存。

## MVP で意図的に見送る範囲

- ChatGPT や Codex の直接実行。
- GitHub API による Issue／PR 自動同期。
- GitHub トークンの保存。
- 複数人リアルタイム共同編集。
- クラウド同期。
- RAG による Context 自動検索。

## 関連ドキュメント

- [Functional Requirements](functional-requirements.md)
- [Roadmap](roadmap.md)
- [ADR 0001: AI Workbench Monorepo](../../adr/0001-ai-workbench-monorepo.md)
