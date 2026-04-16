# 1. はじめに (Getting Started)

この章で学ぶこと:

- sayo-ts が何で、何で**ない**のか
- 新規プロジェクトの作り方 (`create-sayo-app`)
- 開発サーバーの起動、テスト、ビルド
- 生成されたプロジェクトのディレクトリ構成

前提章: なし (この章が最初です)

---

## sayo-ts とは

sayo-ts は **Effect v4 `HttpApi` のための薄い規約レイヤー** です。

含むもの:

- `@sayo-ts/eslint-plugin` — 規約を ESLint ルールで強制
- `@sayo-ts/cli` (`sayo`) — リソースモジュールのスキャフォールディング
- `create-sayo-app` — プロジェクトテンプレ生成ツール
- `templates/default` — フル型安全な Layer 合成のサンプルアプリ

含まないもの:

- `HttpApi` のラッパーやフォーク
- 独自のルーティングエンジン
- ORM・マイグレーションツール
- フロントエンドフレームワーク

Rails や NestJS と違い、sayo-ts は「Effect v4 を使う上での推奨ディレクトリ構成と命名規約を押し付けるだけ」です。ランタイムはすべて `effect` と `@effect/platform-node` です。

## 人と AI のための共通基盤

sayo-ts を貫く設計の軸は、「**誰が書いたコードでも同じ基準で検査できる**」ことです。

- Effect の型は「依存漏れ・エラー宣言漏れ・未実装エンドポイント」をビルド時に拒否する
- `@sayo-ts/eslint-plugin` は「レビューで繰り返し指摘される規約違反」を機械的に弾く
- `Schema` は「型・実行時検証・OpenAPI・クライアント型」を 1 箇所で確定させる
- `sayo generate` は「毎回同じファイル構成」を出力する

これらの仕組みは、**人間の"うっかり"にも AI コーディング補助の"幻覚"にも等しく効きます**。実装者を問わず、`pnpm tsc --noEmit && pnpm lint && pnpm test` が通るかどうかで最低限の正しさが担保される設計です。詳細は [人と AI のためのフレームワーク](./for-humans-and-ai.md) を参照してください。

## 前提ツール

| ツール | バージョン |
| --- | --- |
| Node.js | 18 以上 |
| TypeScript | 5.9 以上 |
| pnpm | 10 系 |
| Effect | 4.x (beta) |

## プロジェクトを作る

```bash
npx create-sayo-app my-project
cd my-project
pnpm dev       # 開発サーバー (http://localhost:3000)
pnpm test      # Vitest 実行
pnpm build     # tsc でビルド
```

`create-sayo-app` は次を自動で行います:

1. `templates/default` を `./my-project` にコピー
2. `package.json` の `name` を `my-project` に書き換え、`workspace:*` を実バージョンに置換
3. `pnpm install` を実行

起動後、`http://localhost:3000/docs` にアクセスすると Scalar による OpenAPI ドキュメントが表示されます。

## ディレクトリ構成

```
my-project/
├── src/
│   ├── main.ts                  # サーバ起動 + Layer 合成
│   ├── api.ts                   # トップレベル HttpApi
│   └── users/                   # リソースモジュール (リソースごとに 1 ディレクトリ)
│       ├── errors.ts            # Schema.TaggedErrorClass
│       ├── schemas.ts           # リクエスト / レスポンス Schema
│       ├── service.ts           # Context.Service (ポート)
│       ├── service.live.ts      # Layer 実装 (アダプタ)
│       ├── api.ts               # HttpApiGroup + HttpApiEndpoint
│       └── handlers.ts          # HttpApiBuilder.group のハンドラ
├── test/
│   └── users/
│       ├── handlers.test.ts     # HttpApiClient を使った統合テスト
│       └── service.mock.ts      # テスト用 Layer
├── eslint.config.ts             # @sayo-ts/eslint-plugin
├── tsconfig.json
└── package.json
```

この構成には次のような意味があります:

- **リソースごとに 1 ディレクトリ**: `users/` / `posts/` のようにドメイン単位で区切ります。Rails の `app/controllers/users_controller.rb` ほか複数を束ねたイメージです。
- **`service.ts` / `service.live.ts` の分離**: `service.ts` が **ポート (インターフェース)**、`service.live.ts` が **アダプタ (本番実装)**。テスト時は `service.mock.ts` を `Layer.provide` するだけで差し替え可能です。詳細は [03. Layer システムと DI](./03-layer-and-di.md) を参照。
- **`api.ts` / `handlers.ts` の分離**: `api.ts` が HTTP 契約 (エンドポイント定義)、`handlers.ts` がその実装。クライアントと共有したくなったら `api.ts` だけを別パッケージに切り出せます。

## 他フレームワークとの対応

| やりたいこと | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| 新規プロジェクト生成 | `rails new app` | `nest new app` | `npx create-sayo-app app` |
| リソース生成 | `rails g resource user` | `nest g resource user` | `npx sayo generate user` |
| 開発サーバ | `rails s` | `nest start --watch` | `pnpm dev` |
| テスト | `rspec` / `minitest` | `jest` | `pnpm test` (Vitest) |
| API ドキュメント | (gem 任せ) | `@nestjs/swagger` | `HttpApiScalar` (ビルトイン) |

## 次に読む

Effect 特有の記法に不慣れな場合は、まず [02. Effect の基礎](./02-effect-essentials.md) を読むのをおすすめします。

Effect を触ったことがある場合は、すぐに [03. Layer システムと DI](./03-layer-and-di.md) へ進んでも構いません。
