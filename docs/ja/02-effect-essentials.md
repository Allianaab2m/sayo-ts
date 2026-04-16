# 2. Effect の基礎

この章で学ぶこと:

- なぜ `async/await` + `try-catch` ではなく Effect を使うのか
- `Effect.gen(function*() { ... })` と `yield*` の読み方・書き方
- `Effect.succeed` / `Effect.fail` / `Effect.try` / `Effect.tryPromise` の使い分け
- `Schema` と `Schema.TaggedErrorClass` の最小知識
- sayo-ts が `Promise` と `try-catch` を禁止する理由

前提章: [01. はじめに](./01-getting-started.md)

---

## Effect のメンタルモデル

Effect の中心型は次の 3 パラメータを持ちます:

```ts
Effect.Effect<A, E, R>
//             │  │  └─ Requirements: 実行に必要なサービス (DI)
//             │  └──── Error: 失敗しうるエラーの型
//             └─────── Success: 成功時の値の型
```

`Promise<A>` との違いは次のとおりです:

| | `Promise<A>` | `Effect.Effect<A, E, R>` |
| --- | --- | --- |
| 成功値 | `A` | `A` |
| エラー | `unknown` (catch 節) | `E` (型で網羅) |
| 依存 | 暗黙 (グローバル import) | `R` (型で注入を強制) |
| 実行 | 宣言即実行 | 記述と実行が分離 |
| キャンセル | 基本なし | Fiber 単位で正しく伝播 |

つまり Effect は「**型に現れる async + 型に現れる依存 + 型に現れる失敗**」です。

## `Effect.gen` と `yield*` — async/await の代わり

sayo-ts の全てのビジネスロジックは `Effect.gen` で書きます。

```ts
import { Effect } from "effect"
import { UserService } from "./service.js"

const program = Effect.gen(function* () {
  const service = yield* UserService          // DI: コンテキストから取得
  const user = yield* service.findById("1")   // 失敗し得る計算を「待つ」
  return user.name
})
```

読み替えのコツ:

- `function* ()` のジェネレータ構文が `async function` に相当
- `yield*` が `await` に相当
- ただし `yield*` で `Effect.Effect<A, E, R>` をバインドすると、**その `E` と `R` が囲む `Effect` の型パラメータに合流する**

次の 2 つは同じ意味です。

```ts
// Promise / async 風
async function getUserName() {
  const user = await userService.findById("1")
  return user.name
}

// Effect 風
const getUserName = Effect.gen(function* () {
  const user = yield* userService.findById("1")
  return user.name
})
```

## `yield*` で「エラーを返す」

sayo-ts のテンプレで実際に使われている例 (`templates/default/src/users/service.live.ts` より):

```ts
findById: (id) =>
  Effect.gen(function* () {
    if (id === "1") {
      return new UserResponse({ id: "1", name: "Alice", email: "alice@example.com" })
    }
    return yield* new UserNotFound({ userId: id })
  }),
```

ポイント:

- 成功時は通常の値を `return`
- 失敗時は `yield* new ErrorClass(...)` (または `yield* Effect.fail(...)`) で **エラー側に値を流す**
- `UserNotFound` は `Schema.TaggedErrorClass` (後述) のサブクラス。`yield*` するだけで `Effect.fail(...)` 相当になる

## 同期処理を Effect に持ち上げる

| やりたいこと | 使う API |
| --- | --- |
| 成功値をそのまま包む | `Effect.succeed(value)` |
| 失敗をそのまま流す | `Effect.fail(error)` |
| 例外を投げうる同期関数をラップ | `Effect.try({ try: () => ..., catch: (e) => new MyError({ cause: e }) })` |
| Promise を返す関数をラップ | `Effect.tryPromise({ try: () => fetch(...), catch: (e) => new MyError({ cause: e }) })` |

```ts
const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input) as unknown,
    catch: (e) => new ParseError({ cause: String(e) }),
  })

const fetchProfile = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`).then((r) => r.json()),
    catch: (e) => new NetworkError({ cause: String(e) }),
  })
