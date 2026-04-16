# 2. Effect Essentials

What you will learn:

- Why Effect over plain `async/await` + `try-catch`
- How to read and write `Effect.gen(function*() { ... })` + `yield*`
- When to use `Effect.succeed` / `Effect.fail` / `Effect.try` / `Effect.tryPromise`
- The minimum needed of `Schema` and `Schema.TaggedErrorClass`
- Why sayo-ts forbids `Promise` and `try-catch`

Prerequisite chapters: [01. Getting Started](./01-getting-started.md)

---

## The Effect mental model

Effect's central type has three parameters:

```ts
Effect.Effect<A, E, R>
//             │  │  └─ Requirements: services this needs at runtime (DI)
//             │  └──── Error: the typed failures it can produce
//             └─────── Success: the value it produces when it succeeds
```

Compared with `Promise<A>`:

| | `Promise<A>` | `Effect.Effect<A, E, R>` |
| --- | --- | --- |
| Success value | `A` | `A` |
| Error | `unknown` (catch) | `E` (tracked in type) |
| Dependencies | implicit (globals) | `R` (tracked in type) |
| Execution | runs on creation | description and execution are separate |
| Cancellation | essentially none | Fiber-aware, propagates correctly |

So Effect is "**async in the type + dependencies in the type + errors in the type**".

## `Effect.gen` and `yield*` — instead of async/await

All business logic in sayo-ts goes inside `Effect.gen`.

```ts
import { Effect } from "effect"
import { UserService } from "./service.js"

const program = Effect.gen(function* () {
  const service = yield* UserService           // DI: pull from the context
  const user = yield* service.findById("1")    // "await" a fallible Effect
  return user.name
})
```

Reading tips:

- `function* ()` (generator syntax) plays the role of `async function`
- `yield*` plays the role of `await`
- When you `yield*` an `Effect.Effect<A, E, R>`, the `E` and `R` flow into the enclosing Effect's type parameters

These two snippets mean the same thing:

```ts
// Promise / async style
async function getUserName() {
  const user = await userService.findById("1")
  return user.name
}

// Effect style
const getUserName = Effect.gen(function* () {
  const user = yield* userService.findById("1")
  return user.name
})
```

## Returning an error through `yield*`

From `templates/default/src/users/service.live.ts`:

```ts
findById: (id) =>
  Effect.gen(function* () {
    if (id === "1") {
      return new UserResponse({ id: "1", name: "Alice", email: "alice@example.com" })
    }
    return yield* new UserNotFound({ userId: id })
  }),
```

- Return a normal value on success
- On failure, do `return yield* new ErrorClass(...)` (or `yield* Effect.fail(...)`) to push the value into the **error channel**
- `UserNotFound` is a `Schema.TaggedErrorClass` subclass — `yield*`-ing it is equivalent to `yield* Effect.fail(...)`

## Lifting synchronous code into Effect

| Task | API |
| --- | --- |
| Wrap a value as-is | `Effect.succeed(value)` |
| Push a value into the error channel | `Effect.fail(error)` |
| Wrap a sync function that may throw | `Effect.try({ try, catch })` |
| Wrap a function that returns a Promise | `Effect.tryPromise({ try, catch })` |

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

Writing raw `Promise` or `try-catch` is disallowed by sayo-ts (see the ESLint rules later).

## `Schema` — runtime validation + type derivation

Effect's `Schema` is a DSL where **one declaration yields both a TypeScript type and a runtime validator**. It replaces class-validator, class-transformer, and hand-maintained DTO classes/interfaces all at once.

```ts
import { Schema } from "effect"

// Instantiable class-backed schema
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

// Plain struct for input payloads
export const CreateUserRequest = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
})
export type CreateUserRequest = typeof CreateUserRequest.Type
```

| Use case | Recommendation |
| --- | --- |
| You want to `new X(...)` | `Schema.Class` |
| A plain data structure is enough | `Schema.Struct` |

See [07. Validation](./07-validation.md) for details.

## `Schema.TaggedErrorClass` — typed errors

Define domain errors with `Schema.TaggedErrorClass`:

```ts
import { Schema } from "effect"

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
  "UserNotFound",
  { userId: Schema.String },
) {}
```

These errors:

- Carry `_tag: "UserNotFound"`, so `switch (e._tag)` is exhaustive
- Surface in the `E` parameter of `Effect.Effect<A, E, R>`
- Are JSON-serializable and auto-converted into HTTP response bodies

See [06. Error Handling](./06-error-handling.md).

## How to actually run an Effect

In the sayo-ts template, Effects only run in two places.

### App startup (`src/main.ts`)

```ts
import { Layer } from "effect"
import { NodeRuntime } from "@effect/platform-node"

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
```

`Layer.launch` boots the Layer graph; `NodeRuntime.runMain` wires it to the Node.js lifecycle (SIGINT, etc.).

### Tests (`test/**/*.test.ts`)

```ts
await program.pipe(Effect.provide(TestLive), Effect.runPromise)
```

`Effect.runPromise` converts the Effect to a Promise so Vitest's `await` can drive it.

**Never call `Effect.runSync` / `runPromise` / `runFork` inside a handler** — it escapes the Fiber runtime and breaks error tracking and cancellation. The `@sayo-ts/no-run-sync-in-handler` rule enforces this.

## Why forbid `Promise` and `try-catch`?

`@sayo-ts/eslint-plugin` disallows `new Promise`, `Promise.resolve/reject/all/...`, and bare `try-catch`.

Reasons:

- Raw Promises never surface in `E`, so failure paths **fall out of the type system**
- `catch (e)` types `e` as `unknown` — the compiler cannot tell you what you just caught
- `Effect.tryPromise` / `Effect.try` let you return a typed `TaggedError` in the `catch` field so it ends up in `E`

If you must interoperate with an existing API that throws, wrap it in `Effect.tryPromise` or `Effect.try`. See [10. Conventions](./10-conventions.md).

## Summary

- Write business logic inside `Effect.gen(function*() { ... })`, using `yield*` to bind other Effects
- Define errors with `Schema.TaggedErrorClass` and push them into the error channel via `yield* new MyError(...)`
- Lift synchronous exceptions / Promises with `Effect.try` / `Effect.tryPromise`
- Effects run in exactly two places: `main.ts` (`Layer.launch`) and tests (`Effect.runPromise`)

### From the human-and-AI angle

Putting every failure in `E` and every dependency in `R` turns the type checker into **an additional reviewer**. Escaping into raw `Promise` or `try-catch` would hide failures from the type system; forbidding it is what makes "missing cases surface as build errors, whether a human or an AI wrote the code" a realistic baseline. See [A framework for humans and AI](./for-humans-and-ai.md).

Next: [03. Layer & DI](./03-layer-and-di.md) for dependency injection with `Context.Service` and `Layer`.
