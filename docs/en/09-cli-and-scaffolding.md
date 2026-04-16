# 9. CLI & Scaffolding

What you will learn:

- What `create-sayo-app` does internally
- The six files `sayo generate <name>` produces
- The manual wiring you still need afterward (`api.ts` / `main.ts`)
- Rails / NestJS generator equivalents

Prerequisite chapters: [01. Getting Started](./01-getting-started.md)

---

## `create-sayo-app` — project generator

```bash
npx create-sayo-app my-project
```

Under the hood:

1. Creates `my-project/`
2. Copies `templates/default/`, filtering out `node_modules`, `dist`, `.turbo`
3. Rewrites `package.json` in the copy:
   - Sets `name` to `my-project`
   - Replaces `workspace:*` entries for `@sayo/eslint-plugin` with the released version (e.g. `^0.0.1`)
4. Runs `pnpm install`
5. Prints a completion message with next steps (`cd my-project`, `pnpm dev`, ...)

The result matches the layout described in [01. Getting Started](./01-getting-started.md).

## `sayo generate <name>` — resource scaffolding

```bash
npx sayo generate post
# or
npx sayo g post
```

One command scaffolds six files under `src/post/`.

| File | Role |
| --- | --- |
| `src/post/errors.ts` | `PostNotFound extends Schema.TaggedErrorClass` |
| `src/post/schemas.ts` | `PostResponse` (`Schema.Class`) and `CreatePostRequest` (`Schema.Struct`) |
| `src/post/service.ts` | `PostService extends Context.Service` with a `findById` method |
| `src/post/service.live.ts` | `PostServiceLive: Layer.Layer<PostService>` (TODO stub) |
| `src/post/api.ts` | `PostsGroup` with a `GET /posts/:id` endpoint |
| `src/post/handlers.ts` | `PostsHandlers` using `PostService` |

Naming conventions:

- The input (`post`) becomes **directory / variable / path names**
- PascalCase (`Post`) is used for **class / Schema / TaggedError names**

A generated `api.ts` looks roughly like:

```ts
// src/post/api.ts (generated)
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { PostResponse } from "./schemas.js"
import { PostNotFound } from "./errors.js"

const getPost = HttpApiEndpoint.get("getPost", "/posts/:id", {
  params: { id: Schema.String },
  success: PostResponse,
  error: PostNotFound.pipe(HttpApiSchema.status(404)),
})

export const PostsGroup = HttpApiGroup.make("Posts").add(getPost)
```

## Manual steps after scaffolding

The CLI scaffolds files only; **it does not wire them into the DI graph**. It prints hints when it finishes.

### 1) Add the group to `src/api.ts`

```ts
import { HttpApi } from "effect/unstable/httpapi"
import { UsersGroup } from "./users/api.js"
import { PostsGroup } from "./post/api.js"   // add

export const AppApi = HttpApi
  .make("AppApi")
  .add(UsersGroup)
  .add(PostsGroup)                            // add
```

### 2) Add handlers and live service to `src/main.ts`

```ts
import { UsersHandlers } from "./users/handlers.js"
import { UserServiceLive } from "./users/service.live.js"
import { PostsHandlers } from "./post/handlers.js"       // add
import { PostServiceLive } from "./post/service.live.js" // add

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(Layer.mergeAll(UsersHandlers, PostsHandlers)),  // mergeAll
)

const ServerLive = Served.pipe(
  Layer.provide(Layer.mergeAll(UserServiceLive, PostServiceLive)),  // mergeAll
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

### 3) Implement `service.live.ts`

The generated `PostServiceLive` always returns `PostNotFound`. Fill in the real logic:

```ts
export const PostServiceLive = Layer.effect(
  PostService,
  Effect.gen(function* () {
    const db = yield* Database   // for example, take a DB dependency
    return PostService.of({
      findById: (id) => db.queryPost(id),
    })
  }),
)
```

## Write tests alongside

The CLI doesn't scaffold tests yet. Copy the `test/users/` folder and rename the resource — the structure is stable.

## Rails / NestJS comparison

| Task | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| Project generation | `rails new app` | `nest new app` | `npx create-sayo-app app` |
| Resource scaffold | `rails g resource post title:string` | `nest g resource posts` | `npx sayo generate post` |
| Controller only | `rails g controller posts` | `nest g controller posts` | (manual; planned extension) |
| Migrations | `rails g migration ...` | (TypeORM, Prisma, ...) | (out of scope; pick any ORM) |

sayo-ts intentionally keeps its generators focused on **HTTP + Effect conventions** and stays out of the DB/ORM conversation.

## Summary

- `create-sayo-app` copies the template, patches `package.json`, and runs `pnpm install`
- `sayo generate <name>` creates six files (errors/schemas/service/service.live/api/handlers)
- You still need to **wire the new group into `api.ts` and `main.ts` manually**
- Copy `test/users/` as a starting point for tests

### From the human-and-AI angle

`sayo generate` always produces the same structure, which not only frees humans from relying on memory but also stops AI coding assistants from inventing "plausible" directory layouts or names. Running `sayo generate` first and then handing the result to an assistant is the easiest way to physically pin down conventions that are hard to fit in a prompt. See [A framework for humans and AI](./for-humans-and-ai.md).

Next: [10. Conventions & Lint](./10-conventions.md).
