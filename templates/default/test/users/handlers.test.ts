import { Effect, Layer } from "effect"
import { HttpApiBuilder, HttpApiClient } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { NodeHttpServer } from "@effect/platform-node"
import { describe, it, expect } from "vitest"
import { AppApi } from "../../src/api.js"
import { UsersHandlers } from "../../src/users/handlers.js"
import { UserServiceMock } from "./service.mock.js"

// Layer composition — fully type-checked.
// Removing UserServiceMock causes a compile error.
const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)

// provideMerge passes HttpClient through to the test Effect
const TestLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(UserServiceMock),
  Layer.provideMerge(NodeHttpServer.layerTest),
)

describe("Users API", () => {
  it("should get a user by id", async () => {
    const program = Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi)
      const user = yield* client.Users.getUser({ params: { id: "test-1" } })
      expect(user.name).toBe("Test User")
      expect(user.email).toBe("test@example.com")
    })

    await program.pipe(Effect.provide(TestLive), Effect.runPromise)
  })

  it("should return error for unknown user", async () => {
    const program = Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi)
      const result = yield* Effect.exit(
        client.Users.getUser({ params: { id: "unknown" } }),
      )
      expect(result._tag).toBe("Failure")
    })

    await program.pipe(Effect.provide(TestLive), Effect.runPromise)
  })

  it("should create a user", async () => {
    const program = Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi)
      const user = yield* client.Users.createUser({
        payload: { name: "New User", email: "new@example.com" },
      })
      expect(user.name).toBe("New User")
      expect(user.email).toBe("new@example.com")
      expect(user.id).toBe("test-new")
    })

    await program.pipe(Effect.provide(TestLive), Effect.runPromise)
  })
})
