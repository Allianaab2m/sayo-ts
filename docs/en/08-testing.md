# 8. Testing

What you will learn:

- Minimal Vitest setup
- In-process HTTP tests via `NodeHttpServer.layerTest`
- Using a type-safe client with `HttpApiClient.make(AppApi)`
- The `service.mock.ts` pattern for swapping services
- Asserting failures with `Effect.exit`

Prerequisite chapters: [03. Layer & DI](./03-layer-and-di.md), [04. Endpoints & Handlers](./04-endpoints.md)

---

## Setup

`templates/default` uses Vitest; no extra configuration is needed.

```json
// package.json (excerpt)
{
  "scripts": {
    "test": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

## Assembling the test stack

`test/users/handlers.test.ts` is the canonical example:

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

// provideMerge keeps the HttpClient visible to the test body
const TestLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(UserServiceMock),
  Layer.provideMerge(NodeHttpServer.layerTest),
)
```

### The test Layer differs from production by two lines

Compared with `main.ts`:

1. `UserServiceLive` → `UserServiceMock`
2. `NodeHttpServer.layer` → `NodeHttpServer.layerTest`

Everything else is the same. **There is no special "testing framework"** to learn on top of the main composition style.

### Why `provideMerge` is required

`Layer.provide(NodeHttpServer.layer(...))` would absorb the layer and hide its services. But the test body wants to `yield* HttpApiClient.make(...)`, which needs the HttpClient provided by the test server. `Layer.provideMerge` provides-and-re-exports so it stays reachable.

## Mock Layers (`service.mock.ts`)

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

Highlights:

- Type `Layer.Layer<UserService>` is identical to the production one
- **If the mock does not satisfy the interface, the compile fails** — add a new method to the service and any tests missing it will immediately complain
- No `vi.mock` magic: the mock is a normal value you swap in

## Writing tests

### Happy path

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

- `HttpApiClient.make(AppApi)` produces a fully typed client
- `client.Users.getUser({ params: { id: "test-1" } })` **actually makes an HTTP call** (in-process)
- The return value is typed as `UserResponse`

### Failure path

Failures are values. Lift them with `Effect.exit`:

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

For more precise assertions:

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
      // error.value is typed as UserNotFound
    }
  })

  await program.pipe(Effect.provide(TestLive), Effect.runPromise)
})
```

### POST / payloads

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

## Unit tests vs integration tests

Both are supported.

### Unit tests (service-level)

```ts
it("findById returns Alice for id=1", async () => {
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

- Bypasses the HTTP layer
- Useful for focused business logic tests

### Integration tests (end-to-end through HTTP)

The `NodeHttpServer.layerTest` pattern above. **Recommended** — it exercises routing, schema validation, and error mapping together.

## Rails / NestJS comparison

| | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| Runner | RSpec / minitest | Jest | Vitest |
| Integration tests | request specs | supertest | `HttpApiClient` + `layerTest` |
| Dependency mocking | factory_bot + stubs | `overrideProvider()` | `Layer.provide(ServiceMock)` |
| Type benefits | none (dynamic) | partial (DI container types) | **types check requests, responses, and mocks** |

## Summary

- Build the test stack with `NodeHttpServer.layerTest` + `Layer.provideMerge`
- Swap `UserServiceLive` for `UserServiceMock` and nothing else changes
- Mock Layers fail compilation if the interface is not satisfied
- Use `Effect.exit` to assert failures as values
- Production `main.ts` and test `TestLive` share the same composition style

Next: [09. CLI & Scaffolding](./09-cli-and-scaffolding.md).
