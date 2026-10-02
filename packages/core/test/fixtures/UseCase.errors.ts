// Each `// expect:` comment names a message tsc must report on the next line.
// Checked by test/UseCase.errors.test.ts.
import { Effect, Schema } from "effect"
import * as UseCase from "../../src/UseCase.ts"
import { AlreadyDone, DbError, Todo, TodoId, TodoNotFound, Todos } from "./domain.ts"

UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound]
})(
  // expect: Fault AlreadyDone is not declared in errors
  function*({ id }) {
    const todo = yield* (yield* Todos).find(id)
    if (todo.done) return yield* new AlreadyDone()
    return todo
  }
)

UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound, AlreadyDone]
})(
  // expect: Fault AlreadyDone is declared in errors but never raised
  function*({ id }) {
    return yield* (yield* Todos).find(id)
  }
)

UseCase.make({
  input: {},
  success: Schema.Void,
  errors: []
})(
  // expect: Error DbError is not a Fault. Map it to a Fault, or die
  function*() {
    yield* new DbError()
  }
)

UseCase.make({
  input: {},
  success: Schema.Void,
  errors: []
})(
  // expect: An untagged error is not a Fault. Map it to a Fault, or die
  function*() {
    yield* Effect.fail("boom")
  }
)

UseCase.make({
  input: {},
  success: Schema.Number,
  errors: []
})(
  // expect: The returned value does not match success
  function*() {
    return "not a number"
  }
)
