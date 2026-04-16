# 6. エラーハンドリング

この章で学ぶこと:

- `Schema.TaggedErrorClass` によるドメインエラー定義
- Effect 型の `E` パラメータがどう伝播するか
- `HttpApiSchema.status(code)` で HTTP ステータスにマッピング
- 複数のエラーを宣言する方法
- Rails `rescue_from` / NestJS `ExceptionFilter` との違い

前提章: [02. Effect の基礎](./02-effect-essentials.md)、[04. エンドポイントとハンドラ](./04-endpoints.md)

---

## ドメインエラーを Tagged Class で表現する

sayo-ts ではエラーを **必ず `Schema.TaggedErrorClass` のサブクラス** として定義します (`sayo/tagged-error-required` ルールで警告)。

```ts
// templates/default/src/users/errors.ts
import { Schema } from "effect"

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
  "UserNotFound",
  { userId: Schema.String },
) {}

export class EmailAlreadyTaken extends Schema.TaggedErrorClass<EmailAlreadyTaken>()(
  "EmailAlreadyTaken",
  { email: Schema.String },
) {}
```

TaggedError がもたらすもの:

- `_tag: "UserNotFound"` を持つので、`switch (e._tag)` で **網羅的に分岐**できる
- フィールドは Schema で定義されるので、**JSON 直列化・HTTP レスポンス本文への変換が自動**
- `Effect.fail(new UserNotFound(...))` でエラー側に流すと、**`Effect.Effect<A, UserNotFound, R>` の `E` に反映**

## 型レベルでの伝播

```ts
// Service 層
findById: (id: string) =>
  Effect.Effect<UserResponse, UserNotFound>
                  //           ^^^^^^^^^^^ ここが E
```

これを呼ぶハンドラの型も自動的に合流します。

```ts
h.handle("getUser", (req) =>
  Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById(req.params.id)
    // ハンドラの Effect.E = UserNotFound
  }),
)
```

そして `api.ts` で `error` に `UserNotFound` を **宣言していないと型エラー** になります。

```ts
const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
  //     ^^^^^^^^^^^ ハンドラが投げ得るエラーと一致している必要がある
})
```

これが「**Rails や NestJS と違い、エラーの網羅性がビルド時に保証される**」所以です。

## HTTP ステータスマッピング: `HttpApiSchema.status`

エラークラスは HTTP を知らない純粋なドメインエラーとして定義し、HTTP ステータスは `HttpApiSchema.status(code)` でエンドポイント側に注記します。

```ts
error: UserNotFound.pipe(HttpApiSchema.status(404))
```

デフォルトマッピング:

| 状況 | ステータス |
| --- | --- |
| `success` が返った | 200 (POST の場合は 200、201 にしたい場合は `HttpApiSchema.status(201)` を `success` 側に) |
| `error` に該当するエラー | `HttpApiSchema.status(...)` で指定した値 (未指定なら 500) |
| バリデーションエラー (`Schema.SchemaError`) | 400 (上書きしたい場合は [05. ミドルウェア](./05-middleware.md) の `layerSchemaErrorTransform` 参照) |

## 複数エラーを宣言する

```ts
const createUser = HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,
  success: UserResponse,
  error: [
    EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
    ValidationError.pipe(HttpApiSchema.status(400)),
  ],
})
```

配列で与えれば、**いずれかのエラー型** が許容されます。`HttpApiClient` で呼び出したクライアント側も、エラーは判別可能な Union 型として返ってきます。

## クライアント側のエラーハンドリング

`HttpApiClient.make(AppApi)` で作ったクライアントでは、エラーは `Effect` の失敗チャネルに乗って戻ってきます。

```ts
const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(AppApi)
  return yield* client.Users.getUser({ params: { id: "unknown" } }).pipe(
    Effect.catchTag("UserNotFound", (e) =>
      Effect.succeed(`no user: ${e.userId}`),
    ),
  )
})
```

- `Effect.catchTag("UserNotFound", fn)` で特定エラーだけを捕捉
- `Effect.catchTags({ UserNotFound: fn1, EmailAlreadyTaken: fn2 })` で複数を一括処理

Rails で `rescue UserNotFound => e` と書くのに相当しますが、**すべて型で網羅性がチェックされる** のが違いです。

## テストでの失敗アサーション

Effect では失敗も「値」です。`Effect.exit` で `Exit<A, E>` に変換してアサートするのが簡単です。

```ts
it("should return error for unknown user", async () => {
  const program = Effect.gen(function* () {
    const client = yield* HttpApiClient.make(AppApi)
    const result = yield* Effect.exit(
      client.Users.getUser({ params: { id: "unknown" } }),
    )
    expect(result._tag).toBe("Failure")
  })
  await program.pipe(Effect.provide(TestLive), Effect.runPromise)
})
```

詳細は [08. テスト](./08-testing.md) を参照。

## ハンドラ内でエラーを変換する

特定サービスのエラーをハンドラ側で別エラーに詰め替えたい場合:

```ts
h.handle("getUser", (req) =>
  Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById(req.params.id).pipe(
      Effect.mapError((_e) =>
        new UserNotFound({ userId: req.params.id }),
      ),
    )
  }),
)
```

- `Effect.mapError(fn)` で `E` を変換
- `Effect.catchAll(fn)` で全エラーを拾って別 Effect に差し替え
- `Effect.catchTag(tag, fn)` / `Effect.catchTags({})` で判別分岐

## Rails / NestJS との違い

| | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| エラー定義 | 例外クラス | `HttpException` サブクラス | `Schema.TaggedErrorClass` |
| ステータスマッピング | `rescue_from ... with: :method` | `@HttpCode` / フィルタ | `HttpApiSchema.status(code)` |
| 網羅性 | ランタイムのみ (書き忘れたら 500) | 部分的 (TS は `throw` の型追跡なし) | **コンパイル時 100%** |
| クライアント型 | 手書き | `@nestjs/swagger` 経由で生成 | `AppApi` から自動導出 |

## この章のまとめ

- エラーは `Schema.TaggedErrorClass` で定義 (`sayo/tagged-error-required` で警告)
- ハンドラが返し得るエラーはエンドポイント `error` に**必ず**宣言する
- HTTP ステータスは `.pipe(HttpApiSchema.status(code))` で付与
- エラーは Effect の `E` を通じて型で伝播し、網羅性が保証される
- `Effect.catchTag` / `catchTags` / `mapError` で変換できる

### 関連 ESLint ルール

- `sayo/tagged-error-required` (warn): `Effect.fail("string")` や `new Error()` を禁止
- `sayo/endpoint-error-schema-required` (warn): エンドポイント `error` の宣言忘れ

次は [07. バリデーションとスキーマ](./07-validation.md) で `Schema` を深掘りします。
