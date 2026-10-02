import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity } from "effect/http-api"
import * as Fault from "../../src/Fault.ts"
import * as UseCase from "../../src/UseCase.ts"
import { Todo, TodoId, TodoNotFound, Todos } from "./domain.ts"

export class CurrentUser extends Context.Service<CurrentUser, { readonly name: string }>()("CurrentUser") {}

export class Unauthenticated extends Fault.Unauthorized("Unauthenticated") {}

export class Auth extends HttpApiMiddleware.Service<Auth, { provides: CurrentUser }>()("Auth", {
  security: { bearer: HttpApiSecurity.bearer },
  error: Unauthenticated.pipe(HttpApiSchema.status(401))
}) {}

export const AuthLive = Layer.succeed(Auth, {
  bearer: (httpEffect, { credential }) =>
    Redacted.value(credential) === "secret"
      ? Effect.provideService(httpEffect, CurrentUser, { name: "alice" })
      : Effect.fail(new Unauthenticated())
})

export const GetTodo = UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound]
})(function*({ id }) {
  return yield* (yield* Todos).find(id)
})

export const CreateTodo = UseCase.make({
  input: { id: TodoId, title: Schema.String },
  success: Todo,
  errors: []
})(function*({ id, title }) {
  const todo = new Todo({ id, title, done: false })
  yield* (yield* Todos).save(todo)
  return todo
})

/** Query fields go through the string codec, so `times` arrives as a number. */
export const Echo = UseCase.make({
  input: { text: Schema.String, times: Schema.Number },
  success: Schema.String,
  errors: []
})(function*({ text, times }) {
  return text.repeat(times)
})

export const Me = UseCase.make({
  input: {},
  success: Schema.String,
  errors: []
})(function*() {
  return (yield* CurrentUser).name
})
