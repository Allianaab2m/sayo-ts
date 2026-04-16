# 5. Middleware

What you will learn:

- Declaring middleware with `HttpApiMiddleware.Service`
- Applying middleware to groups / endpoints
- Four worked examples: Bearer auth / request logging / `SchemaError` transformation / CORS & common headers
- Mapping to NestJS Guards / Interceptors / Filters

Prerequisite chapters: [04. Endpoints & Handlers](./04-endpoints.md), [03. Layer & DI](./03-layer-and-di.md)

---

## Two middleware layers

Middleware in Effect v4 `HttpApi` splits into **two layers**:

| Layer | Examples | Implementation |
| --- | --- | --- |
| HTTP layer (shared by all routes) | CORS, shared response headers, request logs | `HttpMiddleware.*` applied on `HttpRouter.serve` |
| HttpApi layer (per endpoint) | Auth, authorization, `SchemaError` shaping, per-endpoint metrics | `HttpApiMiddleware.Service` applied with `HttpApiGroup.middleware()` |

Mapping to NestJS:

| NestJS | sayo-ts |
| --- | --- |
| `Middleware` (Express layer) | `HttpMiddleware.*` |
| `Guard` (authorization) | `HttpApiMiddleware.Service` (with `security`) |
| `Interceptor` (wrapping / timing) | `HttpApiMiddleware.Service` (no security) |
| `ExceptionFilter` | `HttpApiMiddleware.layerSchemaErrorTransform` / error-channel transforms |

## Basic shape of an `HttpApiMiddleware.Service`

```ts
import { Effect, Layer } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

// 1) Middleware tag (also captures provides / error / security in its type)
export class RequestLogger extends HttpApiMiddleware.Service<RequestLogger>()(
  "RequestLogger",
) {}

// 2) Implementation layer
export const RequestLoggerLive = Layer.succeed(
  RequestLogger,
  // (httpEffect, { endpoint, group }) => Effect<HttpServerResponse, ...>
  (httpEffect, { endpoint, group }) =>
    Effect.gen(function* () {
      const start = Date.now()
      yield* Effect.log(`→ ${group.identifier}.${endpoint.name}`)
      const response = yield* httpEffect
      yield* Effect.log(`← ${group.identifier}.${endpoint.name} (${Date.now() - start}ms)`)
      return response
    }),
)
```

Key points:

- `HttpApiMiddleware.Service<Self>()("Id", options?)` creates **a DI tag that also captures configuration**
- `options?.error` / `options?.security` / `options?.requiredForClient` are available
- The implementation is `(httpEffect, { endpoint, group }) => Effect<HttpServerResponse, ...>`
- `yield* httpEffect` runs the wrapped handler; you can add logic before and after

## Applying middleware

Per group:

```ts
export const UsersGroup = HttpApiGroup.make("Users")
  .add(getUser)
  .add(createUser)
  .middleware(RequestLogger)   // applies to all endpoints in this group
```

Per API:

```ts
export const AppApi = HttpApi
  .make("AppApi")
  .add(UsersGroup)
  .middleware(RequestLogger)   // applies to all groups
```

> Note: `middleware()` only affects endpoints added **before** the call. Pay attention to order.

Wire the implementation Layer as usual in `main.ts`:

```ts
const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(RequestLoggerLive),  // new
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

---

## Example 1: Bearer authentication

Equivalent to a NestJS Guard.

### 1) Authentication failure error

```ts
// src/auth/errors.ts
import { Schema } from "effect"

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  { reason: Schema.String },
) {}
```

### 2) `CurrentUser` (authenticated user)

```ts
// src/auth/current-user.ts
import { Context } from "effect"

export class CurrentUser extends Context.Service<
  CurrentUser,
  { readonly id: string; readonly email: string }
>()("CurrentUser") {}
```

### 3) Middleware tag

```ts
// src/auth/middleware.ts
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi"
import { Unauthorized } from "./errors.js"

export class Authentication extends HttpApiMiddleware.Service<Authentication>()(
  "Authentication",
  {
    // Returned when token verification fails
    error: Unauthorized,
    // Adds a Bearer scheme to the OpenAPI document
    security: { bearer: HttpApiSecurity.bearer },
    // Declares this middleware provides CurrentUser downstream
    provides: CurrentUser,
  } as const,
) {}
```

> The generics of `HttpApiMiddleware.Service` track `provides` / `requires` / `error` / `security` — the type system knows the middleware extends downstream handlers with `CurrentUser`.

### 4) Implementation layer

```ts
// src/auth/middleware.live.ts
import { Effect, Layer } from "effect"
import { Authentication } from "./middleware.js"
import { CurrentUser } from "./current-user.js"
import { Unauthorized } from "./errors.js"

export const AuthenticationLive = Layer.succeed(
  Authentication,
  {
    bearer: (httpEffect, { credential }) =>
      Effect.gen(function* () {
        // `credential` is the bearer token string
        const user = yield* verifyToken(credential).pipe(
          Effect.mapError(() => new Unauthorized({ reason: "invalid token" })),
        )
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentUser, user),
        )
      }),
  },
)

const verifyToken = (token: string) =>
  Effect.tryPromise({
    try: () => jwtVerify(token),
    catch: () => new Unauthorized({ reason: "jwt verify failed" }),
  })
