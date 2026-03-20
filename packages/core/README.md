# @sayo-ts/core

A TypeScript backend framework built entirely on Effect-TS.

## Installation

```bash
pnpm add @sayo-ts/core effect @effect/platform @effect/platform-node
```

## Quick Start

```typescript
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import { SayoApp } from "@sayo-ts/core"

class HelloGroup extends HttpApiGroup.make("hello").add(
  HttpApiEndpoint.get("hello")`/hello`.addSuccess(Schema.String)
) {}

class MyApi extends HttpApi.make("api").add(HelloGroup) {}

const HelloLive = HttpApiBuilder.group(MyApi, "hello", (handlers) =>
  handlers.handle("hello", () => Effect.succeed("Hello, sayo-ts!"))
)

const ApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(HelloLive))

SayoApp.make().addGroup(ApiLive).listen()
```

## Standard Error Types

```typescript
import { NotFound, Conflict, Unauthorized } from "@sayo-ts/core"

// HTTP status is automatically mapped when used with addError()
HttpApiEndpoint.get("getUser")`/users/${idParam}`
  .addSuccess(User)
  .addError(NotFound) // → 404
```

## License

MIT
