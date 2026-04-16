# 4. Endpoints & Handlers

What you will learn:

- The three-layer structure of `HttpApi` / `HttpApiGroup` / `HttpApiEndpoint`
- Every field you can declare on an endpoint (`params`, `payload`, `headers`, `success`, `error`, ...)
- How to implement handlers with `HttpApiBuilder.group`
- How to pull DI services inside a handler
- How OpenAPI docs are generated automatically

Prerequisite chapters: [03. Layer & DI](./03-layer-and-di.md)

---

## Three layers

sayo-ts splits HTTP definitions into **three levels**:

```
HttpApi ("AppApi")                 ← one per application
 └── HttpApiGroup ("Users")        ← one per resource (= NestJS @Controller)
      ├── HttpApiEndpoint "getUser" ← a single verb + path
      └── HttpApiEndpoint "createUser"
```

File mapping:

| Level | Typical location |
| --- | --- |
| `HttpApi` | `src/api.ts` |
| `HttpApiGroup` + `HttpApiEndpoint` | `src/<resource>/api.ts` |
| Handler implementations | `src/<resource>/handlers.ts` |

## A resource-level `api.ts`

From `templates/default/src/users/api.ts`:

```ts
import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi"
import { UserResponse, CreateUserRequest } from "./schemas.js"
import { UserNotFound, EmailAlreadyTaken } from "./errors.js"

const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
})

const createUser = HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,
  success: UserResponse,
  error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
})

export const UsersGroup = HttpApiGroup.make("Users")
  .add(getUser)
  .add(createUser)
```

### `HttpApiEndpoint` arguments

```
HttpApiEndpoint.<method>(name, path, spec)
```

- `method`: `get` / `post` / `put` / `patch` / `del` / `head` / `options`
- `name`: the handler name and the generated client method (e.g. `getUser` → `client.Users.getUser`)
- `path`: `/users/:id` style, with `:paramName` for path params
- `spec`: the endpoint contract

Fields of `spec`:

| Field | Type | Purpose |
| --- | --- | --- |
| `params` | `{ [key]: Schema }` | Schema for path params |
| `urlParams` | `Schema.Struct` | Schema for query string |
| `headers` | `Schema.Struct` | Schema for request headers |
| `payload` | `Schema` | Schema for request body (POST/PUT/PATCH) |
| `success` | `Schema` | Success response schema (**practically required**) |
| `error` | `Schema` / `Schema[]` | Error schema(s) |

### Attaching HTTP statuses to errors

```ts
error: UserNotFound.pipe(HttpApiSchema.status(404))
```

`HttpApiSchema.status(code)` lets the error class remain a **pure, HTTP-agnostic domain error** while giving the endpoint an HTTP representation.

You can also declare multiple errors via an array:

```ts
error: [
  UserNotFound.pipe(HttpApiSchema.status(404)),
  EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
]
```

See [06. Error Handling](./06-error-handling.md).

## The top-level `src/api.ts`

```ts
import { HttpApi } from "effect/unstable/httpapi"
import { UsersGroup } from "./users/api.js"

export const AppApi = HttpApi.make("AppApi").add(UsersGroup)
```

One `HttpApi` per application, accumulating one `HttpApiGroup` per resource:

```ts
import { PostsGroup } from "./posts/api.js"

export const AppApi = HttpApi
  .make("AppApi")
  .add(UsersGroup)
  .add(PostsGroup)
```

## Handler implementations: `HttpApiBuilder.group`

From `templates/default/src/users/handlers.ts`:

```ts
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { AppApi } from "../api.js"
import { UserService } from "./service.js"

export const UsersHandlers = HttpApiBuilder.group(
  AppApi,
  "Users",
  (handlers) =>
    handlers
      .handle("getUser", (req) =>
        Effect.gen(function* () {
          const service = yield* UserService
          return yield* service.findById(req.params.id)
        }),
      )
      .handle("createUser", (req) =>
        Effect.gen(function* () {
          const service = yield* UserService
          return yield* service.register(req.payload)
        }),
      ),
)
```

Reading it:

