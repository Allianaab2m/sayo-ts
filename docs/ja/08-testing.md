# 8. テスト

この章で学ぶこと:

- Vitest での最小セットアップ
- `NodeHttpServer.layerTest` によるインプロセス HTTP テスト
- `HttpApiClient.make(AppApi)` で型安全クライアントを使う
- `service.mock.ts` パターンでサービスを差し替える
- `Effect.exit` で失敗経路をアサートする

前提章: [03. Layer システムと DI](./03-layer-and-di.md)、[04. エンドポイントとハンドラ](./04-endpoints.md)

---

## セットアップ

`templates/default` は Vitest を使います。追加設定は不要です。

```json
// package.json (抜粋)
{
  "scripts": {
    "test": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

## テストスタックの組み立て

テンプレの `test/users/handlers.test.ts` が典型例です。

```ts
import { Effect, Layer } from "effect"
import { HttpApiBuilder, HttpApiClient } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { NodeHttpServer } from "@effect/platform-node"
import { describe, it, expect } from "vitest"
import { AppApi } from "../../src/api.js"
import { UsersHandlers } from "../../src/users/handlers.js"
import { UserServiceMock } from "./service.mock.js"

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)

// provideMerge で HttpClient をテスト本体から見えるようにする
const TestLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(UserServiceMock),
  Layer.provideMerge(NodeHttpServer.layerTest),
)
```

### 本番との差分は 2 行

本番の `main.ts` との差は実質:

1. 実装を `UserServiceLive` から `UserServiceMock` に差し替え
2. `NodeHttpServer.layer` を `NodeHttpServer.layerTest` に差し替え

Layer の合成スタイルは本番と **完全に同じ** です。「テスト用の別フレームワーク」を覚える必要がありません。

### `provideMerge` が必要な理由

通常の `Layer.provide(NodeHttpServer.layer(...))` だと提供された Layer は外に見えません。しかし、テスト本体の `Effect.gen` からは **テストサーバが提供する HttpClient を `yield* HttpApiClient.make(...)` で使いたい**。そこで `Layer.provideMerge` を使い、「provide しつつ外部にも合流させる」動きを作ります。

## モック Layer (`service.mock.ts`)

`test/users/service.mock.ts`:

```ts
import { Effect, Layer } from "effect"
import { UserService } from "../../src/users/service.js"
import { UserNotFound } from "../../src/users/errors.js"
import { UserResponse } from "../../src/users/schemas.js"

const mockUser = new UserResponse({
  id: "test-1",
  name: "Test User",
  email: "test@example.com",
})

export const UserServiceMock: Layer.Layer<UserService> = Layer.succeed(
  UserService,
  UserService.of({
    findById: (id) =>
      id === "test-1"
        ? Effect.succeed(mockUser)
        : Effect.fail(new UserNotFound({ userId: id })),
    register: (input) =>
      Effect.succeed(
        new UserResponse({ id: "test-new", name: input.name, email: input.email }),
      ),
  }),
)
```

重要な点:

- 型は `Layer.Layer<UserService>` で本番と同じ
- **インターフェースを実装していなければコンパイルエラー** になる — テストが書いてあれば、サービスにメソッドを足して mock を更新し忘れればビルドが通らない
- Vitest の `vi.mock` のようなランタイム魔法は使わず、普通の値として差し替えられる

## テストを書く

### 成功パス

```ts
it("should get a user by id", async () => {
  const program = Effect.gen(function* () {
    const client = yield* HttpApiClient.make(AppApi)
    const user = yield* client.Users.getUser({ params: { id: "test-1" } })
    expect(user.name).toBe("Test User")
    expect(user.email).toBe("test@example.com")
  })

  await program.pipe(Effect.provide(TestLive), Effect.runPromise)
})
```

- `HttpApiClient.make(AppApi)` で型安全クライアントを取得
- `client.Users.getUser({ params: { id: "test-1" } })` で **実際に HTTP 経由で呼び出す** (インプロセス)
- 返り値は `UserResponse` 型

### 失敗パス (エラーケース)

Effect では失敗も値です。`Effect.exit` で `Exit<A, E>` に変換してアサートします。

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

- `_tag: "Success"` または `"Failure"` で分岐
- `result._tag === "Failure"` のとき `result.cause` に詳細が入る

さらに特定エラーで失敗したことをアサートしたい場合:

```ts
import { Cause, Exit } from "effect"

it("should fail with UserNotFound", async () => {
  const program = Effect.gen(function* () {
    const client = yield* HttpApiClient.make(AppApi)
    const exit = yield* Effect.exit(
      client.Users.getUser({ params: { id: "unknown" } }),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause)
      expect(error._tag).toBe("Some")
      // error.value は UserNotFound 型 (判別共用体)
    }
  })

  await program.pipe(Effect.provide(TestLive), Effect.runPromise)
})
```

### POST / ペイロードのテスト

```ts
it("should create a user", async () => {
  const program = Effect.gen(function* () {
    const client = yield* HttpApiClient.make(AppApi)
    const user = yield* client.Users.createUser({
      payload: { name: "New User", email: "new@example.com" },
    })
    expect(user.id).toBe("test-new")
  })

  await program.pipe(Effect.provide(TestLive), Effect.runPromise)
})
```

## ユニットテスト vs 統合テスト

sayo-ts では両方をサポートしています。

### ユニットテスト (サービス単体)

```ts
it("findById should return Alice for id=1", async () => {
  const program = Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById("1")
  })
  const result = await program.pipe(
    Effect.provide(UserServiceLive),
    Effect.runPromise,
  )
  expect(result.name).toBe("Alice")
})
```

- HTTP レイヤを経由しない
- ビジネスロジックだけを検証したいときに

### 統合テスト (HTTP まで通す)

上で見た `NodeHttpServer.layerTest` を使うパターン。**推奨はこちら**。HTTP 層のルーティング・スキーマ検証・エラーマッピングまでひっくるめて検証できます。

## Rails / NestJS との対応

| | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| テストランナー | RSpec / minitest | Jest | Vitest |
| 統合テスト | request spec | supertest | `HttpApiClient` + `layerTest` |
| 依存モック | factory_bot + stubs | `overrideProvider()` | `Layer.provide(ServiceMock)` |
| 型の恩恵 | なし (動的) | 部分的 (DI コンテナの型) | **リクエスト・レスポンス・モック全てで型検査** |

## この章のまとめ

- `NodeHttpServer.layerTest` + `Layer.provideMerge` でインプロセス HTTP テストを組む
- `UserServiceLive` を `UserServiceMock` に差し替えるだけでモック可能
- モック Layer は **インターフェースを実装していなければコンパイルエラー** になる
- `Effect.exit` で失敗を値として取り出し、型で判別してアサート
- 本番 `main.ts` とテスト `TestLive` の Layer 合成スタイルは同一

次は [09. CLI とスキャフォールディング](./09-cli-and-scaffolding.md) です。
