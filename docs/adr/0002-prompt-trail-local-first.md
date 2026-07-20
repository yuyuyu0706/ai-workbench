# ADR 0002: PromptTrail Local First

## Status

Accepted

## Context

PromptTrail は個人の試行錯誤や未公開のプロンプトを扱います。Phase 0 では、利用者がバックエンド、認証、クラウド保存を必要とせずに作業資産を扱える保存境界を確定する必要があります。

## Decision

- PromptTrail は Phase 0 で local-first を採用します。
- 保存境界は browser origin ごとの IndexedDB とし、Dexie をその永続化境界に利用します。
- Local、GitHub Pages、Azure Static Web Apps の各 origin 間で IndexedDB は共有しません。
- Cloud DB、同期、認証は Phase 0 の対象外とします。
- 同期または共同利用が必要になった時点で、この判断を再評価します。

## Consequences

- 利用者は backend を用意せずに個人利用を始められます。
- browser storage の削除や origin の違いにより、データが別管理または失われる可能性を利用者へ明示する必要があります。
- cross-origin、端末間、複数利用者間のデータ共有は提供しません。
- 同期や共同利用を導入する場合は、保存境界、認証、競合解決、移行を別途設計します。
