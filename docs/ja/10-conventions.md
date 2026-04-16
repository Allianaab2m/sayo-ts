# 10. 規約と Lint ルール

この章で学ぶこと:

- `@sayo-ts/eslint-plugin` が提供する 7 つのルールと、それぞれの NG / OK 例
- flat config (`eslint.config.ts`) での組み込み方
- 個別ルールの無効化手順

前提章: [02. Effect の基礎](./02-effect-essentials.md) (なぜこれらが禁止されるのか理解するため)

---

## なぜ規約を Lint で強制するのか

sayo-ts の設計思想は「**Effect を正しく使えば安全 / そうでなければ危険**」です。ドキュメントで注意喚起するだけでは逸脱が起き、`E` チャネルや Fiber ランタイムの利点が壊れます。このため、**規約違反はコミット前に検出** できるように ESLint で強制します。

## セットアップ

flat config でそのまま使えます。

```ts
// eslint.config.ts
import tsParser from "@typescript-eslint/parser"
import sayo from "@sayo-ts/eslint-plugin"

export default [
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser },
  },
  sayo.configs.recommended,
]
```

`sayo.configs.recommended` は下表の severity を自動で適用します。

## ルール一覧

| ルール | Severity | カテゴリ |
| --- | --- | --- |
| [`@sayo-ts/no-raw-promise`](#no-raw-promise) | error | Effect 安全性 |
| [`@sayo-ts/no-try-catch`](#no-try-catch) | error | Effect 安全性 |
| [`@sayo-ts/tagged-error-required`](#tagged-error-required) | warn | エラー設計 |
| [`@sayo-ts/endpoint-response-schema-required`](#endpoint-response-schema-required) | warn | API 契約 |
| [`@sayo-ts/endpoint-error-schema-required`](#endpoint-error-schema-required) | warn | API 契約 |
| [`@sayo-ts/no-run-sync-in-handler`](#no-run-sync-in-handler) | error | Effect 安全性 |
| [`@sayo-ts/service-interface-separation`](#service-interface-separation) | warn | ディレクトリ規約 |

---

### `no-raw-promise`

**Severity: `error`**

`new Promise` や `Promise.resolve/reject/all/race/allSettled/any` を直接使うのを禁じます。

**NG**:

```ts
const p = new Promise<number>((resolve) => resolve(1))
const result = await Promise.all([a(), b()])
```

**OK**:

```ts
const result = yield* Effect.tryPromise({
  try: () => fetch("/api/user"),
  catch: (e) => new NetworkError({ cause: String(e) }),
})
const [a, b] = yield* Effect.all([effA, effB])
```

**なぜ**: 生の Promise は Effect の `E` に現れず、失敗経路が型から抜け落ちます。`Effect.tryPromise` / `Effect.all` を使えば型と Fiber ランタイムに統合されます。

---

### `no-try-catch`

**Severity: `error`**

素の `try-catch` を禁じます。例外的に「catch ブロックで `Effect.fail` / `Effect.die` を **直接 `return` する** 場合」のみ許可されます。

**NG**:

```ts
try {
  doSomething()
} catch (e) {
  console.log(e)
}
```

**OK**:

```ts
const result = yield* Effect.try({
  try: () => JSON.parse(str),
  catch: (e) => new ParseError({ cause: String(e) }),
})

// または catch ブロックで即座に Effect.fail を返すのはセーフ
try {
  riskyOperation()
} catch (e) {
  return Effect.fail(new MyError({ cause: String(e) }))
}
```

**なぜ**: `catch (e)` は `unknown`。型情報が消え、どのエラーが起こりうるかを呼び出し側が知る手段がなくなります。`Effect.try` で包めば型付きエラーとして `E` に現れます。

---

### `tagged-error-required`

**Severity: `warn`**

`Effect.fail` に渡す値は `Schema.TaggedErrorClass` のインスタンスであることを期待します。

**NG**:

```ts
Effect.fail("something went wrong")
Effect.fail(new Error("oops"))
Effect.fail({ message: "plain object" })
```

**OK**:

```ts
class MyError extends Schema.TaggedErrorClass<MyError>()("MyError", {
  message: Schema.String,
}) {}

Effect.fail(new MyError({ message: "something went wrong" }))
```

**なぜ**: Tagged Error でないと判別共用体として分岐できず、HTTP レスポンスへのシリアライズも不完全になります。

---

### `endpoint-response-schema-required`

**Severity: `warn`**

`HttpApiEndpoint.<method>(...)` の `spec` で `success` を書き忘れると警告します。

**NG**:

```ts
HttpApiEndpoint.get("health", "/health")
HttpApiEndpoint.post("createUser", "/users", { payload: CreateUserRequest })
```

**OK**:

```ts
HttpApiEndpoint.get("health", "/health", { success: Schema.Struct({ ok: Schema.Literal(true) }) })
HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,
  success: UserResponse,
})
```

**なぜ**: `success` がないと OpenAPI にレスポンス型の記述が欠け、`HttpApiClient` の戻り値も `unknown` になります。

---

### `endpoint-error-schema-required`

**Severity: `warn`**

`HttpApiEndpoint.<method>(...)` に `error` 宣言がないと警告します。

**NG**:

```ts
HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
})
```

**OK**:

```ts
HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
})
```

**なぜ**: ハンドラが失敗しうるのにエンドポイント契約で宣言していないと、OpenAPI に穴が開き、クライアントもエラーを型安全に処理できません。「絶対失敗しない」と確信している場合のみ、ファイル単位でルール無効化してください。

---

### `no-run-sync-in-handler`

**Severity: `error`**

`HttpApiBuilder.group(...).handle(name, fn)` の `fn` の中で `Effect.runSync` / `Effect.runPromise` / `Effect.runFork` を呼ぶことを禁じます。

**NG**:

```ts
handlers.handle("getUser", (req) => {
  const user = Effect.runSync(UserService.findById(req.params.id))
  return Effect.succeed(user)
})
```

**OK**:

```ts
handlers.handle("getUser", (req) =>
  Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById(req.params.id)
  }),
)
```

**なぜ**: ハンドラは既に Fiber ランタイム上で動いています。中で `runSync` すると別 Fiber を作ってしまい、Scope ・キャンセル・エラー伝播が壊れます。

---

### `service-interface-separation`

**Severity: `warn`**

同じファイルに `Context.Service` の宣言と `Layer` の実装を書くと警告します。

**NG (`user.ts` 1 ファイルにまとめてしまった)**:

```ts
class UserService extends Context.Service<UserService, {...}>()("UserService") {}
const UserServiceLive = Layer.succeed(UserService, UserService.of({...}))
```

**OK**:

```ts
// service.ts
export class UserService extends Context.Service<UserService, {...}>()("UserService") {}

// service.live.ts
import { UserService } from "./service.js"
export const UserServiceLive = Layer.succeed(UserService, UserService.of({...}))
```

**なぜ**: テスト時 (または別環境) に実装を差し替えるには **ポートとアダプタを別モジュールにする** のが最もシンプルです。ファイルを分けておけば、実装だけを読まずに済むし、循環依存も避けられます ([03. Layer システムと DI](./03-layer-and-di.md) 参照)。

---

## ルールを無効化する

### ファイル末尾のレガシーコードだけ例外にしたい

```ts
/* eslint-disable @sayo-ts/no-raw-promise */
// このファイルだけ生 Promise を許容
```

### 1 行だけ

```ts
// eslint-disable-next-line @sayo-ts/no-try-catch
try { /* ... */ } catch (e) { /* legacy */ }
```

### 特定ファイルで複数ルールを緩める

`eslint.config.ts` に追記:

```ts
export default [
  { files: ["**/*.ts"], languageOptions: { parser: tsParser } },
  sayo.configs.recommended,
  {
    files: ["src/legacy/**/*.ts"],
    rules: {
      "@sayo-ts/no-raw-promise": "off",
      "@sayo-ts/no-try-catch": "off",
    },
  },
]
```

ただし、**原則として規約に従うのが安全で、逸脱にはコメントで理由を残す** ことを推奨します。

## この章のまとめ

- sayo-ts の規約は ESLint 7 ルールでコミット前に強制される
- 3 つは Effect 安全性の `error` ルール (`no-raw-promise` / `no-try-catch` / `no-run-sync-in-handler`)
- 2 つは API 契約の `warn` ルール (`endpoint-response-schema-required` / `endpoint-error-schema-required`)
- 2 つはコード構造の `warn` ルール (`tagged-error-required` / `service-interface-separation`)
- 部分的な無効化は `eslint-disable` コメントまたはファイル単位のオーバーライドで

### 人と AI の視点から

これら 7 ルールは、「レビューで繰り返し指摘される規約違反」を **機械可読に言い換えたもの** です。言い換えれば、プロンプトや口頭で毎回伝えるコストが消える代わりに、`pnpm lint` が事後に物理強制します。人間の書き手にとっては「指摘コストの削減」、AI コーディング補助にとっては「プロンプトで伝えきれない規約の事後強制」— **同じ仕組みが両方に効く** のが sayo-ts の基本姿勢です。詳細は [人と AI のためのフレームワーク](./for-humans-and-ai.md) を参照。

これで日本語ドキュメントの本編は最後です。軸となる設計思想については付録の [人と AI のためのフレームワーク](./for-humans-and-ai.md) を、英語版は [../en/README.md](../en/README.md) から辿れます。
