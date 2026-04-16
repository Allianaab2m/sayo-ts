# A Framework for Humans and AI

One of sayo-ts's core ideas is that **code should be judged by the same standard regardless of whether a human or an AI wrote it**.
As development practice shifts from solo authorship to pair work — and increasingly to three-way collaboration with coding agents — the value a framework can add is **a single definition of "correct" that doesn't depend on who wrote the code**.

This chapter explains, from one vantage point, **why the mechanisms sayo-ts already uses** (see [03. Layer & DI](./03-layer-and-di.md), [06. Error Handling](./06-error-handling.md), [10. Conventions & Lint](./10-conventions.md)) **benefit humans and AI equally**.

Prerequisite: skim [01. Getting Started](./01-getting-started.md) first.

---

## Background: the shared enemy is "implicit convention"

Every codebase accumulates rules that "everyone on the team knows but nothing in the code states." These implicit conventions are **the single biggest obstacle** for both new engineers and AI assistants:

- Newcomers spend their first weeks absorbing them
- AI coding assistants don't have access to them, so they produce **plausible but wrong** code (hallucinations)
- Reviewers repeat the same comments over and over

sayo-ts's response is simple: **stop relying on implicit conventions. Make them machine-readable via types and ESLint.** The benefit is the same whether the reader is a human or an agent.

---

## Mechanism 1: the type system is the first reviewer

Effect's `Effect.Effect<A, E, R>` tracks **success, failure, and dependencies** in the type. sayo-ts leans fully into this, so the following mistakes **fail at build time**:

- Forgetting `Layer.provide(UserServiceLive)` → build error (`UserService` remains in `R`)
- A handler throws an error that isn't declared in the endpoint's `error` → build error (handler `E` doesn't match `api.ts`)
- Some endpoint doesn't have a handler → build error (`HttpApiBuilder.group` is incomplete)
- `Effect.fail("string")` and other non-tagged errors → warning (`sayo/tagged-error-required`)

This catches human slips **and** AI hallucinations in exactly the same way. The type checker doesn't care who typed the code; it just rejects what doesn't fit.

Related: [02. Effect Essentials](./02-effect-essentials.md), [03. Layer & DI](./03-layer-and-di.md)

## Mechanism 2: conventions are expressed as ESLint rules

The seven rules in `@sayo/eslint-plugin` are patterns that "keep coming up in reviews" turned into machine-readable checks:

- `no-raw-promise` / `no-try-catch` / `no-run-sync-in-handler` — don't escape the Fiber runtime
- `tagged-error-required` — keep error design at the type level
- `endpoint-response-schema-required` / `endpoint-error-schema-required` — keep the API contract aligned with OpenAPI
- `service-interface-separation` — preserve the directory convention that makes mocking trivial

The payoff:

- **Humans**: stop repeating the same review comments
- **AI**: rules you couldn't fit in a prompt are **physically enforced after the fact** by `pnpm lint` (prompt brevity no longer trades off against safety)

Either way, **checking whether generated code follows the conventions no longer requires a human to think about it**.

Related: [10. Conventions & Lint](./10-conventions.md)

## Mechanism 3: one Schema, one source of truth

Effect's `Schema` ([07. Validation](./07-validation.md)) produces a TypeScript type, a runtime validator, an OpenAPI schema, and a client-side type **from a single declaration**.

One task AI assistants struggle with is **keeping the same contract in sync across multiple places**: DTO class + validation decorators + OpenAPI annotations + TS types + API client. Divergence creeps in easily.

In sayo-ts:

```ts
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}
```

This single declaration covers all four. **The source of divergence is removed**, so there's nothing for a human or an AI to get wrong.

Related: [07. Validation](./07-validation.md)

## Mechanism 4: the CLI provides deterministic scaffolding

`sayo generate <name>` ([09. CLI & Scaffolding](./09-cli-and-scaffolding.md)) always produces **the same six files with the same names** for any resource.

- **Humans**: start from the correct skeleton without relying on memory
- **AI**: no need to invent "plausible" directory structures. Continuing from a `sayo generate` output means **file placement and naming are already decided**

Just running `npx sayo generate X` as a first step brings AI-generated code into a predictable shape. That's more reliable than trying to cover file layout in a prompt.

Related: [09. CLI & Scaffolding](./09-cli-and-scaffolding.md)

## Mechanism 5: port/adapter separation makes swapping cheap

The `service.ts` (port) vs `service.live.ts` (adapter) split ([03. Layer & DI](./03-layer-and-di.md)) minimizes the cost of swapping implementations in tests.

- **Humans**: build mocks without touching production code
- **AI**: "write a new Layer that only swaps this one service" becomes a **fine-grained, natural request**. Production and test implementations are in separate files, so the chance of AI corrupting production code drops

Because test Layers have the same type `Layer.Layer<UserService>` as production, a mock that doesn't satisfy the interface won't compile. Another instance of the type system doing the refereeing.

Related: [03. Layer & DI](./03-layer-and-di.md), [08. Testing](./08-testing.md)

---

## Working with an AI assistant

sayo-ts is not tied to any particular AI tool. That said, the mechanisms above suggest a sensible workflow when collaborating with a coding assistant:

1. **Run `sayo generate` first, then hand the result to the assistant.**
   - Files are placed, named, and imported correctly; the assistant can focus on logic.
2. **Pin the contract in `api.ts` (top-level and per-resource) before anything else.**
   - Lock in `success` / `error` / `params` / `payload`; handler and service types follow from the contract.
3. **Let handlers stay as `Effect.gen` skeletons; the assistant just adds `yield*` lines.**
   - Any `Effect.runSync` / `try-catch` / raw Promise drift is caught by `pnpm lint`.
4. **Gate the change on `pnpm lint && pnpm tsc --noEmit && pnpm test`.**
   - Passing all three means a baseline of correctness is there, regardless of author.

If an assistant's output can't pass these three, the issue is rarely "more prompt context needed" — the rules are pointing at a **structural** problem: the code diverges from conventions.

---

## A shared checklist for humans and AI

When opening or merging a PR, the following checklist holds regardless of author:

- [ ] `pnpm tsc --noEmit` passes (no type errors)
- [ ] `pnpm lint` passes (no `@sayo/eslint-plugin` violations)
- [ ] `pnpm test` passes (including `NodeHttpServer.layerTest` integration tests)
- [ ] New resources are wired into `src/api.ts` and `src/main.ts`
- [ ] New error types use `Schema.TaggedErrorClass`
- [ ] New endpoints declare both `success` and `error`
- [ ] Service interfaces (`service.ts`) and implementations (`service.live.ts`) live in separate files

This list is designed to be **handed to a person or a coding agent without modification**. Feel free to copy it into `.github/pull_request_template.md` or `AGENTS.md`.

---

## Summary

sayo-ts is not "an AI-compatible framework". It is "**a framework whose conventions are machine-readable as types and lint rules**." The consequences:

- Humans spend less time teaching conventions orally or flagging them in review
- AI assistants get convention enforcement **after** generation, so short prompts don't mean unsafe output

**Both sides get judged by the same standard** — that's what a framework should offer in an era of human-AI collaboration on code.
