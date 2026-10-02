import { Context, Effect, Schema } from "effect"
import * as Fault from "../../src/Fault.ts"

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
export type TodoId = typeof TodoId.Type

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.String,
  done: Schema.Boolean
}) {}

export class TodoNotFound extends Fault.NotFound("TodoNotFound", { id: TodoId }) {}
export class AlreadyDone extends Fault.Conflict("AlreadyDone") {}
export class DbError extends Schema.TaggedError<DbError>()("DbError", {}) {}

export class Todos extends Context.Service<Todos, {
  find: (id: TodoId) => Effect.Effect<Todo, TodoNotFound>
  save: (todo: Todo) => Effect.Effect<void>
}>()("Todos") {}

/** A lower-level service that a Todos implementation depends on. */
export class Db extends Context.Service<Db, {
  readonly rows: Map<string, Todo>
}>()("Db") {}

export class Clock extends Context.Service<Clock, {
  readonly now: () => number
}>()("Clock") {}