- `HttpApiBuilder.group(AppApi, "Users", builder => ...)` builds a handler Layer for the `"Users"` group of `AppApi`
- `builder.handle(name, fn)` implements one endpoint
  - `name` must match a name declared in `api.ts` (type-checked)
  - `fn: (req) => Effect.Effect<Success, Error, R>`
- `req.params` / `req.payload` / `req.urlParams` / `req.headers` are all already validated and typed
- Return a success value with `return yield*`; fail with `yield* new MyError(...)`

The `R` parameter of the returned Effect captures every service the handler needs. Because `UserService` is `yield*`'d, `R = UserService`, which must be satisfied upstream via `Layer.provide(UserServiceLive)` (see [03. Layer & DI](./03-layer-and-di.md)).

## What you may and may not do inside a handler

**OK**:

- `yield*` DI services
- `yield*` other Effects
- Return success values; fail with `yield* new Error()`
- Call `Effect.log(...)`

**Not OK**:

- `Effect.runSync` / `Effect.runPromise` / `Effect.runFork` (error: `sayo/no-run-sync-in-handler`)
- Raw `Promise` constructs (error: `sayo/no-raw-promise`)
- `try` / `catch` blocks (error: `sayo/no-try-catch`)

These would escape the Fiber runtime and break error tracking / cancellation propagation.

## OpenAPI docs (Scalar)

A single line in `main.ts` mounts a Scalar UI at `/docs`:

```ts
import { HttpApiScalar } from "effect/unstable/httpapi"

const Served = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive,
    HttpApiScalar.layer(AppApi, { path: "/docs" }),
  ),
)
```

- Your schemas (`params`, `payload`, `success`, `error`) are reflected directly into the OpenAPI document
- Endpoint names become operation IDs
- **If you omit `success` / `error`, the OpenAPI spec has holes** — that's why `endpoint-response-schema-required` and `endpoint-error-schema-required` are warnings

For Swagger UI, swap in `HttpApiSwagger.layer(AppApi, { path: "/swagger" })`.

## A type-safe client for free

The same `AppApi` can produce a client:

```ts
import { HttpApiClient } from "effect/unstable/httpapi"
import { AppApi } from "./api.js"

const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(AppApi)
  const user = yield* client.Users.getUser({ params: { id: "1" } })
  console.log(user.name)
})
```

- Naming: `client.<GroupName>.<EndpointName>(input)`
- Input / output types are fully inferred from the endpoint definitions
- If your frontend lives in the same repo, both sides of the wire share a single source of truth

Testing uses the same client (see [08. Testing](./08-testing.md)).

## Rails / NestJS comparison

| Concept | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| Route definition | `config/routes.rb` | `@Controller('users') @Get(':id')` | `HttpApiEndpoint.get("getUser", "/users/:id", ...)` |
| Controller | `UsersController` | `UsersController` class | `HttpApiBuilder.group(AppApi, "Users", ...)` |
| Input parsing | strong_parameters | `ValidationPipe` + DTO | `Schema` (`params`, `payload`, ...) |
| Response | `render json: user` | `return user` | `return userResponse` (`Schema.Class`) |
| API docs | gem (rswag, etc.) | `@nestjs/swagger` | `HttpApiScalar` (zero extra deps) |

## Summary

- `HttpApi` → `HttpApiGroup` → `HttpApiEndpoint`, three levels
- Declare the contract with `spec.params/payload/urlParams/headers/success/error`
- Map errors to HTTP statuses with `HttpApiSchema.status(code)`
- Implement with `HttpApiBuilder.group(AppApi, "Group", b => b.handle("name", fn))`
- Handlers return `Effect.gen` bodies; DI via `yield*`
- OpenAPI is generated automatically via `HttpApiScalar.layer`

### Related ESLint rules

- `sayo/endpoint-response-schema-required` (warn): missing `success`
- `sayo/endpoint-error-schema-required` (warn): missing `error`
- `sayo/no-run-sync-in-handler` (error): no `Effect.runXxx` inside handlers

Next: [05. Middleware](./05-middleware.md).
