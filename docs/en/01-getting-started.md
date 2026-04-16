# 1. Getting Started

What you will learn:

- What sayo-ts is (and is not)
- How to scaffold a new project with `create-sayo-app`
- How to run the dev server, tests, and build
- The layout of a generated project

Prerequisite chapters: none — start here.

---

## What sayo-ts is

sayo-ts is a **thin convention layer on top of Effect v4 `HttpApi`**.

It includes:

- `@sayo/eslint-plugin` — enforces conventions with ESLint rules
- `@sayo/cli` (`sayo`) — scaffolds resource modules
- `create-sayo-app` — project template generator
- `templates/default` — a sample app with full type-safe Layer composition

What sayo-ts is **not**:

- A wrapper or fork of `HttpApi`
- A custom routing engine
- An ORM or migration tool
- A frontend framework

Unlike Rails or NestJS, sayo-ts only layers **directory conventions, naming, and ESLint rules** on top of Effect v4. The runtime is just `effect` and `@effect/platform-node`.

## A shared foundation for humans and AI

The thread running through sayo-ts is that **the same standard should apply no matter who wrote the code**.

- Effect's type system rejects "missing dependencies, undeclared errors, and unimplemented endpoints" at build time
- `@sayo/eslint-plugin` mechanically catches the convention violations that keep coming up in review
- `Schema` collapses "TS type, runtime validator, OpenAPI schema, client type" into a single declaration
- `sayo generate` produces the same file layout every time

These mechanisms apply **equally well to human mistakes and AI hallucinations**. Regardless of author, a minimum level of correctness is guaranteed once `pnpm tsc --noEmit && pnpm lint && pnpm test` passes. See [A framework for humans and AI](./for-humans-and-ai.md) for the full picture.

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 18+ |
| TypeScript | 5.9+ |
| pnpm | 10.x |
| Effect | 4.x (beta) |

## Create a project

```bash
npx create-sayo-app my-project
cd my-project
pnpm dev       # dev server at http://localhost:3000
pnpm test      # Vitest
pnpm build     # tsc
```

`create-sayo-app` will:

1. Copy `templates/default` into `./my-project`
2. Set `package.json#name` to `my-project` and replace `workspace:*` with real versions
3. Run `pnpm install`

Once the server is up, visit `http://localhost:3000/docs` to see the Scalar OpenAPI UI.

## Project layout

```
my-project/
├── src/
│   ├── main.ts                  # Server startup + Layer composition
│   ├── api.ts                   # Top-level HttpApi
│   └── users/                   # One directory per resource
│       ├── errors.ts            # Schema.TaggedErrorClass
│       ├── schemas.ts           # Request / response schemas
│       ├── service.ts           # Context.Service (port)
│       ├── service.live.ts      # Layer (adapter)
│       ├── api.ts               # HttpApiGroup + HttpApiEndpoint
│       └── handlers.ts          # HttpApiBuilder.group handlers
├── test/
│   └── users/
│       ├── handlers.test.ts     # Integration tests via HttpApiClient
│       └── service.mock.ts      # Mock Layer
├── eslint.config.ts             # @sayo/eslint-plugin
├── tsconfig.json
└── package.json
```

Why this layout:

- **One directory per resource**: `users/`, `posts/`, etc. — one folder per bounded context. Think of it as bundling a Rails controller, model, and strong params together.
- **`service.ts` vs `service.live.ts`**: `service.ts` is the **port (interface)**; `service.live.ts` is the **adapter (implementation)**. Tests just `Layer.provide(UserServiceMock)` instead of `UserServiceLive`. See [03. Layer & DI](./03-layer-and-di.md).
- **`api.ts` vs `handlers.ts`**: `api.ts` is the HTTP contract; `handlers.ts` is the implementation. When you want to share the API types with a frontend, you can extract just `api.ts` into its own package.

## Comparison with other frameworks

| Task | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| New project | `rails new app` | `nest new app` | `npx create-sayo-app app` |
| Scaffold resource | `rails g resource user` | `nest g resource user` | `npx sayo generate user` |
| Dev server | `rails s` | `nest start --watch` | `pnpm dev` |
| Tests | `rspec` / `minitest` | `jest` | `pnpm test` (Vitest) |
| API docs | gem (rswag etc.) | `@nestjs/swagger` | `HttpApiScalar` (built-in) |

## Where to go next

If you are new to Effect, read [02. Effect Essentials](./02-effect-essentials.md) first.

If you already know Effect, jump to [03. Layer & DI](./03-layer-and-di.md).
