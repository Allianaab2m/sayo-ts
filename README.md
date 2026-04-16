# sayo-ts

An opinionated application convention layer for Effect v4 HttpApi. Like Rails brought conventions to Ruby, sayo brings conventions to Effect v4 HttpApi for building backend applications.

## What this is

- A set of ESLint rules that enforce architectural conventions
- A CLI for project generation and scaffolding
- A template app demonstrating best practices with full type-safe Layer composition

## What this is NOT

- Not a wrapper or fork of HttpApi
- Not a custom routing engine
- Not an ORM or migration tool
- Not a frontend framework

## Quick Start

```bash
npx create-sayo-app my-project
cd my-project
pnpm dev       # Start development server on http://localhost:3000
pnpm test      # Run tests
pnpm build     # Build for production
```

## Project Structure

```
my-project/
├── src/
│   ├── main.ts                  # Server startup with Layer composition
│   ├── api.ts                   # Top-level HttpApi definition
│   └── users/
│       ├── errors.ts            # Schema.TaggedErrorClass definitions
│       ├── schemas.ts           # Request/response schemas
│       ├── service.ts           # Context.Service interface (port)
│       ├── service.live.ts      # Layer implementation (adapter)
│       ├── api.ts               # HttpApiGroup + HttpApiEndpoint
│       └── handlers.ts          # HttpApiBuilder.group handlers
├── test/
│   └── users/
│       ├── handlers.test.ts     # API tests with HttpApiClient
│       └── service.mock.ts      # Mock Layer for testing
└── eslint.config.ts             # @sayo/eslint-plugin
```

## Scaffolding

Generate a new resource module:

```bash
npx sayo generate <name>
```

This creates the full directory structure with all files following the conventions.

## ESLint Rules

The framework's conventions are enforced through ESLint rules in `@sayo/eslint-plugin`:

| Rule | Severity | Purpose |
|------|----------|---------|
| `sayo/no-raw-promise` | error | Use `Effect.tryPromise()` instead of raw Promise |
| `sayo/no-try-catch` | error | Use `Effect.try()` / `Effect.fail()` instead of try-catch |
| `sayo/tagged-error-required` | warn | Use `Schema.TaggedErrorClass` for typed errors |
| `sayo/endpoint-response-schema-required` | warn | Endpoints must declare response schemas |
| `sayo/endpoint-error-schema-required` | warn | Endpoints should declare error schemas |
| `sayo/no-run-sync-in-handler` | error | Don't call `Effect.runSync` inside handlers |
| `sayo/service-interface-separation` | warn | Separate service interface from implementation |

Usage in `eslint.config.ts`:

```typescript
import tsParser from "@typescript-eslint/parser"
import sayo from "@sayo/eslint-plugin"

export default [
  { files: ["**/*.ts"], languageOptions: { parser: tsParser } },
  sayo.configs.recommended,
]
```

## Error-to-Status Mapping

Use `HttpApiSchema.status` to annotate errors with HTTP status codes directly at the endpoint:

```typescript
import { HttpApiSchema } from "effect/unstable/httpapi"

class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
  "UserNotFound", { userId: Schema.String }
) {}

const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
})
```

Error classes stay free of HTTP concepts. Status codes are declared at the endpoint boundary where they belong.

## Server Startup

Layer composition is done directly using Effect v4 APIs, preserving full type safety:

```typescript
import { Layer } from "effect"
import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { createServer } from "node:http"

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)

const Served = HttpRouter.serve(
  Layer.mergeAll(ApiLive, HttpApiSwagger.layer(AppApi, { path: "/docs" })),
)

const ServerLive = Served.pipe(Layer.provide(UserServiceLive)).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLive as Layer.Layer<never>).pipe(NodeRuntime.runMain)
```

Each `Layer.provide` step is type-checked — removing a required service causes a compile error.

## Testing

Use direct Layer composition with `NodeHttpServer.layerTest` for integration tests:

```typescript
const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)

const TestLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(UserServiceMock),
  Layer.provideMerge(NodeHttpServer.layerTest),
)

it("should get a user", async () => {
  const program = Effect.gen(function* () {
    const client = yield* HttpApiClient.make(AppApi)
    const user = yield* client.Users.getUser({ params: { id: "1" } })
    expect(user.name).toBe("Alice")
  })
  await program.pipe(Effect.provide(TestLive), Effect.runPromise)
})
```

Swap `UserServiceLive` for `UserServiceMock` — the Layer type system ensures the mock matches the interface.

## Effect v4 Concepts You Need

sayo builds on these 5 Effect v4 concepts:

1. **`Effect.gen` + `yield*`** — Async/error-tracked computations
2. **`Context.Service`** — Dependency injection interfaces
3. **`Layer`** — Dependency wiring and composition
4. **`Schema`** — Runtime validation with static types
5. **`HttpApi`** — Type-safe HTTP API definition

See the [Effect v4 documentation](https://effect.website) for details.

## Packages

| Package | Description |
|---------|-------------|
| `@sayo/eslint-plugin` | Convention enforcement via ESLint rules |
| `@sayo/cli` | Scaffolding commands |
| `create-sayo-app` | Project generator |

## Requirements

- TypeScript 5.9+
- Node.js 18+
- effect 4.x (beta)
- pnpm 10.x
