# 5. ミドルウェア

この章で学ぶこと:

- `HttpApiMiddleware.Service` でミドルウェアを宣言する方法
- グループ / エンドポイントにミドルウェアを適用する方法
- 4 パターンの実践例: 認証 (Bearer) / ロギング / `SchemaError` 変換 / CORS・共通ヘッダ
- NestJS の Guard / Interceptor / Filter との対応

前提章: [04. エンドポイントとハンドラ](./04-endpoints.md)、[03. Layer システムと DI](./03-layer-and-di.md)

---

## ミドルウェアの位置づけ

sayo-ts (Effect v4 `HttpApi`) のミドルウェアは **2 レイヤ** に分かれます。

| レイヤ | 例 | 実装場所 |
| --- | --- | --- |
| HTTP レイヤ (ルータ共通) | CORS、共通レスポンスヘッダ、リクエストログ | `HttpMiddleware.*` を `HttpRouter.serve` に渡す |
| HttpApi レイヤ (エンドポイント単位) | 認証、認可、`SchemaError` 変換、個別計測 | `HttpApiMiddleware.Service` を `HttpApiGroup.middleware()` で適用 |

NestJS との対応は概ね次の通り。

| NestJS | sayo-ts |
| --- | --- |
| `Middleware` (Express レイヤ) | `HttpMiddleware.*` |
| `Guard` (認可) | `HttpApiMiddleware.Service` (Security 付き) |
| `Interceptor` (計測・ラップ) | `HttpApiMiddleware.Service` (Security 無し) |
| `ExceptionFilter` | `HttpApiMiddleware.layerSchemaErrorTransform` / エラーチャネルの扱い |

## `HttpApiMiddleware.Service` の基本形

```ts
import { Effect, Layer } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

// 1) ミドルウェアのタグ宣言 (provide する型 & エラー型)
export class RequestLogger extends HttpApiMiddleware.Service<RequestLogger>()(
  "RequestLogger",
) {}

// 2) 実装 Layer
export const RequestLoggerLive = Layer.succeed(
  RequestLogger,
  // (httpEffect, { endpoint, group }) => Effect<HttpServerResponse, ...>
  (httpEffect, { endpoint, group }) =>
    Effect.gen(function* () {
      const start = Date.now()
      yield* Effect.log(`→ ${group.identifier}.${endpoint.name}`)
      const response = yield* httpEffect
      yield* Effect.log(`← ${group.identifier}.${endpoint.name} (${Date.now() - start}ms)`)
      return response
    }),
)
```

ポイント:

- `HttpApiMiddleware.Service<Self>()("Id", options?)` で **DI タグ兼コンフィグ** を作る
- `options?.error` / `options?.security` / `options?.requiredForClient` を指定できる
- 実装は `(httpEffect, { endpoint, group }) => Effect<HttpServerResponse, ...>` という関数
- `yield* httpEffect` で「本来のハンドラ実行」を呼び出す。前後に処理を足せる

## 適用する

グループ単位で適用:

```ts
export const UsersGroup = HttpApiGroup.make("Users")
  .add(getUser)
  .add(createUser)
  .middleware(RequestLogger)   // ← このグループの全エンドポイントに適用
```

API 全体に適用:

```ts
export const AppApi = HttpApi
  .make("AppApi")
  .add(UsersGroup)
  .middleware(RequestLogger)   // ← 全グループに適用
```

> 注意: `middleware()` は **それより前に `add` したエンドポイントにだけ** 効きます。適用順に注意してください。

実装 Layer は通常通り `main.ts` で `Layer.provide` します。

```ts
const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(RequestLoggerLive),  // ← 追加
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

---

## サンプル 1: 認証ミドルウェア (Bearer トークン)

NestJS の Guard に相当するパターンです。

### 1) 認証失敗エラー

```ts
// src/auth/errors.ts
import { Schema } from "effect"

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  { reason: Schema.String },
) {}
```

### 2) `CurrentUser` (認証済みユーザ情報)

```ts
// src/auth/current-user.ts
import { Context } from "effect"

