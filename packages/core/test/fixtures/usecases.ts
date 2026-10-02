import { Schema } from "effect"
import * as UseCase from "../../src/UseCase.ts"
import { AlreadyDone, Clock, Todo, TodoId, TodoNotFound, Todos } from "./domain.ts"

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

export const Now = UseCase.make({
  input: {},
  success: Schema.Number,
  errors: []
})(function*() {
  return (yield* Clock).now()
})
