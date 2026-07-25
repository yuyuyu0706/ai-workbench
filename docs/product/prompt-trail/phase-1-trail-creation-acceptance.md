# Phase 1: First Trail Creation Acceptance

この文書は Issue #161 で実施した、最初の Trail 作成導線に対するローカル統合受入の記録です。機能仕様は [Roadmap](roadmap.md) と Issue #153 を正本とし、本書では確認した範囲と後続への引き継ぎだけを記録します。

## 受入対象

- 空の Dashboard から New Trail を開き、Prompt 本文から Direct Run と Prompt Snapshot を作成する。
- Prompt の最初の非空行から生成されたタイトルと本文を Run Detail で確認する。
- HTTP(S) Link の URL、種別、役割を登録し、Prompt Snapshot と同じ Trail で確認する。
- Run Detail の reload 後、および Dashboard の最近の Run からの再遷移後に、同じ Run の Snapshot と Link が維持されることを確認する。
- 空白だけの Prompt、不正な Link URL、存在しない Run から入力を失わず復帰できることを確認する。
- 既存の Playwright `chromium-desktop` / `chromium-mobile` project で同一 spec を実行し、Dashboard、New Trail、Run Detail、not-found に横方向の overflow がないことを確認する。

## 受入結果

| 項目                   | 結果           | 自動化された証拠                                                                      |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------- |
| Golden Path            | PASS           | `trail-creation-golden-path.spec.ts` の作成・Link 登録・reload・Dashboard 再遷移      |
| IndexedDB 永続化       | PASS           | 同一 Run Detail URL の reload と Dashboard からの再遷移後の Snapshot / Link assertion |
| 代表 validation / 復帰 | PASS           | 空白 Prompt、不正 protocol、URL 修正後の保存、missing Run、Dashboard 復帰             |
| Desktop / Mobile       | PASS           | 既存 2 project で同一 2 tests を実行（4 tests passed）                                |
| Responsive             | PASS           | Golden Path の各主要画面と not-found で horizontal overflow helper を実行             |
| Production 修正        | NOT APPLICABLE | 受入を阻害する再現可能な Production 不具合は確認されず、E2E と記録だけを追加          |

実施日: 2026-07-25 UTC。ローカル Chromium と origin ごとの IndexedDB を使用し、外部 API や hosted preview には依存していません。

## 対象外と引き継ぎ

- Hosted Preview / Public Alpha の公開 URL 上の受入は、本 Issue の対象外とする。
- Prompt の再利用、Link の編集・削除、Project 選択、Trail の高度な表示は追加していない。
- 主観的な文言・配置変更や追加機能は本受入へ混在させず、P1-1-3 の自己利用と初回磨き込みへ引き継ぐ。
- P1-1-3 は本 spec を回帰基準として 2〜3 本の Trail を実利用し、発見事項を blocking defect、軽微な磨き込み、後続機能に分類する。