```

これらを直接 `Promise` や `try-catch` で書かないのが sayo-ts の規約です (後述の ESLint ルール参照)。

## `Schema` — 実行時検証 + 型導出

Effect の `Schema` は「**1 か所書けば TypeScript の型と実行時バリデータが両方手に入る**」仕組みです。NestJS における class-validator + TypeScript 型の両方を兼ねます。

```ts
import { Schema } from "effect"

// レスポンスを「クラス」として定義 (インスタンス化できる)
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

// 入力ペイロード用の構造体
export const CreateUserRequest = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
})
export type CreateUserRequest = typeof CreateUserRequest.Type
```

| 用途 | 推奨 |
| --- | --- |
| インスタンス化したい / 値として `new` したい | `Schema.Class` |
| ただのデータ構造で十分 | `Schema.Struct` |

詳細は [07. バリデーションとスキーマ](./07-validation.md) を参照。

## `Schema.TaggedErrorClass` — 型付きエラー

ドメインエラーは `Schema.TaggedErrorClass` で定義します。

```ts
import { Schema } from "effect"

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
  "UserNotFound",
  { userId: Schema.String },
) {}
```

こう書いたエラーは:

- `_tag: "UserNotFound"` を持ち、判別共用体(discriminated union)として分岐可能
- `Effect.Effect<A, UserNotFound, R>` の `E` に現れる
- JSON シリアライズ可能で、HTTP レスポンス本文に自動変換される

詳細は [06. エラーハンドリング](./06-error-handling.md) を参照。

## Effect をどう実行するか

sayo-ts のテンプレでは、実行は次の 2 か所でしか発生しません。

### アプリ起動 (`src/main.ts`)

```ts
import { Layer } from "effect"
import { NodeRuntime } from "@effect/platform-node"

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
```

`Layer.launch` が Layer グラフを起動し、`NodeRuntime.runMain` が Node.js のライフサイクル (SIGINT など) に接続します。

### テスト (`test/**/*.test.ts`)

```ts
await program.pipe(Effect.provide(TestLive), Effect.runPromise)
```

`Effect.runPromise` が `Promise` に変換し、Vitest の `await` に乗せます。

**ハンドラ内で `Effect.runSync` / `Effect.runPromise` / `Effect.runFork` を呼んではいけません！** — Fiber の外で走らせてしまい、エラー追跡やキャンセルが壊れます。これは `sayo/no-run-sync-in-handler` ルールで強制されます。

## なぜ `Promise` / `try-catch` を避けるのか

`@sayo/eslint-plugin` は `new Promise`, `Promise.resolve/reject/all/...`, 素の `try-catch` を禁止します。

理由:

- `Promise` 直書きは `E` に現れないので、**失敗経路が型システムから抜け落ちる**
- `try-catch` の `catch (e)` は `unknown` なので、**何をキャッチしているかをコンパイラが教えてくれない**
- `Effect.tryPromise` / `Effect.try` を使えば、`catch` で組み立てた `TaggedError` が `E` に乗り、網羅チェックが効く

「どうしても例外を投げる既存 API を使いたい」というケースは `Effect.tryPromise` や `Effect.try` でラップしてください。詳細は [10. 規約と Lint ルール](./10-conventions.md) を参照。

## この章のまとめ

- ビジネスロジックは `Effect.gen(function*() { ... })` で書き、`yield*` で他 Effect をバインドする
- エラーは `Schema.TaggedErrorClass` で型付け、`yield* new MyError(...)` でエラー側に流す
- 同期例外 / Promise は `Effect.try` / `Effect.tryPromise` で取り込む
- Effect の実行は `main.ts` (`Layer.launch`) とテスト (`Effect.runPromise`) の 2 か所のみ

### 人と AI の視点から

Effect が `E` に全ての失敗を載せ、`R` に全ての依存を載せる設計は、**型検査器が「レビュワーの一人」として機能する** 状態を作ります。生の `Promise` や `try-catch` に逃げると失敗経路が型から外れますが、これを禁止することで「人が書いても AI が書いても、足りない処理がビルドエラーとして顕在化する」土台になります。詳細は [人と AI のためのフレームワーク](./for-humans-and-ai.md) を参照。

次は [03. Layer システムと DI](./03-layer-and-di.md) で、`Context.Service` と `Layer` による依存性注入を学びます。
