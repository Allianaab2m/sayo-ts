import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { SayoApp } from "@sayo-ts/core"
import { AppApi } from "../api/api.js"
import { UsersLive } from "../api/users.routes.js"

const app = SayoApp.make(AppApi).addHandlers(UsersLive)

const TestLayer = app.testLayer()
const makeClient = app.makeClient()

describe("Users API", () => {
  it("GET /api/v1/users — 初期ユーザーが返る", async () => {
    await Effect.gen(function* () {
      const client = yield* makeClient
      const users = yield* client.users.listUsers()
      expect(users.length).toBeGreaterThan(0)
      expect(users[0]?.name).toBe("Alice")
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it("GET /api/v1/users/:id — 存在するユーザーが返る", async () => {
    await Effect.gen(function* () {
      const client = yield* makeClient
      const user = yield* client.users.getUser({ path: { id: 1 } })
      expect(user.id).toBe(1)
      expect(user.name).toBe("Alice")
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it("GET /api/v1/users/:id — 存在しない場合は UserNotFound エラー", async () => {
    await Effect.gen(function* () {
      const client = yield* makeClient
      const result = yield* client.users
        .getUser({ path: { id: 999 } })
        .pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it("POST /api/v1/users — 新規ユーザーが作成される", async () => {
    await Effect.gen(function* () {
      const client = yield* makeClient
      const user = yield* client.users.createUser({
        payload: { name: "Bob", email: "bob@example.com" },
      })
      expect(user.name).toBe("Bob")
      expect(user.email).toBe("bob@example.com")
      expect(user.id).toBeGreaterThan(1)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })
})