export class CurrentUser extends Context.Service<
  CurrentUser,
  { readonly id: string; readonly email: string }
>()("CurrentUser") {}
```

### 3) ミドルウェアのタグ

```ts
// src/auth/middleware.ts
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi"
import { Unauthorized } from "./errors.js"

export class Authentication extends HttpApiMiddleware.Service<Authentication>()(
  "Authentication",
  {
    // トークン検証に失敗したらこのエラーで返す
    error: Unauthorized,
    // OpenAPI に "Bearer スキーム" を生やす
    security: { bearer: HttpApiSecurity.bearer },
    // 追加で CurrentUser を提供するミドルウェアであることを型に載せる
    provides: CurrentUser,
  } as const,
) {}
```

> 実装する際、`Authentication` は `CurrentUser` を **`provides`** する (後続ハンドラに渡す) ことを型システムに伝える必要があります。`HttpApiMiddleware.Service` のジェネリクスは内部で `provides` / `requires` / `error` / `security` を追跡します。

### 4) 実装 Layer

```ts
// src/auth/middleware.live.ts
import { Effect, Layer } from "effect"
import { Authentication } from "./middleware.js"
import { CurrentUser } from "./current-user.js"
import { Unauthorized } from "./errors.js"

export const AuthenticationLive = Layer.succeed(
  Authentication,
  {
    bearer: (httpEffect, { credential }) =>
      Effect.gen(function* () {
        // credential は HttpApiSecurity.bearer.Type (= トークン文字列)
        const user = yield* verifyToken(credential).pipe(
          Effect.mapError(() => new Unauthorized({ reason: "invalid token" })),
        )
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentUser, user),
        )
      }),
  },
)

const verifyToken = (token: string) =>
  Effect.tryPromise({
    try: () => jwtVerify(token),
    catch: () => new Unauthorized({ reason: "jwt verify failed" }),
  })
```

`Effect.provideService(CurrentUser, user)` で **`httpEffect` (= 後続のハンドラ) に `CurrentUser` を注入** しています。

### 5) 適用

```ts
export const UsersGroup = HttpApiGroup.make("Users")
  .add(me)
  .add(getUser)
  .middleware(Authentication)
```

### 6) ハンドラから使う

```ts
h.handle("me", () =>
  Effect.gen(function* () {
    const me = yield* CurrentUser   // ← 認証済みユーザが取れる
    return new UserResponse({ id: me.id, name: "", email: me.email })
  }),
)
```

クライアント側はクライアント生成時に `bearerToken: "..."` を渡せば自動でヘッダが付きます。

---

## サンプル 2: ロギング / リクエスト計測

NestJS の Interceptor に相当します。

```ts
// src/infra/logging.ts
import { Effect, Layer } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

export class RequestTiming extends HttpApiMiddleware.Service<RequestTiming>()(
  "RequestTiming",
) {}

export const RequestTimingLive = Layer.succeed(
  RequestTiming,
  (httpEffect, { endpoint, group }) =>
    Effect.gen(function* () {
      const label = `${group.identifier}.${endpoint.name}`
      return yield* httpEffect.pipe(
        Effect.withLogSpan(label),
        Effect.tapErrorCause((cause) => Effect.logError(`[${label}] failed`, cause)),
        Effect.onExit((exit) =>
          Effect.log(
            `[${label}] exit=${exit._tag}`,
          ),
        ),
      )
    }),
)
```

使い回しのきく汎用ミドルウェアとして API 全体に適用するとよいでしょう。

```ts
export const AppApi = HttpApi.make("AppApi")
  .add(UsersGroup)
  .middleware(RequestTiming)
