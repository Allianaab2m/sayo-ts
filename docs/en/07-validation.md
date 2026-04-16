# 7. Validation & Schemas

What you will learn:

- `Schema.Struct` vs `Schema.Class`
- Writing request / response schemas
- Common refinements (string length, numeric ranges, regex, enums)
- How endpoint definitions produce a type-safe HTTP client
- Mapping to NestJS `ValidationPipe` / Rails `strong_parameters`

Prerequisite chapters: [02. Effect Essentials](./02-effect-essentials.md), [04. Endpoints & Handlers](./04-endpoints.md)

---

## What Schema gives you

Effect's `Schema` is a DSL where **one declaration produces both a TypeScript type and a runtime validator**. A single Schema covers:

- TypeScript type (`typeof schema.Type` / class types)
- JSON → value decoding (with validation)
- value → JSON encoding
- OpenAPI schema (reflected automatically into endpoint docs)

Compared to NestJS, Schema replaces `class-validator`, `class-transformer`, DTO classes, and interfaces in one go.

## `Schema.Struct` vs `Schema.Class`

### `Schema.Struct` — anonymous struct

```ts
import { Schema } from "effect"

export const CreateUserRequest = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
})
export type CreateUserRequest = typeof CreateUserRequest.Type
// { readonly name: string; readonly email: string }
```

- Plain POJO
- Good fit for DTOs, payloads, URL params

### `Schema.Class` — instantiable class

```ts
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

// Construct and use
const user = new UserResponse({ id: "1", name: "Alice", email: "alice@example.com" })
user.name // => "Alice"
```

- Constructible with `new UserResponse(...)`
- Good fit for response entities or domain objects
- You can add methods / getters in the class body

**Rule of thumb**:

| Use case | Recommendation |
| --- | --- |
| Bundle JSON fields | `Schema.Struct` |
| Something you return from a handler after `new ...` | `Schema.Class` |
| An error type | `Schema.TaggedErrorClass` (see [06. Error Handling](./06-error-handling.md)) |

## Using schemas on endpoints

```ts
// src/users/api.ts
import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"
import { UserResponse, CreateUserRequest } from "./schemas.js"

const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },   // path params
  success: UserResponse,
})

const createUser = HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,      // request body
  success: UserResponse,
})
```

By the time a handler runs, `req.params.id: string` and `req.payload: CreateUserRequest` are **already decoded and validated**. Invalid input returns 400 before your handler is even called.

## Refinements

Common combinators:

```ts
import { Schema } from "effect"

Schema.String.pipe(Schema.minLength(1))         // non-empty
Schema.String.pipe(Schema.maxLength(255))
Schema.String.pipe(Schema.pattern(/^\S+@\S+$/))
Schema.Number.pipe(Schema.int(), Schema.between(0, 120))
Schema.Literal("admin", "user", "guest")        // enum
Schema.Array(Schema.String)
Schema.optional(Schema.String)
Schema.Union(Schema.String, Schema.Number)
```

Putting them together:

```ts
export const CreateUserRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  email: Schema.String.pipe(Schema.pattern(/^[^@]+@[^@]+$/)),
  age: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 150))),
  role: Schema.Literal("admin", "user", "guest"),
})
```

All of this flows into the OpenAPI document as `minLength`, `maxLength`, `pattern`, `enum`, etc.

## Branded types (domain primitives)

```ts
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type   // string & Brand<"UserId">
```

Useful when you want to keep "a user id" separate from "a string". Assigning a plain `string` into a `UserId` parameter becomes a compile error.

## Nesting and composition

```ts
const Address = Schema.Struct({
  city: Schema.String,
  postalCode: Schema.String.pipe(Schema.pattern(/^\d{3}-\d{4}$/)),
})

export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  address: Address,
}) {}
```

## Removing fields / projecting on the response side

```ts
import { Schema } from "effect"

const PublicUser = UserResponse.pipe(
  Schema.omit("email"),   // drop email
)
```

Useful when different endpoints expose different views of the same resource.

## Client-side type derivation

Endpoint definitions let `HttpApiClient` infer **both ends**:

```ts
const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(AppApi)
  const user = yield* client.Users.getUser({ params: { id: "1" } })
  //                                              ^^^^^^ inferred from Schema
  //          ^^^^ return type inferred from Schema
})
```

No hand-written DTOs, no `@nestjs/swagger` build step.

## Rails / NestJS comparison

| Task | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| Input validation | `strong_parameters` | `ValidationPipe` + `class-validator` | Schema (`params`, `payload`) |
| Shared types | hand-written classes | DTO `class` + TypeScript | one Schema covers both |
| OpenAPI schema | gem (rswag etc.) | `@nestjs/swagger` decorators | generated from Schemas automatically |
| Invalid input | `before_action` rejects | 400 Bad Request | automatic 400 (`SchemaError`) |

## Shaping validation errors

By default, validation errors come back as `Schema.SchemaError`. To reshape them (prettier messages, custom fields), use `HttpApiMiddleware.layerSchemaErrorTransform` — see [05. Middleware, Example 3](./05-middleware.md#example-3-schemaerror--domain-error-transformation).

## Summary

- Data structures: `Schema.Struct`; entities: `Schema.Class`; errors: `Schema.TaggedErrorClass`
- Stack refinements with `.pipe` (`Schema.minLength`, `Schema.pattern`, ...)
- Put schemas in `params` / `payload` / ... and handlers receive already-decoded values
- One Schema powers both OpenAPI docs and the generated client

### From the human-and-AI angle

Writing the same contract in multiple places is the classic way for both humans and AI to produce inconsistent code. In sayo-ts, a single `Schema` determines the TS type, validator, OpenAPI schema, and client type simultaneously — **the source of divergence simply doesn't exist**. See [A framework for humans and AI](./for-humans-and-ai.md).

Next: [08. Testing](./08-testing.md) covers integration tests with `HttpApiClient` + `layerTest`.