```

`Effect.provideService(CurrentUser, user)` injects `CurrentUser` into `httpEffect` (i.e. the wrapped handler).

### 5) Apply it

```ts
export const UsersGroup = HttpApiGroup.make("Users")
  .add(me)
  .add(getUser)
  .middleware(Authentication)
```

### 6) Read it from a handler

```ts
h.handle("me", () =>
  Effect.gen(function* () {
    const me = yield* CurrentUser   // authenticated user
    return new UserResponse({ id: me.id, name: "", email: me.email })
  }),
)
```

On the client side, pass `bearerToken: "..."` when constructing the client and the header is added automatically.

---

## Example 2: Request logging / timing

Equivalent to a NestJS Interceptor.

```ts
// src/infra/logging.ts
import { Effect, Layer } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

export class RequestTiming extends HttpApiMiddleware.Service<RequestTiming>()(
  "RequestTiming",
) {}

export const RequestTimingLive = Layer.succeed(
  RequestTiming,
  (httpEffect, { endpoint, group }) =>
    Effect.gen(function* () {
      const label = `${group.identifier}.${endpoint.name}`
      return yield* httpEffect.pipe(
        Effect.withLogSpan(label),
        Effect.tapErrorCause((cause) => Effect.logError(`[${label}] failed`, cause)),
        Effect.onExit((exit) =>
          Effect.log(`[${label}] exit=${exit._tag}`),
        ),
      )
    }),
)
```

Apply it to the entire API:

```ts
export const AppApi = HttpApi.make("AppApi")
  .add(UsersGroup)
  .middleware(RequestTiming)
```

---

## Example 3: `SchemaError` → domain error transformation

The NestJS Exception Filter / Rails `rescue_from` analogue. Useful for shaping validation errors into app-specific responses.

Effect ships a helper: `HttpApiMiddleware.layerSchemaErrorTransform`.

```ts
// src/infra/error-handling.ts
import { Effect, Schema } from "effect"
import { HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi"

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    issues: Schema.Array(Schema.String),
  },
) {}

export class ErrorHandler extends HttpApiMiddleware.Service<ErrorHandler>()(
  "ErrorHandler",
  { error: ValidationError.pipe(HttpApiSchema.status(400)) },
) {}

export const ErrorHandlerLive = HttpApiMiddleware.layerSchemaErrorTransform(
  ErrorHandler,
  (schemaError) =>
    Effect.fail(
      new ValidationError({
        message: "Request validation failed",
        issues: schemaError.issues.map((i) => i.message),
      }),
    ),
)
```

`layerSchemaErrorTransform` builds a Layer that "**whenever a `SchemaError` occurs, run this transform**". Apply it like any other middleware: `HttpApi.middleware(ErrorHandler)`.

---

## Example 4: CORS / common headers (HTTP layer)

`HttpApiMiddleware` is per endpoint. For **Express-style global middleware** use `HttpMiddleware`.

```ts
import { Effect, Layer } from "effect"
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/unstable/http"

// 1) CORS
const CorsLive = HttpMiddleware.cors({
  allowedOrigins: ["https://example.com"],
  allowedMethods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
})

// 2) Attach X-Request-Id on every response
const RequestIdLive = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const requestId = crypto.randomUUID()
    const response = yield* app
    return HttpServerResponse.setHeader(response, "x-request-id", requestId)
  }),
)

const ServedWithCommonMiddleware = HttpRouter.serve(
  Layer.mergeAll(ApiLive, HttpApiScalar.layer(AppApi, { path: "/docs" })),
  HttpMiddleware.make((app) => app),   // a placeholder if you want to pin ordering
).pipe(
  Layer.provide(CorsLive),
  Layer.provide(RequestIdLive),
)
```

> `HttpMiddleware` and `HttpApiMiddleware` are **different layers**. The former is router-level and global; the latter is endpoint-level with extra features (service injection, typed errors, security integration).

---

## Picking the right tool

- **Applies to everything and only needs request-level info (IP, Method, ...)** → `HttpMiddleware`
- **Per endpoint / injects a service into handlers / declares typed errors** → `HttpApiMiddleware`

Authentication, which wants handlers to `yield* CurrentUser`, is always `HttpApiMiddleware`.

## Summary

- Middleware has **two tiers**: router-level (`HttpMiddleware`) and API-level (`HttpApiMiddleware`)
- Declare tags with `HttpApiMiddleware.Service<Self>()("Id", options)`; implement with `Layer.succeed(Tag, fn)`
- Apply via `HttpApiGroup.middleware(Tag)` or `HttpApi.middleware(Tag)`
- Auth uses `options.security` + `provides` to inject `CurrentUser` into handlers
- Use `HttpApiMiddleware.layerSchemaErrorTransform` to shape `SchemaError`
- Use `HttpMiddleware.cors` / `HttpMiddleware.make` at `HttpRouter.serve` for CORS and shared headers

### Rails / NestJS equivalents

- NestJS: Middleware (HTTP) / Guard (authz) / Interceptor (wrapping) / ExceptionFilter (errors)
- Rails: Rack middleware / `before_action` / `around_action` / `rescue_from`

Next: [06. Error Handling](./06-error-handling.md).