```

---

## サンプル 3: `SchemaError` → ドメインエラー変換

NestJS の Exception Filter / Rails の `rescue_from` 相当です。バリデーション失敗 (`Schema.SchemaError`) を、アプリ独自のエラー表現に整形するのに便利です。

Effect は `HttpApiMiddleware.layerSchemaErrorTransform` というヘルパを提供します。

```ts
// src/infra/error-handling.ts
import { Effect, Schema } from "effect"
import { HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi"

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    issues: Schema.Array(Schema.String),
  },
) {}

export class ErrorHandler extends HttpApiMiddleware.Service<ErrorHandler>()(
  "ErrorHandler",
  { error: ValidationError.pipe(HttpApiSchema.status(400)) },
) {}

export const ErrorHandlerLive = HttpApiMiddleware.layerSchemaErrorTransform(
  ErrorHandler,
  (schemaError) =>
    Effect.fail(
      new ValidationError({
        message: "Request validation failed",
        issues: schemaError.issues.map((i) => i.message),
      }),
    ),
)
```

`layerSchemaErrorTransform` は「**`SchemaError` が発生したらこの関数を呼んでエラーを変換する Layer**」を作ります。適用方法は通常のミドルウェアと同じで、`HttpApi.middleware(ErrorHandler)` とするだけです。

---

## サンプル 4: CORS / 共通ヘッダ (HTTP レイヤ)

`HttpApiMiddleware` はエンドポイント単位でしたが、**全リクエストに共通の Express 的ミドルウェア** は `HttpMiddleware` を使います。

```ts
import { Effect, Layer } from "effect"
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/unstable/http"

// 1) CORS
const CorsLive = HttpMiddleware.cors({
  allowedOrigins: ["https://example.com"],
  allowedMethods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
})

// 2) 共通レスポンスヘッダ (X-Request-Id) を付与する自前ミドルウェア
const RequestIdLive = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const requestId = crypto.randomUUID()
    const response = yield* app
    return HttpServerResponse.setHeader(response, "x-request-id", requestId)
  }),
)

const ServedWithCommonMiddleware = HttpRouter.serve(
  Layer.mergeAll(ApiLive, HttpApiScalar.layer(AppApi, { path: "/docs" })),
  HttpMiddleware.make((app) => app),   // 適用順を明示したいときのプレースホルダ
).pipe(
  Layer.provide(CorsLive),
  Layer.provide(RequestIdLive),
)
```

> `HttpMiddleware` と `HttpApiMiddleware` は **別物** です。前者はルータレベル (全ルート共通)、後者はエンドポイント単位で、提供できる機能 (DI 追加・エラー宣言・Security 統合) が異なります。

---

## 適用順と粒度の選び方

- **全体に掛けたい + リクエスト単位の情報 (IP, Method など) で済む** → `HttpMiddleware`
- **エンドポイント単位で掛けたい / ハンドラに追加サービスを提供したい / エラー型を宣言したい** → `HttpApiMiddleware`

認証など「ハンドラから `CurrentUser` を `yield*` したい」タイプは必然的に `HttpApiMiddleware` になります。

## この章のまとめ

- ミドルウェアには **ルータレベル (`HttpMiddleware`)** と **API レベル (`HttpApiMiddleware`)** の 2 種類がある
- `HttpApiMiddleware.Service<Self>()("Id", options)` でタグを作り、`Layer.succeed(Tag, fn)` で実装
- `HttpApiGroup.middleware(Tag)` / `HttpApi.middleware(Tag)` で適用
- 認証は `options.security` + `provides` で `CurrentUser` をハンドラに注入
- `SchemaError` 変換は `HttpApiMiddleware.layerSchemaErrorTransform` ヘルパで書ける
- CORS / 共通ヘッダは `HttpMiddleware.cors` / `HttpMiddleware.make` を `HttpRouter.serve` に流し込む

### Rails / NestJS ではどう呼ぶか

- NestJS: Middleware (HTTP レベル) / Guard (認可) / Interceptor (計測) / ExceptionFilter (エラー整形)
- Rails: Rack middleware / `before_action` / `around_action` / `rescue_from`

次は [06. エラーハンドリング](./06-error-handling.md) で、エラー設計を詳しく見ます。
