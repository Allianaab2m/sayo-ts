---
title: UseCase
description: The unit of business logic.
sidebar:
  order: 2
---

```ts
const InviteMember = UseCase.make({
  input: { projectId: ProjectId, email: Email },
  success: Invitation,
  errors: [ProjectNotFound, NotProjectOwner, AlreadyMember],
})(function* ({ projectId, email }) {
  const { user } = yield* CurrentUser // needing an authenticated user shows up in the requirements
  const now = yield* DateTime.now
  // ...
})
```

The body is a plain `Effect.fn`.

## Errors and success are checked

`errors` and `success` are checked against the body in both directions:

```ts
const CompleteTodo = UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound],
})(function* ({ id }) {
//~~~~~~~~~~~~~~~~~~~
// Property '"Fault AlreadyDone is not declared in errors"' is missing ...
  // ...
  if (todo.done) return yield* new AlreadyDone()
})
```

The other direction is checked too: a declared error that the body can never fail with is reported as `Fault X is declared in errors but never raised`, so your OpenAPI never documents a 404 that cannot happen. Errors that are not Faults (`Error X is not a Fault. Map it to a Fault, or die`) and a return value that does not match `success` are rejected the same way. In practice you copy the list the compiler gives you.

## Names

A UseCase needs no name. It gets one from where it is registered (`todos.complete`). Pass `name` only when it has to stay stable across refactors, for example when it is exposed over RPC:

```ts
UseCase.make({ name: "CompleteTodo", input, success, errors })
```

## Contract and implementation

Contract and implementation can be split, so a frontend imports the contract without pulling server code into its bundle:

```ts
// contract.ts: shared with the frontend
export const InviteMember = UseCase.contract({ input, success, errors })

// server.ts
export const InviteMemberLive = InviteMember.implement(function* (input) { /* ... */ })
```
