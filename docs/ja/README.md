# sayo-ts ドキュメント (日本語)

sayo-ts は **Effect v4 の `HttpApi` 上に規約を載せた** オピニオネイテッドなバックエンドフレームワークです。Rails が Ruby に規約をもたらし、NestJS が Node.js に構造を与えたのと同じ立ち位置で、sayo-ts は Effect v4 に **ディレクトリ規約・スキャフォールディング・ESLint ルール** を提供します。

## 設計の軸 — 人と AI のための共通基盤

sayo-ts が重視しているのは、「**誰が書いたコードでも同じ基準で検査できる**」ことです。人間だけで書く時代から、AI コーディング補助と協業する時代へと移り変わる中で、フレームワークに求められる役割は変化しました:

- **暗黙の規約を捨てる** — 「チームは知っているがコードには書かれていない」ルールを、Effect の型と `@sayo-ts/eslint-plugin` のルールとして **機械可読に明文化**
- **整合性の発生源を 1 箇所に集める** — `Schema` 1 つから型・実行時バリデータ・OpenAPI・クライアント型が決まるため、人も AI も食い違いを起こしようがない
- **決定的な雛形を提供する** — `sayo generate` で毎回同じファイル構成・命名を強制し、記憶や推測に頼らず作業できる

詳細は [人と AI のためのフレームワーク](./for-humans-and-ai.md) を参照してください。

## 目次

1. [はじめに (Getting Started)](./01-getting-started.md) — インストール / 起動 / ディレクトリ構成
2. [Effect の基礎](./02-effect-essentials.md) — `Effect.gen`, `yield*`, `Schema`, `TaggedError`
3. [Layer システムと DI](./03-layer-and-di.md) — `Context.Service` と `Layer` による依存性注入
4. [エンドポイントとハンドラ](./04-endpoints.md) — `HttpApi` / `HttpApiGroup` / `HttpApiEndpoint`
5. [ミドルウェア](./05-middleware.md) — 認証 / ロギング / エラー変換 / CORS
6. [エラーハンドリング](./06-error-handling.md) — `TaggedError` と HTTP ステータスマッピング
7. [バリデーションとスキーマ](./07-validation.md) — `Schema` による実行時検証
8. [テスト](./08-testing.md) — `HttpApiClient` と `layerTest`
9. [CLI とスキャフォールディング](./09-cli-and-scaffolding.md) — `create-sayo-app` / `sayo generate`
10. [規約と Lint ルール](./10-conventions.md) — `@sayo-ts/eslint-plugin`

付録: [人と AI のためのフレームワーク](./for-humans-and-ai.md) — 上記すべてを貫く視点

## 他フレームワーク経験者向けのマップ

| sayo-ts / Effect v4 | Rails | NestJS |
| --- | --- | --- |
| `Context.Service` + `Layer` | 依存ライブラリ / Service オブジェクト | `@Injectable()` Provider |
| `HttpApi` / `HttpApiGroup` | `config/routes.rb` + Controller | `@Module` + `@Controller` |
| `HttpApiEndpoint.get/post/...` | `get "/users/:id"` + action | `@Get(':id')` |
| `HttpApiMiddleware` | Rack middleware / `before_action` | `Middleware` / `Guard` / `Interceptor` / `Filter` |
| `Schema.TaggedErrorClass` + `HttpApiSchema.status` | `rescue_from` + `render` | `HttpException` + `ExceptionFilter` |
| `Schema.Struct` / `Schema.Class` | `strong_parameters` | `class-validator` + `ValidationPipe` |
| `sayo generate <name>` | `rails generate resource` | `nest g resource` |
| `Layer.provide(Mock)` in test | fixtures + test doubles | `Test.createTestingModule().overrideProvider()` |

## このドキュメントの前提

- Node.js 18 以上
- TypeScript 5.9 以上
- pnpm 10 系
- Effect 4.x (beta)

Effect 自体の詳細は [effect.website](https://effect.website) の公式ドキュメントも参照してください。
