import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Layer } from "effect"
import * as App from "../src/App.ts"
import { Clock, Db, Todo, TodoId, type Todos } from "./fixtures/domain.ts"
import { makeDb, TodosFromDb, TodosInMemory } from "./fixtures/layers.ts"
import { CompleteTodo, Now } from "./fixtures/usecases.ts"

const todo = new Todo({ id: TodoId.make("t1"), title: "wire layers", done: false })
const FixedClock = Layer.succeed(Clock, { now: () => 42 })

let dbBuilds = 0
const CountingDb = Layer.effect(
  Db,
  Effect.sync(() => {
    dbBuilds++
    return { rows: new Map([[todo.id, todo]]) }
  })
)

const app = App.make({
  usecases: [CompleteTodo, Now],
  profiles: {
    local: [TodosInMemory([todo]), FixedClock],
    prod: [CountingDb, TodosFromDb, FixedClock]
  },
  guard: { local: () => process.env["NODE_ENV"] !== "production" }
})

describe("App", () => {
  it.effect("wires a profile so UseCases run on it", () =>
    Effect.gen(function*() {
      const done = yield* CompleteTodo({ id: todo.id })
      expect(done.done).toBe(true)
      expect(yield* Now({})).toBe(42)
    }).pipe(Effect.provide(app.layer("local"))))

  it.effect("lets a layer use what the layers before it provide", () => {
    // layers are built before the body runs, so reset outside of it
    dbBuilds = 0
    return Effect.gen(function*() {
      yield* CompleteTodo({ id: todo.id })
      const db = yield* Db
      // TodosFromDb wrote into the same Db the profile exposes, built once
      expect(db.rows.get(todo.id)?.done).toBe(true)
      expect(dbBuilds).toBe(1)
    }).pipe(Effect.provide(app.layer("prod")))
  })

  it.effect("refuses a profile its guard rejects", () =>
    Effect.gen(function*() {
      const previous = process.env["NODE_ENV"]
      process.env["NODE_ENV"] = "production"
      const exit = yield* Effect.exit(Effect.provide(Now({}), app.layer("local")))
      process.env["NODE_ENV"] = previous
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toStrictEqual(
        new App.ProfileRejected({ profile: "local" })
      )
    }))

  it("lists its profiles", () => {
    expect(app.profiles).toEqual(["local", "prod"])
  })

  it("keeps layers of other profiles out of a profile", () => {
    // makeDb is not part of local, so its type must not be provided there
    const local: Layer.Layer<Todos | Clock> = app.layer("local")
    void local
    void makeDb
  })
})
