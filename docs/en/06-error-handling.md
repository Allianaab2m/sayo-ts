# 6. Error Handling

What you will learn:

- Defining domain errors with `Schema.TaggedErrorClass`
- How the `E` parameter of `Effect` propagates
- Mapping errors to HTTP statuses via `HttpApiSchema.status(code)`
- Declaring multiple error variants
- Differences from Rails `rescue_from` / NestJS `ExceptionFilter`

Prerequisite chapters: [02. Effect Essentials](./02-effect-essentials.md), [04. Endpoints & Handlers](./04-endpoints.md)

---

## Express domain errors with Tagged Classes

In sayo-ts, every error is defined as a subclass of `Schema.TaggedErrorClass` (enforced by `@sayo-ts/tagged-error-required`).

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

A `TaggedErrorClass`:

- Has `_tag: "UserNotFound"` — you can branch exhaustively with `switch (e._tag)`
- Declares its fields as Schemas, so JSON serialization and HTTP body conversion are automatic
- When returned to the error channel (`Effect.fail(new UserNotFound(...))`), shows up in the `E` parameter of `Effect.Effect<A, E, R>`

## Type-level propagation

```ts
findById: (id: string) =>
  Effect.Effect<UserResponse, UserNotFound>
  //                           ^^^^^^^^^^^ this becomes E
```

The handler that uses it inherits this `E`:

```ts
h.handle("getUser", (req) =>
  Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById(req.params.id)
    // Effect.E = UserNotFound
  }),
)
```

If you forget to declare `UserNotFound` in the endpoint's `error`, the build fails:

```ts
const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
  //     ^^^^^^^^^^^ must match what the handler can throw
})
```

That's how sayo-ts achieves **exhaustive error handling verified at compile time**, something neither Rails nor stock NestJS can fully guarantee.

## HTTP status mapping: `HttpApiSchema.status`

Keep the error class HTTP-agnostic and attach the status at the endpoint:

```ts
error: UserNotFound.pipe(HttpApiSchema.status(404))
```

Defaults:

| Situation | Status |
| --- | --- |
| `success` returned | 200 (for POST set `HttpApiSchema.status(201)` on `success` if you want 201) |
| Error matches `error` | The code you declared (defaults to 500) |
| Validation error (`Schema.SchemaError`) | 400 (customize via the `layerSchemaErrorTransform` trick in [05. Middleware](./05-middleware.md)) |

## Declaring multiple errors

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

Given an array, any of the variants is accepted. The `HttpApiClient`'s return type surfaces all variants as a discriminated union.

## Client-side error handling

With `HttpApiClient.make(AppApi)`, errors come back on the Effect error channel:

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

- `Effect.catchTag("UserNotFound", fn)` catches a single tag
- `Effect.catchTags({ UserNotFound: fn1, EmailAlreadyTaken: fn2 })` handles several in one go

Think `rescue UserNotFound => e` in Rails — only here exhaustiveness is checked by the compiler.

## Asserting failures in tests

In Effect, failures are values. Use `Effect.exit` to get an `Exit<A, E>` and then assert:

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

See [08. Testing](./08-testing.md).

## Transforming errors inside a handler

```ts
h.handle("getUser", (req) =>
  Effect.gen(function* () {
    const service = yield* UserService
    return yield* service.findById(req.params.id).pipe(
      Effect.mapError(() =>
        new UserNotFound({ userId: req.params.id }),
      ),
    )
  }),
)
```

- `Effect.mapError(fn)` rewrites `E`
- `Effect.catchAll(fn)` intercepts every error and returns a different Effect
- `Effect.catchTag(tag, fn)` / `Effect.catchTags({})` for tag-specific branching

## Rails / NestJS comparison

| | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| Error types | exception classes | `HttpException` subclasses | `Schema.TaggedErrorClass` |
| Status mapping | `rescue_from ... with: :method` | `@HttpCode` / filters | `HttpApiSchema.status(code)` |
| Exhaustiveness | runtime only | partial (TS doesn't track `throw`) | **100% at compile time** |
| Client-side types | hand-written | generated from `@nestjs/swagger` | derived directly from `AppApi` |

## Summary

- Define errors as `Schema.TaggedErrorClass` (`@sayo-ts/tagged-error-required` enforces it)
- Every error a handler can raise **must** be declared on the endpoint's `error`
- Pair errors with `.pipe(HttpApiSchema.status(code))` to set the HTTP status
- Errors flow through the Effect `E` parameter with full exhaustiveness checks
- Reshape them with `Effect.catchTag`, `catchTags`, or `mapError`

### Related ESLint rules

- `@sayo-ts/tagged-error-required` (warn): no `Effect.fail("string")` or `new Error()`
- `@sayo-ts/endpoint-error-schema-required` (warn): missing `error` on an endpoint

Next: [07. Validation](./07-validation.md) dives into `Schema`.
