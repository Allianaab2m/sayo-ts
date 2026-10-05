---
title: Principles
description: What sayo derives, what you declare, and what it deliberately leaves out.
---

1. **You write Schemas and UseCases. Everything else is derived.**
2. **Magic stays inside what the type checker can verify.** Registration is explicit and by value. Every derived result shows up in a type.
3. **You can use it without knowing Effect.** `Effect.gen` and `yield*` are enough. If you do know Effect, nothing is hidden from you: sayo generates plain `HttpApi`, `Layer`s and `Context.Service`s.
4. **The error channel carries only failures someone can act on.** Those are `Fault`s. Anything else is a defect and dies.
5. **Environment differences live in profiles.** Business logic never asks "am I running locally?".
6. **Declare only what is needed at runtime. Derive whatever the types already know.** Input, success and errors are needed at runtime (decoding, encoding, OpenAPI), so you declare them. Requirements, names, status codes and wiring are derived.

## Non-goals

- File-based routing
- Implicit caching
- An ORM or migration tool
- A frontend framework

## Open questions

- How input assembly resolves a field present in more than one of path, query and body
- What has to be declared so that in-memory implementations of a `Service` can be generated
- Whether lint rules are still worth shipping for what types cannot enforce (raw `Promise`, `try`/`catch`, `runSync` inside handlers)
