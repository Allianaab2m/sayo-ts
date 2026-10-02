# sayo app

Write your data structures and your business logic. sayo turns them into a Web API.

```sh
pnpm dev       # http://localhost:3000/todos, API reference at /docs
vp test        # the whole API, in memory, through a typed client
vp check       # format, lint and type check
```

- `src/todo.ts` — Schemas, Faults, the `Todos` service and the UseCases. Nothing here knows about HTTP.
- `src/todos.memory.ts` — an in-memory `Todos` for the `local` profile.
- `src/app.ts` — which UseCases are served where, and which layers each profile uses.
- `src/main.ts` — starts the server on Node.
