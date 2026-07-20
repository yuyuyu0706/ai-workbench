# AI Workbench Monorepo Structure

この文書は、AI Workbench 共通のディレクトリ責務を簡潔に示す技術文書です。説明用サンプルではなく、現在のモノレポを読む入口として扱います。

## ディレクトリ責務

- `apps/`: 各プロダクトのアプリケーションコードと、アプリ固有の README を配置します。
- `docs/product/`: プロダクトの目的、目標要件、画面導線、ロードマップ、配信契約を配置します。
- `docs/architecture/`: 横断的な技術構造とプロダクト別の技術ベースライン・データモデルを配置します。
- `docs/development/`: ローカル開発、品質判断、障害診断・復旧の運用正本を配置します。
- `docs/adr/`: 長期的に追跡すべき Architecture Decision Record を配置します。
- `.github/`: Issue / PR テンプレートと CI・Deploy workflow を配置します。

## 運用方針

AI Workbench をモノレポとする判断は [ADR 0001](../adr/0001-ai-workbench-monorepo.md) を正本とします。PromptTrail の Phase 0 実装状態、正本責務、品質・配信への導線は [PromptTrail Phase 0 Technical Baseline](prompt-trail/README.md) を参照してください。

`packages/` は、2 つ目のアプリで実際の重複が確認されるまで作成しません。共通化の必要性が確認された時点で、責務と依存関係を ADR で再評価します。
