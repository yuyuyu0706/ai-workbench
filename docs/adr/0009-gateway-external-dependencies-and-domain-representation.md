# ADR 0009: Gateway External Dependencies and Domain Representation

## Status

Accepted

## Context

[ADR 0008](0008-gateway-implementation-shape.md)は、P3-3（GitHub / AI Execution Gateway）の
技術構成として、Managed FunctionがAI API・GitHub APIを直接呼び出す軽量構成を定義したが、
Managed Function基盤（Lv3-3）の設計に先立ち、実装に直結する3つの未確定事項が残っていた。
AI APIプロバイダの選定、GitHub認証方式の選定、PLAN生成・ISSUE作成という各ステップの実行結果を
既存のTrail/Run/Link Domainでどう表現するかである。ADR 0008は技術構成の決定に特化しており、
性質の異なるこれらの決定を混在させないため、本ADRへ分離して記録する。

## Decision

### AI APIプロバイダ

- Claude API（Anthropic）・OpenAI API（GPT/Codex系）の両方に対応する設計とする。
- Gateway（Managed Function）に、プロバイダごとの呼び出しを抽象化する層を設ける。抽象化は
  「入力プロンプト→生成テキストを返す」程度の薄いインターフェースに留める。
- プロバイダの選択は、リクエスト時に明示的なパラメータ（`provider: 'claude' | 'openai'`）で
  指定する方式とする。Promptのタグ等に基づく自動振り分けは、複雑度を抑えるため見送る。
- 両プロバイダのAPIキーは、Azure Static Web AppsのApplication Settingsへ個別に保管する
  （`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`）。

### GitHub認証方式

- Fine-grained Personal Access Tokenを採用する。
- スコープは対象リポジトリの`Issues: write`権限のみに絞る。個人開発規模のため、GitHub App
  導入によるインストールフロー・JWT認証等の複雑さは見送る。
- トークンはAzure Static Web AppsのApplication Settingsへ保管する（`GITHUB_PAT`）。

### PLAN生成・ISSUE作成のDomain表現

- Guided Executionの各ステップ（PLAN生成、ISSUE作成等）は、それぞれ1つの`Run`として表現する。
  P3-1で確立した「1 Trail : N Run」の関係をそのまま活用し、新規Entityは追加しない。
- `Run`型へ`output: string | null`を新規追加する。結果の性質によって記録先を使い分ける。
  - 生成テキストそのもの（例：PLAN生成の出力）→ `Run.output`
  - URLを持つ外部参照（例：ISSUE作成で作られたGitHub Issueへの参照）→ 既存の`Link`
    （`url`/`type`/`externalId`という既存の枠組みをそのまま使う）
- 既存の`finalPrompt`（依頼内容）・`evaluation`／`improvementNote`（実行後評価）は変更しない。
  `output`はこれらとは別の目的（生成された成果物そのものの保持）を持つ新規fieldとして追加する。

## Consequences

- Gatewayは特定のAI APIプロバイダへ依存せず、将来的なプロバイダ追加・切替の余地を残す。一方で
  自動振り分けロジックは持たないため、プロバイダ選択はクライアント側の責務として残る。
- GitHub認証は最小権限（単一リポジトリの`Issues: write`のみ）に限定され、個人開発規模に見合った
  運用負荷で済む。将来、複数リポジトリ・Organization規模への対応が必要になった場合は、GitHub App
  への移行をあらためて検討する。
- 既存のTrail/Run/Link構造を変更せずに拡張できるため、P3-1の設計資産をそのまま活用できる。
  `Run.output`の実装自体はLv3-4（PLAN生成エンドポイント）で行い、本ADR時点ではDomain表現の
  決定のみを記録する。
- `finalPrompt`／`evaluation`／`improvementNote`との責務境界は、
  [data-model.md](../architecture/prompt-trail/data-model.md)に明記し、`output`追加による
  誤用・混同を防ぐ。
