# ADR 0003: PromptTrail Technology Stack

## Status

Accepted

## Context

Phase 0 の PromptTrail を、静的ホスティング可能な local-first SPA として実装し、品質確認を継続できる技術スタックを確定する必要があります。

## Decision

Phase 0 では次を採用します。

- TypeScript、React、Vite、pnpm Workspace
- IndexedDB + Dexie、React Router
- Vitest + React Testing Library、Playwright Chromium
- ESLint + Prettier、静的ホスティング

Phase 0 では Backend API、認証、Cloud DB、追加のモノレポ基盤、共通 UI package、ChatGPT / Codex の直接実行を意図的に採用しません。技術ごとの手順と運用詳細は各正本を参照し、この ADR には複製しません。

## Consequences

- browser 内で完結する local-first の PromptTrail を、pnpm Workspace で開発・配布できます。
- Unit / Component Test と Browser E2E を分け、静的品質と production build を継続確認できます。
- backend、同期、認証、共通 package が必要になった場合は、実際の要件と重複を根拠に別途判断します。
