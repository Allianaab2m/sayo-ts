// Data structures, faults, a service boundary and the business logic.
// Nothing here knows about HTTP.
import { Context, Effect, Schema } from "effect";
import { Fault, UseCase } from "@sayo-ts/core";

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"));
export type TodoId = typeof TodoId.Type;

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.NonEmptyString,
  done: Schema.Boolean,
}) {}

export class TodoNotFound extends Fault.NotFound("TodoNotFound", { id: TodoId }) {}
export class AlreadyDone extends Fault.Conflict("AlreadyDone", { id: TodoId }) {}

export class Todos extends Context.Service<
  Todos,
  {
    readonly all: () => Effect.Effect<ReadonlyArray<Todo>>;
    readonly find: (id: TodoId) => Effect.Effect<Todo, TodoNotFound>;
    readonly save: (todo: Todo) => Effect.Effect<void>;
  }
>()("Todos") {}

export const ListTodos = UseCase.make({
  input: {},
  success: Schema.Array(Todo),
  errors: [],
})(function* () {
  return yield* (yield* Todos).all();
});

export const AddTodo = UseCase.make({
  input: { title: Schema.NonEmptyString },
  success: Todo,
  errors: [],
})(function* ({ title }) {
  const todo = new Todo({ id: TodoId.make(crypto.randomUUID()), title, done: false });
  yield* (yield* Todos).save(todo);
  return todo;
});

export const CompleteTodo = UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound, AlreadyDone],
})(function* ({ id }) {
  const todos = yield* Todos;
  const todo = yield* todos.find(id);
  if (todo.done) return yield* new AlreadyDone({ id });
  const done = new Todo({ id: todo.id, title: todo.title, done: true });
  yield* todos.save(done);
  return done;
});
