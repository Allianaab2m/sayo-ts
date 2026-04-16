# 3. The Layer System & DI

What you will learn:

- Declaring an interface with `Context.Service`
- Providing an implementation with `Layer.succeed` / `Layer.effect`
- The difference between `Layer.provide`, `Layer.mergeAll`, and `Layer.provideMerge`
- Why `service.ts` and `service.live.ts` are separate files
- How `main.ts` composes the full Layer graph
- Why swapping `UserServiceLive` for `UserServiceMock` "just works" in tests

Prerequisite chapters: [02. Effect Essentials](./02-effect-essentials.md)

---

## One-line summary for Rails / NestJS users

| | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| Interface | (no explicit concept) | `interface UserRepository` | `class UserService extends Context.Service<...>()("UserService") {}` |
| Implementation | `UsersRepository < ApplicationRecord` | `@Injectable() class UserRepositoryImpl` | `const UserServiceLive = Layer.succeed(UserService, impl)` |
| Injection | implicit constant lookup | `constructor(private repo: UserRepository)` | `const svc = yield* UserService` |
| Module wiring | (autoloading) | `@Module({ providers: [...] })` | `Layer.provide` / `Layer.mergeAll` |

Effect's key property is that the **DI container is the type system itself**. The runtime (`Layer`) and the type system (`Requirements`) see the same dependency graph — missing wires fail at build time.

## Port and adapter: `service.ts` / `service.live.ts`

From `templates/default/src/users/service.ts`:

```ts
import { Context, Effect } from "effect"
import type { UserResponse, CreateUserRequest } from "./schemas.js"
import type { UserNotFound, EmailAlreadyTaken } from "./errors.js"

export class UserService extends Context.Service<
  UserService,
  {
    readonly findById: (id: string) => Effect.Effect<UserResponse, UserNotFound>
    readonly register: (input: CreateUserRequest) => Effect.Effect<UserResponse, EmailAlreadyTaken>
  }
>()("UserService") {}
```

Highlights:

- `Context.Service<Self, Shape>()("TagName")` declares "**this is the tag you pull out of the DI container**"
- `Shape` is strictly the method signatures — no implementation details
- Nothing about databases, HTTP clients, or caches appears here (= a pure port)

The implementation lives in a separate file (`service.live.ts`):

```ts
import { Effect, Layer } from "effect"
import { UserService } from "./service.js"
import { UserNotFound, EmailAlreadyTaken } from "./errors.js"
import { UserResponse } from "./schemas.js"

export const UserServiceLive: Layer.Layer<UserService> = Layer.succeed(
  UserService,
  UserService.of({
    findById: (id) =>
      Effect.gen(function* () {
        if (id === "1") {
          return new UserResponse({ id: "1", name: "Alice", email: "alice@example.com" })
        }
        return yield* new UserNotFound({ userId: id })
      }),

    register: (input) =>
      Effect.gen(function* () {
        if (input.email === "taken@example.com") {
          return yield* new EmailAlreadyTaken({ email: input.email })
        }
        return new UserResponse({ id: crypto.randomUUID(), name: input.name, email: input.email })
      }),
  }),
)
```

- `Layer.succeed(Tag, impl)` produces "a Layer that provides this Tag with this implementation"
- `UserService.of({...})` is a type-checked helper for building an object that matches the interface
- The return type `Layer.Layer<UserService>` reads "a Layer that **provides** `UserService`, with no further requirements"

Keeping `service.ts` (port) and `service.live.ts` (adapter) in separate files is enforced by the `sayo/service-interface-separation` rule — the split makes swapping implementations in tests effortless.

## `Layer.Layer<Provides, E, Requires>`

A `Layer`'s type parameters are:

```ts
Layer.Layer<Provides, E, Requires>
//           │       │   └─ other services needed to build this layer
//           │       └───── errors that may occur while building it
//           └───────────── services this layer provides
```

- `Requires = never` → a self-contained, portable unit
- `Requires` non-empty → a layer that depends on other layers

```ts
// Provides UserService and depends on nothing else
const UserServiceLive: Layer.Layer<UserService>

// Provides UserService but needs Database to be built
const UserServiceWithDbLive: Layer.Layer<UserService, never, Database>
```

## When construction needs other services: `Layer.effect`

```ts
import { Effect, Layer } from "effect"
import { UserService } from "./service.js"
import { Database } from "../infra/database.js"

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Database   // pull in a dependency at construction time
    return UserService.of({
      findById: (id) => db.queryUser(id),
      register: (input) => db.insertUser(input),
    })
  }),
)
// Type: Layer.Layer<UserService, never, Database>
```

