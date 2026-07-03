# Monorepo Structure

AI Workbench のモノレポ構成を説明するためのサンプルです。

## ディレクトリ方針

- `apps/`: 各プロダクトのアプリケーションコードを配置します。
- `docs/product/`: プロダクト仕様やロードマップを配置します。
- `docs/architecture/`: 技術設計やシステム構成を配置します。
- `docs/adr/`: Architecture Decision Record を配置します。

## 運用方針

プロダクトごとに独立したドキュメントを持ちつつ、共通の設計判断は ADR として記録します。
