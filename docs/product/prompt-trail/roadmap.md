# PromptTrail Roadmap

このロードマップは、PromptTrail を「機能を広く完成してから投入する」計画から、「最小体験を早期に Public Alpha として公開し、利用者から学びながら育てる」計画へ再編した正本です。機能要件の正本は [Functional Requirements](functional-requirements.md) とし、本書は後続の Lv1 / Lv2 Issue の優先順位とスコープを定めます。

## 方針

```text
Build Minimum → Release → Learn → Prioritize → Build
```

Phase の完了は実装量だけでなく、次の意思決定に必要な情報を得られたかで判断します。MVP は完成品ではなく、利用者が PromptTrail の中核価値を試せる最小体験です。**MVP 到達点は Phase 1 の Public Alpha 完了時点**とします。

検証する中核価値は、AI への依頼内容と Chat、Issue、PR、成果物を一本の Trail として残し、次の作業で再利用できることです。

## 全体像

| Phase   | 名称                            | 目的                                                                          |
| ------- | ------------------------------- | ----------------------------------------------------------------------------- |
| Phase 0 | Foundation                      | Public Alpha を支える技術・品質・配信基盤を維持する                           |
| Phase 1 | Validation Release              | 最小の Prompt → Run → Link → Trail → Reuse 体験を Public Alpha として公開する |
| Phase 2 | User Validation                 | 実利用を観察し、次の投資先を決める                                            |
| Phase 3 | Evidence-driven Expansion       | 利用証拠に基づき、必要な機能を選択的に強化する                                |
| Phase 4 | Integration                     | GitHub をはじめとする外部サービスとの接続を深める                             |
| Phase 5 | Productization & Administration | 認証、契約、権限、同期、運用管理を備えたプロダクトへ拡張する                  |

```text
Phase 0  Foundation
Phase 1  Validation Release → Public Alpha / MVP
Phase 2  User Validation
Phase 3  Evidence-driven Expansion
Phase 4  Integration
Phase 5  Productization & Administration
```

Phase 番号は整数のみを使用します。

---

## Phase 0: Foundation

### 位置づけ

P0-1〜P0-5 で整備した pnpm Workspace、React、TypeScript、Vite、品質基盤、ドメインモデル、Dexie / IndexedDB、Repository 境界、Router / AppShell、Dashboard、Hosted Preview を Public Alpha に十分な Foundation として維持します。Foundation への追加投資は、Public Alpha を阻害する問題に限定します。

### 残作業

P0-6 は長期運用文書を完成させることではなく、次の Public Alpha に必要な最小範囲へ絞ります。

- 現行アーキテクチャと Local-first / IndexedDB 保存境界の概要。
- Public Preview の利用方法と既知の制約。
- 公開データへ秘密情報・機密情報を含めないルール。
- Public Alpha 向け最小リリースチェック。

---

## Phase 1: Validation Release

### 目的

PromptTrail の中核価値を体験できる縦切りを実装し、Public Alpha として公開します。

### 必須スコープ

```text
Project を選ぶ（または既定 Project を使う）
  ↓
Prompt を入力・保存する
  ↓
Prompt から Run を作成する
  ↓
Chat / Issue / PR / Commit / Document の URL を登録する
  ↓
Trail として確認する
  ↓
過去の Prompt または Run を再利用する
```

- Project の最小選択または既定 Project。
- Prompt の入力、保存、表示、コピー。
- Prompt からの Run 作成と、実行時 Prompt のスナップショット保存。
- Chat、Issue、PR、Commit、Document などの URL 手動登録。
- Link 種別と役割の最小管理、Run 内 Trail 表示。
- Prompt のコピー、または Run 複製による再利用。
- サンプル Trail または初回利用ガイド、Feedback 導線。
- Hosted 環境で利用できる Public Alpha。

### MVP 完了条件

