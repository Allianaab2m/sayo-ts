# sayo-ts Documentation (English)

sayo-ts is an opinionated backend framework built as a **convention layer on top of Effect v4 `HttpApi`**. The same way Rails brought conventions to Ruby and NestJS brought structure to Node.js, sayo-ts provides **directory conventions, scaffolding, and ESLint rules** for Effect v4.

## Guiding principle — a shared foundation for humans and AI

sayo-ts is built around one idea: **code should be judged by the same standard regardless of who wrote it**. As development shifts from solo work to collaboration with AI coding assistants, a framework's job changes:

- **Eliminate implicit conventions** — rules "the team knows but the code doesn't state" become **machine-readable** via Effect's types and `@sayo-ts/eslint-plugin`
- **One source of truth for each contract** — a single `Schema` produces TS types, a runtime validator, an OpenAPI schema, and a client type, so neither humans nor AI have room to diverge
- **Deterministic scaffolding** — `sayo generate` always produces the same files with the same names, so nobody has to rely on memory or guesses

See [A framework for humans and AI](./for-humans-and-ai.md) for the full picture.

## Table of Contents

1. [Getting Started](./01-getting-started.md) — install / run / project layout
2. [Effect Essentials](./02-effect-essentials.md) — `Effect.gen`, `yield*`, `Schema`, `TaggedError`
3. [Layer System & DI](./03-layer-and-di.md) — dependency injection via `Context.Service` + `Layer`
4. [Endpoints & Handlers](./04-endpoints.md) — `HttpApi` / `HttpApiGroup` / `HttpApiEndpoint`
5. [Middleware](./05-middleware.md) — auth / logging / error transform / CORS
6. [Error Handling](./06-error-handling.md) — `TaggedError` and HTTP status mapping
7. [Validation & Schemas](./07-validation.md) — runtime validation with `Schema`
8. [Testing](./08-testing.md) — `HttpApiClient` and `layerTest`
9. [CLI & Scaffolding](./09-cli-and-scaffolding.md) — `create-sayo-app` / `sayo generate`
10. [Conventions & Lint](./10-conventions.md) — `@sayo-ts/eslint-plugin`

Appendix: [A framework for humans and AI](./for-humans-and-ai.md) — the thread running through all of the above

## Mental model for Rails / NestJS users

| sayo-ts / Effect v4 | Rails | NestJS |
| --- | --- | --- |
| `Context.Service` + `Layer` | service object / DI gem | `@Injectable()` provider |
| `HttpApi` / `HttpApiGroup` | `config/routes.rb` + controller | `@Module` + `@Controller` |
| `HttpApiEndpoint.get/post/...` | `get "/users/:id"` + action | `@Get(':id')` |
| `HttpApiMiddleware` | Rack middleware / `before_action` | middleware / guard / interceptor / filter |
| `Schema.TaggedErrorClass` + `HttpApiSchema.status` | `rescue_from` + `render` | `HttpException` + `ExceptionFilter` |
| `Schema.Struct` / `Schema.Class` | `strong_parameters` | `class-validator` + `ValidationPipe` |
| `sayo generate <name>` | `rails generate resource` | `nest g resource` |
| `Layer.provide(Mock)` in tests | fixtures + test doubles | `overrideProvider()` |

## Prerequisites

- Node.js 18+
- TypeScript 5.9+
- pnpm 10.x
- Effect 4.x (beta)

For Effect itself, see the official documentation at [effect.website](https://effect.website).
