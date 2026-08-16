# AI Execution Gateway：Azure Static Web Apps 手動設定手順

## 1. 目的と対象

この文書は、AI Execution Gateway（`POST /api/execute`）が実際に動作するために必要な、
Azure Static Web Appsリソース側の**手動設定**（Claude Codeでは代行できない、Azure Portal／CLI
での操作）の正本です。コード側の実装・デプロイ設定は各Issue（#289、#291等）を参照してください。

対象のリソース：`red-flower-0ff1f6100`（`.github/workflows/azure-static-web-apps-red-flower-0ff1f6100.yml`
が参照する既存のAzure Static Web Appsインスタンス）

## 2. 前提知識：2種類の秘密情報を混同しないこと

| 名称                                                   | 保管場所                                                   | 用途                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_RED_FLOWER_0FF1F6100` | GitHub Secrets（既存・設定済み）                           | GitHub ActionsがAzureへ**デプロイする**ためのトークン    |
| `ANTHROPIC_API_KEY`・`OPENAI_API_KEY`                  | Azure Static Web Apps Application Settings（本手順で設定） | Managed Functionが**実行時に**AI APIを呼び出すためのキー |

前者は既に設定済みで本手順の対象外です。後者を本手順で設定します。

## 3. 手順A：AI APIキーの登録（Application Settings）

**目的:** `execute.ts`が実行時に読み取るAI APIキーを、Azure側に安全に保管します。
クライアント（ブラウザ）からは一切アクセスできません。

**実行場所:** Azure Portal

1. 対象のStatic Web Appリソース（`red-flower-0ff1f6100`）を開く
2. 左メニューから「Environment variables」（または「Configuration」）を選択する
3. 以下のキーと値を追加する

   | 名前                | 値                                       |
   | ------------------- | ---------------------------------------- |
   | `ANTHROPIC_API_KEY` | Anthropic Consoleで発行した実際のAPIキー |
   | `OPENAI_API_KEY`    | OpenAI Platformで発行した実際のAPIキー   |

4. 保存する

**成功判定:** Environment variables一覧に上記2件が登録されている。値そのものはPortal上でも
マスク表示される。

**次の工程:** `owner`カスタムロールの招待（手順B）。

## 4. 手順B：`owner`カスタムロールの招待（アクセス制限）

**目的:** `/api/execute`を、y.k様ご自身のGitHubアカウントだけに制限します。
`authenticated`ロール（誰でもGitHubログインすれば付与される）では不十分なため、
招待制のカスタムロールを使います。

**実行場所:** Azure Portal

1. 対象のStatic Web Appリソースを開く
2. 左メニューから「Role Management」を選択する
3. 「Invite」をクリックする
4. 以下を入力する

   | 項目                    | 値                                                 |
   | ----------------------- | -------------------------------------------------- |
   | Domain                  | （空欄のままでよい。特定ドメイン制限をしない場合） |
   | Authentication provider | GitHub                                             |
   | Invitation expiration   | 任意（例：24時間、最大168時間）                    |
   | Role(s)                 | `owner`                                            |
   | Specify a specific user | y.k様ご自身のGitHubユーザー名                      |

5. 「Generate invitation link」をクリックし、発行されたリンクをコピーする
6. **y.k様ご自身が**、そのリンクをブラウザで開き、GitHubアカウントでログインして招待を受諾する

**成功判定:** 受諾後、y.kさんのGitHubアカウントに`owner`ロールが恒久的に紐づく
（招待リンク自体の期限が切れても、既に受諾済みのロール付与は継続する）。

**次の工程:** 実際の動作確認（5章）。

## 5. 動作確認

**目的:** 上記A・Bの設定が正しく機能していることを確認します。

**実行場所:** ブラウザ（Hosted環境：`https://red-flower-0ff1f6100.7.azurestaticapps.net/`）

1. ブラウザのシークレットウィンドウ（未ログイン状態）でHosted環境を開き、Developer Toolsパネルの
   簡易実行フォームから`/api/execute`を呼び出す
   - **成功判定：拒否される**（401、またはログイン画面へ誘導される）。もし応答が返って
     しまう場合、`staticwebapp.config.json`が正しくデプロイされていない可能性がある
2. y.k様ご自身のGitHubアカウントでログインした状態で、同様に呼び出す
   - **成功判定：AI APIの生成結果が返る**
3. （可能であれば）`owner`ロールを持たない別のGitHubアカウントでログインした状態で試す
   - **成功判定：拒否される**

**次の工程:** すべて成功判定を満たせば、本手順は完了です。

## 6. 今後の追加予定

- Lv3-5（GitHub Issue作成）着手時に、`GITHUB_PAT`（Fine-grained Personal Access Token）を
  同様に手順Aへ追加する
- Lv3-5以降に追加するエンドポイントも、手順Bと同じ`owner`ロールで保護する

## 7. 関連文書

- [Deployment and Hosted Preview](../product/prompt-trail/deployment-and-preview.md)：デプロイパイプライン全体の契約
- ADR 0006：External Execution Boundary
- ADR 0009：Gateway External Dependencies and Domain Representation
- Issue #291：本手順が必要になった経緯・設計判断の記録