- 新規利用者が最初の Run を作成できる。
- Prompt と一つ以上の Link を Run へ登録できる。
- AI 依頼から成果物までを Trail として確認できる。
- 過去 Prompt または Run を次の作業へ再利用できる。
- 公開 URL から主要操作を試せ、Feedback を送れる。
- Local-first / IndexedDB の保存制約を利用者へ明示している。

---

## Phase 2: User Validation

### 目的

Public Alpha の実利用から中核仮説の妥当性と、次に投資する機能を判断します。

### 主な活動

- 初期利用者へ Public Alpha を案内し、実際の AI 依頼と成果物を登録してもらう。
- 初回 Run / Trail 作成、継続利用、再利用、離脱理由を観察する。
- 定性フィードバックと最小限の利用指標を整理する。
- 得られた証拠から Phase 3 の優先機能を決定する。

### 判断する仮説・指標

- 短い説明だけで最初の Trail を作れるか。
- 2 件目の Run を登録するか、過去 Prompt または Run を再利用するか。
- Markdown、メモ、ブラウザブックマークより便利と感じるか。
- Link 登録が負担や混乱になっていないか。
- Library、Recipe、検索、GitHub 同期のうち、どれが最も必要とされるか。

---

## Phase 3: Evidence-driven Expansion

### 目的と方針

Phase 2 で確認された利用課題と需要に基づき、機能を選択的に強化します。候補を一括実装せず、利用証拠が弱い機能は延期し、小さな Release / Learn 単位へ分割します。

### 候補スコープ

- Project Workspace、Prompt / Context Library。
- Recipe Builder、変数検出、入力フォーム。
- タグ、検索、絞り込み、Prompt 版管理。
- JSON Export / Import / Backup / Restore、Settings 最小骨格。
- Run 評価、改善メモ、再実行支援、Trail 表示強化。

---

## Phase 4: Integration

GitHub Integration を中心に、外部サービスとの接続を深めます。

- GitHub API による Issue、PR、Commit 情報取得。
- Link の状態更新、URL からのメタデータ補完、同期。
- Issue 本文生成支援と外部サービス Integration 設定。

---

## Phase 5: Productization & Administration

長期的な製品化と運用管理を進めます。

- Persona / Experience と Progressive Disclosure。
- Identity / Authentication、Authorization Role。
- Plan / Entitlement、Admin Console、User management。
- Cloud Database、Cloud Sync、Cross-device synchronization、Operational settings。

Persona / Experience、Plan / Entitlement、Authorization Role は異なる責務として扱います。

---

## Public Alpha で後回しにする機能

Phase 1 の必須条件にしない機能は次のとおりです。既存のモデルと Repository 境界は、Phase 1 を阻害しない範囲で維持します。

- Context Library の完成、Prompt 更新履歴・過去版復元、高度なタグ・検索・絞り込み。
- JSON Backup / Restore、Settings 画面の完成。
- Recipe の変数自動検出・入力フォーム生成、複数 Recipe の高度な管理。
- GitHub API 連携、Link 情報の自動同期。
- Login / Account、Plan / Entitlement、Admin Console。
- Cloud Sync、Cross-device synchronization。

## Public Alpha のデータ・配信制約

PromptTrail は Local-first / IndexedDB を採用しています。localhost、GitHub Pages、Azure Static Web Apps は origin が異なるためデータを共有しません。また、PC とスマートフォンの間でも同期せず、browser の変更や storage の削除によってデータを失う可能性があります。Public Alpha は Cloud Sync 環境ではないことを、案内と UI で明確にします。

## 後続 Issue 設計への引き継ぎ

後続の Phase 1 Lv1 / Lv2 Issue は、このロードマップを正本として次の単位を検討します。

- Public Alpha の最小 UX・画面構成。
- Prompt 入力・保存・コピー。
- Run 作成・Prompt Snapshot。
- Link 登録・Trail 表示。
- Run 複製・再利用。
- サンプル Trail・オンボーディング、Feedback 導線、統合受入・公開。
