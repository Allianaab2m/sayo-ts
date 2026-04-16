# 4. エンドポイントとハンドラ

この章で学ぶこと:

- `HttpApi` / `HttpApiGroup` / `HttpApiEndpoint` の 3 層構造
- 各エンドポイントで宣言できる項目 (`params`, `payload`, `headers`, `success`, `error` ...)
- ハンドラを `HttpApiBuilder.group` で実装する方法
- ハンドラから DI サービスを引き出す書き方
- OpenAPI ドキュメントが自動生成される仕組み

前提章: [03. Layer システムと DI](./03-layer-and-di.md)

---

## 3 層構造

sayo-ts の HTTP 定義は **3 階層** に分かれています。

```
HttpApi ("AppApi")                 ← アプリ全体で 1 つ
 └── HttpApiGroup ("Users")        ← リソースごとに 1 つ (= NestJS @Controller)
      ├── HttpApiEndpoint "getUser" ← 個別の verb + path
      └── HttpApiEndpoint "createUser"
```

ファイル対応:

| レイヤ | 典型的な置き場所 |
| --- | --- |
| `HttpApi` | `src/api.ts` |
| `HttpApiGroup` + `HttpApiEndpoint` | `src/<resource>/api.ts` |
| ハンドラ実装 | `src/<resource>/handlers.ts` |

## リソース単位の `api.ts`

`templates/default/src/users/api.ts`:

```ts
import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi"
import { UserResponse, CreateUserRequest } from "./schemas.js"
import { UserNotFound, EmailAlreadyTaken } from "./errors.js"

const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
})

const createUser = HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,
  success: UserResponse,
  error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
})

export const UsersGroup = HttpApiGroup.make("Users")
  .add(getUser)
  .add(createUser)
```

### `HttpApiEndpoint` の引数

```
HttpApiEndpoint.<method>(name, path, spec)
```

- `method`: `get` / `post` / `put` / `patch` / `del` / `head` / `options`
- `name`: ハンドラ名およびクライアント生成時のメソッド名 (ここを `getUser` にすれば `client.Users.getUser` になる)
- `path`: `/users/:id` のように `:paramName` でパスパラメータ
- `spec`: エンドポイントの契約

`spec` のフィールド:

| フィールド | 型 | 用途 |
| --- | --- | --- |
| `params` | `{ [key]: Schema }` | パスパラメータの Schema |
| `urlParams` | `Schema.Struct` | クエリ文字列の Schema |
| `headers` | `Schema.Struct` | 入力ヘッダの Schema |
| `payload` | `Schema` | リクエストボディの Schema (POST/PUT/PATCH) |
| `success` | `Schema` | 成功レスポンスの Schema (**必須に近い**) |
| `error` | `Schema` / `Schema[]` | 失敗時のエラー Schema |

### エラーに HTTP ステータスを付与

```ts
error: UserNotFound.pipe(HttpApiSchema.status(404))
```

`HttpApiSchema.status(code)` を `pipe` することで、エラークラス自体は **HTTP を知らないドメインエラーのまま**、エンドポイント定義側で HTTP 表現を与えられます。

複数のエラーを配列で束ねることもできます。

```ts
error: [
  UserNotFound.pipe(HttpApiSchema.status(404)),
  EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
]
```

詳細は [06. エラーハンドリング](./06-error-handling.md) を参照。

## トップレベル `src/api.ts`

```ts
import { HttpApi } from "effect/unstable/httpapi"
import { UsersGroup } from "./users/api.js"

export const AppApi = HttpApi.make("AppApi").add(UsersGroup)
```

アプリ全体で 1 つの `HttpApi` に、リソースごとの `HttpApiGroup` を追加していきます。リソースを増やすときは:

```ts
import { PostsGroup } from "./posts/api.js"

export const AppApi = HttpApi
  .make("AppApi")
  .add(UsersGroup)
  .add(PostsGroup)
```

## ハンドラ実装: `HttpApiBuilder.group`

`templates/default/src/users/handlers.ts`:

```ts
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { AppApi } from "../api.js"
import { UserService } from "./service.js"

export const UsersHandlers = HttpApiBuilder.group(
  AppApi,
  "Users",
  (handlers) =>
    handlers
      .handle("getUser", (req) =>
        Effect.gen(function* () {
          const service = yield* UserService
          return yield* service.findById(req.params.id)
        }),
      )
      .handle("createUser", (req) =>
        Effect.gen(function* () {
          const service = yield* UserService
          return yield* service.register(req.payload)
        }),
      ),
)
```

読み解き:

- `HttpApiBuilder.group(AppApi, "Users", builder => ...)` で `AppApi` の `"Users"` グループに対するハンドラ Layer を作る
- `builder.handle(name, fn)` で個別エンドポイントを実装する
  - `name` は `api.ts` で宣言した名前と**一致している必要がある** (型チェックされる)
  - `fn` は `(req) => Effect.Effect<Success, Error, R>` を返す
- `req.params` / `req.payload` / `req.urlParams` / `req.headers` がそれぞれの Schema で検証済みの値として取れる
- `return yield*` で成功値を返し、失敗は `yield* new MyError(...)` でエラー側に流す

返す Effect の `R` 型パラメータは、その Effect が要求するサービスを表します。`UserService` を `yield*` しているので `R = UserService`。これが上位の `Layer.provide(UserServiceLive)` で埋められます ([03. Layer システムと DI](./03-layer-and-di.md) 参照)。

## ハンドラの中でやってよいこと / 駄目なこと

**やってよい**:

- `yield*` で DI サービスを取り出す
- `yield*` で別の Effect を呼び出す
- 成功値を `return`、失敗を `yield* new Error()` で返す
- `Effect.log(...)` でログを出す

**やってはいけない**:

- `Effect.runSync` / `Effect.runPromise` / `Effect.runFork` を呼ぶ (`sayo/no-run-sync-in-handler` で error)
- 生の `Promise` を作る (`sayo/no-raw-promise` で error)
- `try` / `catch` を書く (`sayo/no-try-catch` で error)

これらは Fiber ランタイム / エラー追跡 / キャンセル伝播を壊すため禁止されています。

## OpenAPI ドキュメント (Scalar)

`main.ts` に 1 行追加するだけで `/docs` に Scalar UI が生えます。

```ts
import { HttpApiScalar } from "effect/unstable/httpapi"

const Served = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive,
    HttpApiScalar.layer(AppApi, { path: "/docs" }),
  ),
)
```

- スキーマ定義 (`params`, `payload`, `success`, `error`) がそのまま OpenAPI に反映される
- エンドポイント名がオペレーション ID になる
- **`success` / `error` を書かないと OpenAPI に穴が開く** ため、`endpoint-response-schema-required` と `endpoint-error-schema-required` の 2 ルールが警告を出す

Swagger UI を使いたい場合は `HttpApiSwagger.layer(AppApi, { path: "/swagger" })` に差し替え可能です。

## クライアントを自動生成する

同じ `AppApi` から、型安全な HTTP クライアントを作れます。

```ts
import { HttpApiClient } from "effect/unstable/httpapi"
import { AppApi } from "./api.js"

const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(AppApi)
  const user = yield* client.Users.getUser({ params: { id: "1" } })
  console.log(user.name)
})
```

- `client.<GroupName>.<EndpointName>(input)` という命名
- 入力と出力の型はエンドポイント定義から **完全に導出される**
- フロントエンドを同一リポジトリに持てば、1 か所書けば型が両側で共有できる (テスト章でも活躍)

詳細なテスト利用は [08. テスト](./08-testing.md) を参照。

## Rails / NestJS との対応

| 概念 | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| ルート定義 | `config/routes.rb` | `@Controller('users') @Get(':id')` | `HttpApiEndpoint.get("getUser", "/users/:id", ...)` |
| コントローラ | `UsersController` | `UsersController` class | `HttpApiBuilder.group(AppApi, "Users", ...)` |
| 入力パース | strong_parameters | `ValidationPipe` + DTO | `Schema` (`params`, `payload` ...) |
| 出力 | `render json: user` | `return user` | `return userResponse` (Schema.Class) |
| API ドキュメント | gem (rswag 等) | `@nestjs/swagger` | `HttpApiScalar` (追加依存なし) |

## この章のまとめ

- `HttpApi` → `HttpApiGroup` → `HttpApiEndpoint` の 3 層
- `spec.params/payload/urlParams/headers/success/error` で契約を宣言
- `HttpApiSchema.status(code)` でエラー → HTTP ステータスをマッピング
- `HttpApiBuilder.group(AppApi, "Group", b => b.handle("name", fn))` で実装
- ハンドラは `Effect.gen` を返し、中から `yield*` で DI する
- OpenAPI ドキュメントは `HttpApiScalar.layer` で自動

### 関連 ESLint ルール

- `sayo/endpoint-response-schema-required` (warn): `success` の宣言漏れ
- `sayo/endpoint-error-schema-required` (warn): `error` の宣言漏れ
- `sayo/no-run-sync-in-handler` (error): ハンドラ内での `Effect.runXxx` 禁止

次は [05. ミドルウェア](./05-middleware.md) で横断的関心事の扱い方を学びます。