## Composition: `provide`, `mergeAll`, `provideMerge`

Walking through `src/main.ts` from the template:

```ts
import { Layer } from "effect"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { createServer } from "node:http"
import { AppApi } from "./api.js"
import { UsersHandlers } from "./users/handlers.js"
import { UserServiceLive } from "./users/service.live.js"

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)

const Served = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive,
    HttpApiScalar.layer(AppApi, { path: "/docs" }),
  ),
)

const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
```

### 1) `Layer.provide(child)` — satisfy a dependency with a child Layer

```ts
const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)
```

`HttpApiBuilder.layer(AppApi)` requires **the handlers for every endpoint** — `UsersHandlers` provides them via `Layer.provide`.

Mental model: `parent.provide(child)` = "child hands the parent the dependency it wanted."

### 2) `Layer.mergeAll([a, b, ...])` — parallel composition

```ts
const Served = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive,
    HttpApiScalar.layer(AppApi, { path: "/docs" }),
  ),
)
```

`mergeAll` unions independent Layers without introducing dependencies. Here it combines the real API with the Scalar docs UI mounted at `/docs`.

### 3) Peel off remaining dependencies one at a time

```ts
const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

- `Served` needs `UserService` (handlers demand it) → satisfied by `UserServiceLive`
- Finally, plug in the real HTTP server

Each `Layer.provide` is type-checked. Deleting `UserServiceLive` fails the build.

### 4) `Layer.provideMerge` — the test idiom

In `test/users/handlers.test.ts`:

```ts
const TestLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(UserServiceMock),
  Layer.provideMerge(NodeHttpServer.layerTest),
)
```

| API | Behavior |
| --- | --- |
| `Layer.provide(child)` | Child is absorbed by the parent and hidden from callers |
| `Layer.provideMerge(child)` | Child is absorbed **and** its services remain visible on the outside |

`NodeHttpServer.layerTest` provides an `HttpClient` that the test body needs (`yield* HttpApiClient.make(AppApi)`), so it must stay externally visible — hence `provideMerge`.

## `Layer.launch` — booting the graph

`Layer.launch(ServerLive)`:

1. Requires `ServerLive: Layer.Layer<never>` (no outstanding dependencies) at the type level
2. Builds the inner layers in the right order
3. Manages Scopes (lifetimes) along the dependency graph
4. Tears them down in reverse on shutdown

Pair it with `NodeRuntime.runMain` for graceful shutdown on SIGINT and friends.

## DI from the handler side

Once the Layers are composed, a handler just `yield*`s services:

```ts
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { UserService } from "./service.js"

export const UsersHandlers = HttpApiBuilder.group(AppApi, "Users", (h) =>
  h.handle("getUser", (req) =>
    Effect.gen(function* () {
      const service = yield* UserService            // DI
      return yield* service.findById(req.params.id)
    }),
  ),
)
```

`yield* UserService` is typed as `Effect.Effect<UserService["Shape"], never, UserService>`. The requirement surfaces in `R`, so forgetting to wire `UserServiceLive` upstream fails the build.

## Scaling to many services

Conventions as the app grows:

- Keep `service.ts` + `service.live.ts` per resource
- Put shared infrastructure (DB, Logger, Config) under `src/infra/`
- In `main.ts`, union all "Live"s with `Layer.mergeAll` and connect with `Layer.provide`

```ts
const AppLive = Layer.mergeAll(
  UsersHandlers,
  PostsHandlers,
)

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(Layer.provide(AppLive))

const InfraLive = Layer.mergeAll(
  UserServiceLive,
  PostServiceLive,
  DatabaseLive,
)

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(InfraLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

## Summary

- `Context.Service` = DI tag (port)
- `Layer.succeed(Tag, impl)` / `Layer.effect(Tag, buildEffect)` = implementation (adapter)
- `Layer.provide(child)` = satisfy a parent's dependency with a child
- `Layer.mergeAll([...])` = parallel union of independent Layers
- `Layer.provideMerge(child)` = `provide` + keep the child visible externally (common in tests)
- `Layer.launch(ServerLive)` = run the composed graph
- Keep `service.ts` and `service.live.ts` separate so tests can swap Layers without friction

### Related ESLint rules

- `sayo/service-interface-separation` (warn): defining a `Context.Service` and its `Layer` in the same file triggers a warning

### Rails / NestJS equivalents

- NestJS: `@Injectable()` + `@Module({ providers: [...] })`
- Rails: no explicit DI — autoloading plus constant references

Next: [04. Endpoints & Handlers](./04-endpoints.md).
