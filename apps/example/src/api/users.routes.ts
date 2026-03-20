import { HttpApiBuilder } from "@effect/platform"
import { DateTime, Effect, Ref } from "effect"
import { AppApi } from "./api.js"
import { User, UserNotFound } from "../domain/users.js"

// インメモリストア（初期データ込み）
const makeStore = Effect.gen(function* () {
  const initial: User[] = [
    new User({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      createdAt: DateTime.unsafeNow(),
    }),
  ]
  return yield* Ref.make(initial)
})

export const UsersLive = HttpApiBuilder.group(AppApi, "users", (handlers) =>
  Effect.gen(function* () {
    const store = yield* makeStore
    let nextId = 2

    return handlers
      .handle("listUsers", () => Ref.get(store))
      .handle("getUser", ({ path: { id } }) =>
        Effect.gen(function* () {
          const users = yield* Ref.get(store)
          const user = users.find((u) => u.id === id)
          if (!user) return yield* Effect.fail(new UserNotFound({ id }))
          return user
        }),
      )
      .handle("createUser", ({ payload }) =>
        Effect.gen(function* () {
          const id = nextId++
          const user = new User({
            id,
            name: payload.name,
            email: payload.email,
            createdAt: DateTime.unsafeNow(),
          })
          yield* Ref.update(store, (users) => [...users, user])
          return user
        }),
      )
  }),
)
