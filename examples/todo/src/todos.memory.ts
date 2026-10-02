// An in-memory implementation of Todos for the local profile.
import { Effect, Layer, Ref } from "effect"
import { type Todo, type TodoId, TodoNotFound, Todos } from "./todo.ts"

export const TodosInMemory = Layer.effect(
  Todos,
  Effect.gen(function*() {
    const store = yield* Ref.make(new Map<TodoId, Todo>())
    return {
      all: () => Effect.map(Ref.get(store), (m) => [...m.values()]),
      find: (id) =>
        Effect.flatMap(Ref.get(store), (m) => {
          const todo = m.get(id)
          return todo ? Effect.succeed(todo) : Effect.fail(new TodoNotFound({ id }))
        }),
      save: (todo) => Ref.update(store, (m) => new Map(m).set(todo.id, todo))
    }
  })
)
