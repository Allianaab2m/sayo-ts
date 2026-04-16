# 7. バリデーションとスキーマ

この章で学ぶこと:

- `Schema.Struct` と `Schema.Class` の違い
- リクエスト / レスポンスの Schema の書き方
- 基本的な refinement (文字列長・数値範囲・正規表現・列挙)
- エンドポイント定義から型安全な HTTP クライアントが生える仕組み
- NestJS `ValidationPipe` / Rails `strong_parameters` との対応

前提章: [02. Effect の基礎](./02-effect-essentials.md)、[04. エンドポイントとハンドラ](./04-endpoints.md)

---

## Schema とは何か

Effect の `Schema` は「**宣言から TypeScript 型 と 実行時バリデータ の両方を生成する DSL**」です。以下を 1 つの記述で賄えます。

- TypeScript 型 (`typeof schema.Type` / クラス型)
- JSON → 値のデコード (検証付き)
- 値 → JSON のエンコード
- OpenAPI スキーマ (自動でエンドポイントに反映)

NestJS における `class-validator` + `class-transformer` + `class` + `interface` を **1 つの Schema で** 書けるイメージです。

## `Schema.Struct` vs `Schema.Class`

### `Schema.Struct` — 匿名な構造体

```ts
import { Schema } from "effect"

export const CreateUserRequest = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
})
export type CreateUserRequest = typeof CreateUserRequest.Type
// { readonly name: string; readonly email: string }
```

- 単なる POJO
- DTO / ペイロード / URL パラメータ向き

### `Schema.Class` — インスタンス化可能なクラス

```ts
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

// 生成・使用
const user = new UserResponse({ id: "1", name: "Alice", email: "alice@example.com" })
user.name // → "Alice"
```

- `new UserResponse(...)` で作れる
- レスポンスエンティティ / ドメインオブジェクト向き
- メソッドやゲッターを生やしたければ `class` の body にそのまま書ける

**使い分け目安**:

| ケース | 推奨 |
| --- | --- |
| ただ JSON を束ねたい | `Schema.Struct` |
| `new ...` で作ってハンドラで `return` する | `Schema.Class` |
| エラーとして使いたい | `Schema.TaggedErrorClass` ([06. エラーハンドリング](./06-error-handling.md) 参照) |

## エンドポイントでの利用

```ts
// src/users/api.ts
import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"
import { UserResponse, CreateUserRequest } from "./schemas.js"

const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },   // パスパラメータ
  success: UserResponse,
})

const createUser = HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,      // リクエストボディ
  success: UserResponse,
})
```

ハンドラに届く段階では `req.params.id: string` / `req.payload: CreateUserRequest` として **デコード済み** です。バリデーションに失敗した場合は自動的に 400 が返り、ハンドラは実行されません。

## Refinement (制約)

基本コンビネータ:

```ts
import { Schema } from "effect"

Schema.String.pipe(Schema.minLength(1))         // 1 文字以上
Schema.String.pipe(Schema.maxLength(255))
Schema.String.pipe(Schema.pattern(/^\S+@\S+$/))
Schema.Number.pipe(Schema.int(), Schema.between(0, 120))
Schema.Literal("admin", "user", "guest")        // 列挙
Schema.Array(Schema.String)
Schema.optional(Schema.String)
Schema.Union(Schema.String, Schema.Number)
```

実例:

```ts
export const CreateUserRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  email: Schema.String.pipe(Schema.pattern(/^[^@]+@[^@]+$/)),
  age: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 150))),
  role: Schema.Literal("admin", "user", "guest"),
})
```

OpenAPI にも `minLength` / `maxLength` / `pattern` / `enum` として反映されます。

## ブランド型 (ドメインプリミティブ)

```ts
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type   // string & Brand<"UserId">
```

ID と文字列を混同しない運用にしたい場合に便利です。Rails の `ApplicationRecord#id` より強く「**文字列を直接代入しようとするとコンパイルエラー**」になります。

## ネストと派生

```ts
const Address = Schema.Struct({
  city: Schema.String,
  postalCode: Schema.String.pipe(Schema.pattern(/^\d{3}-\d{4}$/)),
})

export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  address: Address,
}) {}
```

## レスポンス側でのフィールド除去・別名

```ts
import { Schema } from "effect"

const PublicUser = UserResponse.pipe(
  Schema.omit("email"),   // email を除外
)
```

エンドポイントによって公開フィールドを変えたいときに使えます。

## クライアント側の型導出

エンドポイント定義から、`HttpApiClient` は **両側の型** を導出します。

```ts
const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(AppApi)
  const user = yield* client.Users.getUser({ params: { id: "1" } })
  //                                              ^^^^^^ Schema から導出
  //          ^^^^ 返り値も Schema から導出
})
```

## Rails / NestJS との対応

| やりたいこと | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| 受信パラメータ検証 | `strong_parameters` | `ValidationPipe` + `class-validator` | Schema (`params`, `payload`) |
| 型定義の共有 | 手書き Ruby クラス | DTO `class` + TypeScript | Schema 1 枚で両立 |
| OpenAPI スキーマ | gem (rswag 等) | `@nestjs/swagger` デコレータ | Schema から自動生成 |
| バリデーション失敗時 | before_action で弾く | 400 Bad Request | 自動で 400 (`SchemaError`) |

## バリデーションエラーをドメインエラーに整形する

デフォルトでは `Schema.SchemaError` として返ります。ユーザ向けメッセージを整形したい場合は `HttpApiMiddleware.layerSchemaErrorTransform` でラップしましょう。[05. ミドルウェア](./05-middleware.md#サンプル-3-schemaerror--ドメインエラー変換) を参照してください。

## この章のまとめ

- データ構造 = `Schema.Struct`、エンティティ = `Schema.Class`、エラー = `Schema.TaggedErrorClass`
- `Schema.minLength` / `Schema.pattern` など refinement を `.pipe` で重ねる
- エンドポイント定義で `params` / `payload` 等に Schema を置けば、ハンドラはデコード後の値を受け取れる
- 同じ Schema が OpenAPI スキーマとクライアント型の両方を生む

### 人と AI の視点から

契約を **複数箇所に書き分ける** 構成は、人の手でも AI でも食い違いが発生しやすい典型パターンです。sayo-ts では Schema 1 つから型・バリデータ・OpenAPI・クライアント型が一斉に決まるため、**食い違いの発生源そのものが存在しません**。詳細は [人と AI のためのフレームワーク](./for-humans-and-ai.md) を参照。

次は [08. テスト](./08-testing.md) で、`HttpApiClient` と `layerTest` を使った統合テスト手法を学びます。
