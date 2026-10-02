import { Effect, Layer, Ref } from "effect"
import { Db, type Todo, TodoNotFound, Todos } from "./domain.ts"

export const TodosInMemory = (initial: ReadonlyArray<Todo> = []) =>
  Layer.effect(
    Todos,
    Effect.gen(function*() {
      const store = yield* Ref.make(new Map(initial.map((t) => [t.id, t])))
      return {
        find: (id) =>
          Effect.flatMap(Ref.get(store), (m) => {
            const found = m.get(id)
            return found ? Effect.succeed(found) : Effect.fail(new TodoNotFound({ id }))
          }),
        save: (t) => Ref.update(store, (m) => new Map(m).set(t.id, t))
      }
    })
  )

/** Requires Db, so it has to be listed after a layer providing Db. */
export const TodosFromDb = Layer.effect(
  Todos,
  Effect.gen(function*() {
    const db = yield* Db
    return {
      find: (id) => {
        const found = db.rows.get(id)
        return found ? Effect.succeed(found) : Effect.fail(new TodoNotFound({ id }))
      },
      save: (t) => Effect.sync(() => void db.rows.set(t.id, t))
    }
  })
)

export const makeDb = (initial: ReadonlyArray<Todo> = []) =>
  Layer.sync(Db, () => ({ rows: new Map(initial.map((t) => [t.id, t])) }))
