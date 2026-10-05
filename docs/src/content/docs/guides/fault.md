---
title: Fault
description: Failures someone can act on.
sidebar:
  order: 1
---

```ts
class TodoNotFound extends Fault.NotFound("TodoNotFound", { id: TodoId }) {}
// Fault.Invalid / Unauthorized / Forbidden / NotFound / Conflict / Unavailable
```

A `Fault` carries a kind, never an HTTP status. Each adapter maps kinds to its own vocabulary: the HTTP adapter maps `NotFound` to 404, `Conflict` to 409 and so on. Your domain stays free of transport concepts.

A failure that no layer can do anything about (a broken invariant, a malformed row, a missing config) is not a `Fault`. Use `Effect.die` with a tagged value; the platform turns it into a 500 and logs the full `Cause`.
