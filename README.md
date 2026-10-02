# sayo-ts

> Write your data structures and your business logic. sayo turns them into a Web API.

sayo is an application framework for [Effect](https://effect.website) v4. You describe the shape of your data with `Schema` and your business logic as `UseCase`s. Everything else — HTTP binding, validation, OpenAPI, a typed client, dependency wiring, environment switching, test setup — is derived from those two.

> [!NOTE]
> Early stage. `UseCase`, `Fault`, `App` and `Http` work; the rest of this README is still a design draft. All APIs are tentative.

## Getting started

```sh
vp create @sayo-ts      # pick the `api` template (https://viteplus.dev)
cd my-api
pnpm dev                # http://localhost:3000/todos, API reference at /docs
vp test                 # the whole API, in memory, through a typed client
vp check                # format, lint and type check
```

## One screen

```ts
import { Effect, Layer, Ref, Schema } from "effect"
import { App, Fault, Http, Service, UseCase } from "@sayo-ts/core"

// Data structures
const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
type TodoId = typeof TodoId.Type

class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.NonEmptyTrimmedString,
  done: Schema.Boolean,
}) {}

class TodoNotFound extends Fault.NotFound("TodoNotFound", { id: TodoId }) {}
class AlreadyDone extends Fault.Conflict("AlreadyDone", {}) {}

// A boundary to the outside world. Its implementation is chosen per profile.
class Todos extends Service("Todos")<{
  find: (id: TodoId) => Effect.Effect<Todo, TodoNotFound>
  save: (todo: Todo) => Effect.Effect<void>
}>() {}

// Business logic
const CompleteTodo = UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound, AlreadyDone],
})(function* ({ id }) {
  const todos = yield* Todos
  const todo = yield* todos.find(id)
  if (todo.done) return yield* new AlreadyDone()
  const done = new Todo({ ...todo, done: true })
  yield* todos.save(done)
  return done
})

// Expose it
export default App.make({
  http: {
    todos: Http.group("/todos", {
      complete: Http.post("/:id/complete", CompleteTodo),
    }),
  },
  profiles: {
    local: [TodosInMemory],
    prod: [TodosPostgres],
  },
})
```

```sh
pnpm dev     # serves the `local` profile, restarts on save
vp test
```

From this you get:

- `POST /todos/:id/complete`, with `id` decoded and validated as `TodoId`
- `TodoNotFound` answered as 404 and `AlreadyDone` as 409, without registering either on the endpoint
- OpenAPI and an API reference at `/docs`
- A typed client for your frontend
- A compile error if any profile is missing an implementation of `Todos`

## Principles

1. **You write Schemas and UseCases. Everything else is derived.**
2. **Magic stays inside what the type checker can verify.** Registration is explicit and by value. Every derived result shows up in a type.
3. **You can use it without knowing Effect.** `Effect.gen` and `yield*` are enough. If you do know Effect, nothing is hidden from you: sayo generates plain `HttpApi`, `Layer`s and `Context.Service`s.
4. **The error channel carries only failures someone can act on.** Those are `Fault`s. Anything else is a defect and dies.
5. **Environment differences live in profiles.** Business logic never asks "am I running locally?".
6. **Declare only what is needed at runtime. Derive whatever the types already know.** Input, success and errors are needed at runtime (decoding, encoding, OpenAPI), so you declare them. Requirements, names, status codes and wiring are derived.

## Building blocks

### Fault — failures someone can act on

```ts
class TodoNotFound extends Fault.NotFound("TodoNotFound", { id: TodoId }) {}
// Fault.Invalid / Unauthorized / Forbidden / NotFound / Conflict / Unavailable
```

A `Fault` carries a kind, never an HTTP status. Each adapter maps kinds to its own vocabulary: the HTTP adapter maps `NotFound` to 404, `Conflict` to 409 and so on. Your domain stays free of transport concepts.

A failure that no layer can do anything about (a broken invariant, a malformed row, a missing config) is not a `Fault`. Use `Effect.die` with a tagged value; the platform turns it into a 500 and logs the full `Cause`.

### UseCase — the unit of business logic

```ts
const SubmitTest = UseCase.make({
  input: { testSetId: TestSetId, answers: Schema.Array(Answer) },
  success: TestResult,
  errors: [TestSetNotFound, AlreadySubmitted, InvalidAnswers],
})(function* ({ testSetId, answers }) {
  const { user } = yield* CurrentUser // needing an authenticated user shows up in the requirements
  const now = yield* DateTime.now
  // ...
})
```

The body is a plain `Effect.fn`.

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

A UseCase needs no name. It gets one from where it is registered (`todos.complete`). Pass `name` only when it has to stay stable across refactors, for example when it is exposed over RPC:

```ts
UseCase.make({ name: "CompleteTodo", input, success, errors })
```

Contract and implementation can be split, so a frontend imports the contract without pulling server code into its bundle:

```ts
// contract.ts — shared with the frontend
export const SubmitTest = UseCase.contract({ input, success, errors })

// server.ts
export const SubmitTestLive = SubmitTest.implement(function* (input) { /* ... */ })
```

### Service — boundaries to the outside world

```ts
class Mailer extends Service("Mailer")<{
  send: (mail: Mail) => Effect.Effect<void, Fault.Unavailable>
}>() {}

const MailerResend = Mailer.layer(Effect.gen(function* () { /* ... */ }))
const MailerConsole = Mailer.layer(/* prints to the console */)
```

Every side effect — database, mail, payments, devices — goes behind a `Service`.

Persistence is deliberately out of scope. sayo does not ship an ORM; you implement storage as a `Service` with the database library of your choice.

### Http — binding UseCases to HTTP

```ts
App.make({
  http: {
    trafficRulesTests: Http.group("/traffic-rules-tests", {
      active: Http.get("/active", GetActiveTestSet).view(ActiveTestSetView),
      submit: Http.post("/:testSetId/submit", SubmitTest).view(ResultView),
    }).auth(BearerUser),
  },
  profiles: { /* ... */ },
})
```

- Groups are named by their key in `http`, endpoints by their key in the group. Those names are what the generated client uses: `client.trafficRulesTests.submit(...)`.
- `.auth(...)` takes an `HttpApiMiddleware`. Whatever it provides (the current user) is subtracted from what the profile must wire; the middleware itself must be in every profile.
- A path parameter that is not an input field does not compile: `Path parameter todoId is not a field of the UseCase input`.

- Input is assembled by convention: path parameters match input fields by name; the rest comes from the query string for `GET` and from the body otherwise. Override with `.input(...)`.
- A `View` converts the UseCase's success value into the response DTO. It is a Schema, written once, and may be effectful:

  ```ts
  const ActiveTestSetView = View.make(TestSet, ActiveTestSetDto, (set) =>
    Effect.map(CurrentLocale, (locale) => set.resolveForLanguage(locale)))
  ```

- If a UseCase requires `CurrentUser` and the endpoint has no `.auth(...)`, it does not compile.
- sayo does not replace `HttpApi`; it generates it. Hand-written `HttpApiEndpoint`s can be mixed into the same group.

### App and profiles — no hand-written wiring

```ts
App.make({
  modules: [reservations, users, hubs],
  profiles: {
    local: [PGlite, TodosSql, MailerConsole, SmsConsole, StorageLocal],
    test: [PGlite, TodosSql, MailerInMemory],
    prod: [Postgres, TodosSql, MailerResend, SmsTwilio, StorageGcs],
  },
  guard: { local: () => process.env.NODE_ENV !== "production" },
})
```

A profile lists layers in dependency order: each layer may use whatever the layers before it provide (`TodosSql` uses the database from `PGlite` or `Postgres`). At runtime that is all the wiring there is, a left fold. You never write `Layer.provide`.

The type checker verifies every profile and reports the problem where it is:

```ts
prod: [
  TodosSql, // Property '"SqlClient must be provided by a layer listed before this one"' is missing ...
  Postgres,
]
local: [TodosSql], // Property '"Mailer is required by a UseCase but not provided by this profile"' is missing ...
```

Why an order instead of a bag of layers? A `Layer` does not reveal at runtime what it provides or requires, so resolving an unordered set would need either extra declarations on every layer or building layers by trial and error. An order costs you nothing the compiler cannot point out.

A `guard` refuses to boot a profile in the wrong environment, so fakes never reach production.

### Module — where things live

```ts
export const reservations = Module.make("reservations", {
  http: ReservationHttp,
  jobs: [Job.cron("0 9 * * *", SendReturnReminders)],
  events: [Event.on(ReservationConfirmed, NotifyHub)],
})
```

No file-system scanning. Modules are values you register. The same UseCase can be exposed over HTTP, on a schedule, or as an event handler.

### Testing

```ts
UseCase.test(SubmitTest)
  .given(TestSetsInMemory([fixture(TestSet)]))
  .as(fixture(User))
  .at("2026-10-02T09:00:00+09:00") // advances the TestClock
  .run({ testSetId, answers })
// → Exit<TestResult, TestSetNotFound | AlreadySubmitted | InvalidAnswers>
```

- `fixture(Schema, overrides?)` builds a value from the Schema's arbitrary. No hand-assembled test users.
- A missing stub is a compile error.

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

## Non-goals

- File-based routing
- Implicit caching
- An ORM or migration tool
- A frontend framework

## Packages

| Package | Description |
| --- | --- |
| `@sayo-ts/core` | `UseCase`, `Fault`, `Http`, `App` |
| `@sayo-ts/create` | Templates for `vp create @sayo-ts`. The `api` template doubles as the example app. |

Project setup, tests, formatting and linting are left to [Vite+](https://viteplus.dev). A sayo CLI, if any, will only cover what Vite+ cannot: serving a profile in development and generating UseCases.

## Open questions

- How input assembly resolves a field present in more than one of path, query and body
- What has to be declared so that in-memory implementations of a `Service` can be generated
- Whether lint rules are still worth shipping for what types cannot enforce (raw `Promise`, `try`/`catch`, `runSync` inside handlers)

## Requirements

- TypeScript 5.9+
- Node.js 22+
- effect 4.x

## License

MIT
