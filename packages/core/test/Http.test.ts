import { NodeHttpServer } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import * as App from "../src/App.ts"
import * as Http from "../src/Http.ts"
import { AlreadyDone, Todo, TodoId, TodoNotFound } from "./fixtures/domain.ts"
import { Auth, AuthLive, CreateTodo, Echo, GetTodo, Me, Unauthenticated } from "./fixtures/http.ts"
import { TodosInMemory } from "./fixtures/layers.ts"
import { CompleteTodo } from "./fixtures/usecases.ts"

const t1 = new Todo({ id: TodoId.make("t1"), title: "serve http", done: false })

const app = App.make({
  http: {
    todos: Http.group("/todos", {
      get: Http.get("/:id", GetTodo),
      create: Http.post("/", CreateTodo),
      complete: Http.post("/:id/complete", CompleteTodo)
    }),
    misc: Http.group("/misc", {
      echo: Http.get("/echo", Echo)
    }),
    me: Http.group("/me", {
      show: Http.get("/", Me)
    }).auth(Auth)
  },
  profiles: {
    test: [TodosInMemory([t1]), AuthLive]
  }
})

// The test platform: an in-memory server plus an HttpClient pointed at it
const TestServer = HttpRouter.serve(app.http("test")).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

const client = HttpApiClient.make(app.api)

describe("Http", () => {
  it.effect("answers with the UseCase result through a typed client", () =>
    Effect.gen(function*() {
      const api = yield* client
      const found: Todo = yield* api.todos.get({ params: { id: t1.id } })
      expect(found).toStrictEqual(t1)

      const done = yield* api.todos.complete({ params: { id: t1.id } })
      expect(done.done).toBe(true)
    }).pipe(Effect.provide(TestServer)))

  it.effect("takes body fields for POST and query fields for GET", () =>
    Effect.gen(function*() {
      const api = yield* client
      const created = yield* api.todos.create({ payload: { id: TodoId.make("t2"), title: "new" } })
      expect(created.title).toBe("new")
      expect((yield* api.todos.get({ params: { id: TodoId.make("t2") } })).title).toBe("new")

      expect(yield* api.misc.echo({ query: { text: "ab", times: 3 } })).toBe("ababab")
    }).pipe(Effect.provide(TestServer)))

  it.effect("answers each Fault with the status of its kind", () =>
    Effect.gen(function*() {
      const api = yield* client
      const missing = yield* Effect.flip(api.todos.get({ params: { id: TodoId.make("nope") } }))
      expect(missing).toBeInstanceOf(TodoNotFound)

      yield* api.todos.complete({ params: { id: t1.id } })
      const again = yield* Effect.flip(api.todos.complete({ params: { id: t1.id } }))
      expect(again).toBeInstanceOf(AlreadyDone)

      const http = yield* HttpClient.HttpClient
      expect((yield* http.get("/todos/nope")).status).toBe(404)
      expect((yield* http.post(`/todos/${t1.id}/complete`)).status).toBe(409)
    }).pipe(Effect.provide(TestServer)))

  it.effect("provides what the auth middleware provides", () =>
    Effect.gen(function*() {
      const anonymous = yield* client
      expect(yield* Effect.flip(anonymous.me.show())).toBeInstanceOf(Unauthenticated)

      const signedIn = yield* HttpApiClient.make(app.api, {
        transformClient: HttpClient.mapRequest(HttpClientRequest.bearerToken("secret"))
      })
      expect(yield* signedIn.me.show()).toBe("alice")

      // a "/" route sits at the group prefix itself, without a trailing slash
      const http = yield* HttpClient.HttpClient
      expect((yield* http.get("/me")).status).toBe(401)
    }).pipe(Effect.provide(TestServer)))

  it.effect("publishes OpenAPI with the Fault statuses", () =>
    Effect.gen(function*() {
      const http = yield* HttpClient.HttpClient
      const spec = (yield* (yield* http.get("/openapi.json")).json) as {
        paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
      }
      expect(Object.keys(spec.paths["/todos/{id}/complete"]!["post"]!.responses).sort()).toEqual(
        expect.arrayContaining(["200", "404", "409"])
      )
      expect((yield* http.get("/docs")).status).toBe(200)
    }).pipe(Effect.provide(TestServer)))
})
