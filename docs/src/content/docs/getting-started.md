---
title: Getting started
description: Create an app from the template, add a UseCase, expose it over HTTP and test it.
---

## Create an app

You need Node.js 22.18+ (or 24.11+), pnpm and [Vite+](https://viteplus.dev) (`vp`).

```sh
vp create @sayo-ts      # pick the `api` template
cd my-api
pnpm install
pnpm dev                # sayo dev: http://localhost:3000/todos, API reference at /docs
```

`pnpm dev` serves the `local` profile and restarts on save. Pass `--profile <name>` to serve another one.

The template is a small todo API:

| File | What it holds |
| --- | --- |
| `src/todo.ts` | Schemas, Faults, the `Todos` service and the UseCases. Nothing here knows about HTTP. |
| `src/todos.memory.ts` | An in-memory `Todos` for the `local` profile |
| `src/app.ts` | Which UseCases are served where, and which layers each profile uses |
| `src/app.test.ts` | Tests for the whole API, through the generated client |
| `src/main.ts` | Starts the server on Node |

## Add a UseCase

Generate a skeleton:

```sh
pnpm sayo generate usecase rename-todo   # writes src/rename-todo.ts
```

Fill in the input, the success value and the body. Leave `errors` empty at first; the compiler tells you which Faults to list.

```ts
// src/rename-todo.ts
import { Schema } from "effect";
import { UseCase } from "@sayo-ts/core";
import { Todo, TodoId, TodoNotFound, Todos } from "./todo.ts";

export const RenameTodo = UseCase.make({
  input: { id: TodoId, title: Schema.NonEmptyString },
  success: Todo,
  errors: [TodoNotFound], // `todos.find` can fail with it
})(function* ({ id, title }) {
  const todos = yield* Todos;
  const todo = yield* todos.find(id);
  const renamed = new Todo({ id: todo.id, title, done: todo.done });
  yield* todos.save(renamed);
  return renamed;
});
```

## Expose it

Register it in `src/app.ts`. `id` comes from the path, `title` from the body.

```ts
todos: Http.group("/todos", {
  list: Http.get("/", ListTodos),
  add: Http.post("/", AddTodo),
  complete: Http.post("/:id/complete", CompleteTodo),
  rename: Http.patch("/:id", RenameTodo),
}),
```

`PATCH /todos/:id` now shows up at `/docs`, and `TodoNotFound` is answered as 404.

## Test it

Add a case to `src/app.test.ts`. The client method is named after the key you registered:

```ts
it("renames a todo", () =>
  run(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(app.api);
      const todo = yield* client.todos.add({ payload: { title: "try sayo" } });
      const renamed = yield* client.todos.rename({
        params: { id: todo.id },
        payload: { title: "try sayo today" },
      });
      expect(renamed.title).toBe("try sayo today");
    }),
  ));
```

```sh
vp test     # the whole API, in memory, through a typed client
vp check    # format, lint and type check
```

## Next steps

- Put each new side effect (database, mail, payments) behind a `Service` and give every profile an implementation. See [Service](../guides/service/) and [App and profiles](../guides/app-and-profiles/).
- Add a `prod` profile with real implementations. The compiler reports any service a profile is missing.
