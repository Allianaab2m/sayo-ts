# 10. Conventions & Lint

What you will learn:

- All seven rules in `@sayo-ts/eslint-plugin`, with good / bad examples
- Wiring them into a flat-config `eslint.config.ts`
- How to disable individual rules

Prerequisite chapters: [02. Effect Essentials](./02-effect-essentials.md) (for the reasoning)

---

## Why enforce conventions via lint

sayo-ts's premise is that "**Effect used correctly is safe; Effect used carelessly is dangerous**." Prose hints aren't enough — drift quickly breaks the `E` channel or escapes the Fiber runtime. The ESLint rules catch violations before they land.

## Setup

Wire the plugin into a flat config:

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

`sayo.configs.recommended` applies the severities below.

## Rule list

| Rule | Severity | Category |
| --- | --- | --- |
| [`@sayo-ts/no-raw-promise`](#no-raw-promise) | error | Effect safety |
| [`@sayo-ts/no-try-catch`](#no-try-catch) | error | Effect safety |
| [`@sayo-ts/tagged-error-required`](#tagged-error-required) | warn | Error design |
| [`@sayo-ts/endpoint-response-schema-required`](#endpoint-response-schema-required) | warn | API contract |
| [`@sayo-ts/endpoint-error-schema-required`](#endpoint-error-schema-required) | warn | API contract |
| [`@sayo-ts/no-run-sync-in-handler`](#no-run-sync-in-handler) | error | Effect safety |
| [`@sayo-ts/service-interface-separation`](#service-interface-separation) | warn | Directory convention |

---

### `no-raw-promise`

**Severity: `error`**

Forbids direct usage of `new Promise` and `Promise.resolve/reject/all/race/allSettled/any`.

**Bad**:

```ts
const p = new Promise<number>((resolve) => resolve(1))
const result = await Promise.all([a(), b()])
```

**Good**:

```ts
const result = yield* Effect.tryPromise({
  try: () => fetch("/api/user"),
  catch: (e) => new NetworkError({ cause: String(e) }),
})
const [a, b] = yield* Effect.all([effA, effB])
```

**Why**: Raw Promises don't appear in `E`, so the failure path is invisible to the type system. `Effect.tryPromise` / `Effect.all` keep you inside the Fiber runtime and the type system.

---

### `no-try-catch`

**Severity: `error`**

Forbids `try-catch` blocks, except the narrow case where the `catch` block immediately `return`s an `Effect.fail` / `Effect.die`.

**Bad**:

```ts
try {
  doSomething()
} catch (e) {
  console.log(e)
}
```

**Good**:

```ts
const result = yield* Effect.try({
  try: () => JSON.parse(str),
  catch: (e) => new ParseError({ cause: String(e) }),
})

// Also acceptable — directly return Effect.fail from the catch block
try {
  riskyOperation()
} catch (e) {
  return Effect.fail(new MyError({ cause: String(e) }))
}
```

**Why**: `catch (e)` types `e` as `unknown`, erasing useful information. Wrapping in `Effect.try` turns the error into a typed value in `E`.

---

### `tagged-error-required`

**Severity: `warn`**

Expects every `Effect.fail` to receive an instance of `Schema.TaggedErrorClass`.

**Bad**:

```ts
Effect.fail("something went wrong")
Effect.fail(new Error("oops"))
Effect.fail({ message: "plain object" })
```

**Good**:

```ts
class MyError extends Schema.TaggedErrorClass<MyError>()("MyError", {
  message: Schema.String,
}) {}

Effect.fail(new MyError({ message: "something went wrong" }))
```

**Why**: Non-tagged errors can't be branched on exhaustively and don't serialize cleanly to HTTP responses.

---

### `endpoint-response-schema-required`

**Severity: `warn`**

Warns when an `HttpApiEndpoint.<method>(...)` spec omits `success`.

**Bad**:

```ts
HttpApiEndpoint.get("health", "/health")
HttpApiEndpoint.post("createUser", "/users", { payload: CreateUserRequest })
```

**Good**:

```ts
HttpApiEndpoint.get("health", "/health", { success: Schema.Struct({ ok: Schema.Literal(true) }) })
HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,
  success: UserResponse,
})
```

**Why**: Without `success`, OpenAPI loses the response shape and `HttpApiClient` returns `unknown`.

---

### `endpoint-error-schema-required`

**Severity: `warn`**

Warns when `HttpApiEndpoint.<method>(...)` omits `error`.

**Bad**:

```ts
HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
})
```

**Good**:

```ts
HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
})
```

**Why**: Endpoints that can fail should say so; otherwise OpenAPI docs and the client's error handling are incomplete. If an endpoint truly cannot fail, disable the rule at the file or line.

---

### `no-run-sync-in-handler`

**Severity: `error`**

Forbids `Effect.runSync` / `Effect.runPromise` / `Effect.runFork` inside `HttpApiBuilder.group(...).handle(name, fn)`.

**Bad**:

```ts
handlers.handle("getUser", (req) => {
  const user = Effect.runSync(UserService.findById(req.params.id))
  return Effect.succeed(user)
})
```

**Good**:

```ts
handlers.handle("getUser", (req) =>
  Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById(req.params.id)
  }),
)
```

**Why**: Handlers already run inside a Fiber. `runSync` inside spawns a second runtime, breaking Scope, cancellation, and error propagation.

---

### `service-interface-separation`

**Severity: `warn`**

Warns when a single file contains both a `Context.Service` definition and a `Layer` implementation.

**Bad** (`user.ts` with both):

```ts
class UserService extends Context.Service<UserService, {...}>()("UserService") {}
const UserServiceLive = Layer.succeed(UserService, UserService.of({...}))
```

**Good**:

```ts
// service.ts
export class UserService extends Context.Service<UserService, {...}>()("UserService") {}

// service.live.ts
import { UserService } from "./service.js"
export const UserServiceLive = Layer.succeed(UserService, UserService.of({...}))
```

**Why**: The simplest way to swap implementations in tests (or alternative environments) is to keep the port and adapter in **separate files**. It also avoids import cycles (see [03. Layer & DI](./03-layer-and-di.md)).

---

## Disabling rules

### Legacy code in a single file

```ts
/* eslint-disable @sayo-ts/no-raw-promise */
// raw Promises allowed in this file only
```

### One line

```ts
// eslint-disable-next-line @sayo-ts/no-try-catch
try { /* ... */ } catch (e) { /* legacy */ }
```

### Multiple files via config override

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

Default to following the rules; when you must deviate, leave a comment explaining why.

## Summary

- sayo-ts's conventions are enforced by seven ESLint rules at commit time
- Three are `error` rules about Effect safety (`no-raw-promise` / `no-try-catch` / `no-run-sync-in-handler`)
- Two are `warn` rules about API contracts (`endpoint-response-schema-required` / `endpoint-error-schema-required`)
- Two are `warn` rules about code structure (`tagged-error-required` / `service-interface-separation`)
- Scope overrides live in `eslint.config.ts` or in local `eslint-disable` comments

### From the human-and-AI angle

These seven rules are simply **machine-readable restatements of comments reviewers keep making**. The cost of explaining them in prompts or in person goes away, replaced by `pnpm lint` enforcing them after the fact. For human authors this cuts review noise; for AI assistants this enforces conventions that wouldn't fit in a prompt. **The same mechanism serves both** — that's the stance sayo-ts takes. See [A framework for humans and AI](./for-humans-and-ai.md).

This is the last main chapter. For the design thesis that unifies all of the above, see the appendix [A framework for humans and AI](./for-humans-and-ai.md); for the Japanese edition, see [../ja/README.md](../ja/README.md).
