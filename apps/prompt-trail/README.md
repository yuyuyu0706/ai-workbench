# PromptTrail

PromptTrail は、AI を活用した作業の Trail を追跡するローカルファーストなアプリケーションです。**Project / Prompt / Context / Recipe / Run / Link** の 6 モデルを扱い、Chat、Issue、PR、Commit、Document などの成果物を紐付けます。

## 現在のアプリケーション構成

- `/` は Public Alpha Guideを表示し、DashboardとFeedbackへの入口を提供します。
- 現行のGlobal Navigationは「はじめに」「Dashboard」「Prompt Library」です。トップページとDashboardのどちらからもPrompt Libraryへ移動でき、一覧・新規登録・編集では「Prompt Library」を現在地として表示します。Context LibraryとRecipe Builderは未完成のためdirect accessのみ維持します。
- `/runs/:runId` は Run Detail、未知の URL は Not Found と Dashboard への回復導線を提供します。
- ブラウザの IndexedDB を使うため、新しい browser / origin では Dashboard が empty state になる場合があります。これはローカル起動失敗を意味しません。
- IndexedDBの現行schemaはversion 2です。既存のschema v1 DBはopen時にtransactional migrationされ、全Runへ従来のPrompt Snapshotタイトルと同じ`trailTitle`および`trailKind = other`が補完されます。migrationは他fieldや他Storeを変更せず、失敗時にDBを削除しません。

Phase 1のPublic Alpha公開は完了しています。Phase 2ではRunのTrail名・Trail種別基盤とNew Trailの入力UIを実装済みです。過去Run再利用時は新しいPrompt資産を派生させますが、Prompt Library起点では同じPrompt資産を複製せず、現在内容を不変のRun Snapshotとして反復利用します。Prompt編集前に作成したSnapshotへ後の編集・削除は伝播しません。Prompt Editorは種別・タイトル（横並び、480px以下は縦並び）・Prompt本文の順で入力し、HeaderとForm下部から同じformを保存できます。Prompt本文textareaは最大64remまで横幅を確保し、種別・タイトル欄は最大44remに収めます。Prompt本文ラベル右のコピーボタンでtextarea入力中の値をクリップボードへコピーできます。本文に`${varName}`形式の変数プレースホルダーが含まれる場合はラベル行に変数バッジを表示し、コピーボタンクリックで変数入力パネルを開いて値を入力後にコピーできます。未入力の変数は`${varName}`のままコピーされます。パネルはEscキーまたは外部クリックで閉じます。保存Actionは保存中および削除フロー中に同期して無効化されます。Prompt Libraryは主要Navigationから到達でき、ProjectとキーワードのAND条件、全件数・表示件数、6列のcompactなSemantic tableを備えています。表示結果は更新日時降順を既定とし、Prompt名昇順、Prompt名降順、更新日時降順の3状態をPage内で切り替えます。本文PopoverのHeaderに本文inline編集、Prompt全体編集Link、copy、icon closeを集約し、本文保存は本文限定atomic更新とData Revision再読込で一覧へ反映します。未保存draft中はFilter/Search/Sortを無効化し、別Promptや各Linkは破棄確認を経由します。stale時はdraftを保持して最新本文を読み込んでから再保存し、not-found/unavailable時は保存を止めてclose後に一覧を再読込します。Trail作成はTooltipとPrompt名を含むAccessible Nameを備えたPrimary icon Linkとします。狭幅では一覧領域だけを横scrollできます。これらはDomain、Repository、DB契約を変更せず、sort stateも永続化しません。過去Trailへの到達性を含む詳細は[Roadmap](../../docs/product/prompt-trail/roadmap.md)を参照してください。

## 最短起動

依存取得とコマンドは、アプリ配下ではなくリポジトリルートで実行します。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

PromptTrail 単体を明示する場合は次を使います。

```bash
pnpm --filter prompt-trail dev
```

通常は `http://localhost:5173/` を開き、ポート競合時は Vite の `Local:` URL を使用します。

## 主なコマンド

```bash
# Workspace 全体
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build

# PromptTrail 単体
pnpm --filter prompt-trail lint
pnpm --filter prompt-trail test
pnpm --filter prompt-trail test:watch
pnpm --filter prompt-trail test:e2e:install
pnpm --filter prompt-trail test:e2e
pnpm --filter prompt-trail build
pnpm --filter prompt-trail preview
```

`test:watch` はローカル開発専用で、CI では使用しません。Playwright Chromium はローカル初回、browser cache 削除後、Playwright 更新後に `test:e2e:install` で導入します。

## Documentation

- [PromptTrail Phase 0 Technical Baseline](../../docs/architecture/prompt-trail/README.md)
- [Application Architecture](../../docs/product/prompt-trail/application-architecture.md)
- [PromptTrail Data Model](../../docs/architecture/prompt-trail/data-model.md)
- [ローカル開発の正本](../../docs/development/local-development.md)
- [品質ゲートと開発運用](../../docs/development/quality-gates.md)
- [環境・起動・品質ゲートのトラブルシューティング](../../docs/development/troubleshooting.md)
- [Deployment and Hosted Preview](../../docs/product/prompt-trail/deployment-and-preview.md)
- [PromptTrail Overview](../../docs/product/prompt-trail/overview.md)
- [Functional Requirements](../../docs/product/prompt-trail/functional-requirements.md)
- [Roadmap](../../docs/product/prompt-trail/roadmap.md)

### Run Detail の Trail 情報編集

Run Detail では Trail 名と Trail 種別をインライン編集できます。保存は `expectedUpdatedAt` を用いた条件付き更新で、競合時は入力を保持したまま最新内容の明示的な再読み込みを求めます。Prompt Snapshot、Run Status、Link は変更しません。Prompt LibraryのActive Promptからはread-onlyの本文を確認して新しいTrailを作成できます。Dashboard での Trail metadata 表示は P2-3の対象です。
