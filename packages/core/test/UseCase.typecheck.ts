// Compiles only if the positive cases type-check. Run by `pnpm check`.
import type { Effect } from "effect"
import { Schema } from "effect"
import * as UseCase from "../src/UseCase.ts"
import { AlreadyDone, Todo, TodoId, TodoNotFound, Todos } from "./fixtures/domain.ts"

export const CompleteTodo = UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound, AlreadyDone]
})(function*({ id }) {
  const todos = yield* Todos
  const todo = yield* todos.find(id)
  if (todo.done) return yield* new AlreadyDone()
  const done = new Todo({ ...todo, done: true })
  yield* todos.save(done)
  return done
})

// The call signature carries the declared contract and the derived requirements
export const program: Effect.Effect<Todo, TodoNotFound | AlreadyDone, Todos> = CompleteTodo({
  id: TodoId.make("t1")
})

// A body that cannot fail declares no errors
export const Ping = UseCase.make({
  input: {},
  success: Schema.Literal("pong"),
  errors: []
})(function*() {
  return "pong" as const
})

// The destructured input is typed from `input`, not from an annotation
UseCase.make({
  input: { id: TodoId },
  success: Schema.Void,
  errors: []
})(function*({ id }) {
  // @ts-expect-error id is a TodoId, not a number
  const n: number = id
  void n
})
