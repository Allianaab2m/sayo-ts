---
title: Testing
description: Testing UseCases and the whole API.
sidebar:
  order: 8
---

## A single UseCase

```ts
UseCase.test(InviteMember)
  .given(ProjectsInMemory([fixture(Project)]))
  .as(fixture(User))
  .at("2026-10-02T09:00:00+09:00") // advances the TestClock
  .run({ projectId, email })
// → Exit<Invitation, ProjectNotFound | NotProjectOwner | AlreadyMember>
```

- `fixture(Schema, overrides?)` builds a value from the Schema's arbitrary. No hand-assembled test users.
- A missing stub is a compile error.

## The whole API

HTTP needs no separate controller tests. Serve the app on a test profile over an in-memory platform and call it through the generated, typed client:

```ts
const TestServer = HttpRouter.serve(app.http("test")).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

it.effect("completes a todo", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiClient.make(app.api)
    const done = yield* client.todos.complete({ params: { id } }) // typed from the UseCase
    expect(done.done).toBe(true)
  }).pipe(Effect.provide(TestServer)))
```
