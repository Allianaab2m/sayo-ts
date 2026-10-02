import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { Fault } from "../src/index.ts"
import { AlreadyDone, Todo, TodoId, TodoNotFound } from "./fixtures/domain.ts"
import { TodosInMemory } from "./fixtures/layers.ts"
import { CompleteTodo } from "./UseCase.typecheck.ts"

const todo = (done: boolean) => new Todo({ id: TodoId.make("t1"), title: "write README", done })

describe("UseCase", () => {
  it.effect("runs the body", () =>
    Effect.gen(function*() {
      const result = yield* CompleteTodo({ id: TodoId.make("t1") })
      expect(result.done).toBe(true)
    }).pipe(Effect.provide(TodosInMemory([todo(false)]))))

  it.effect("fails with the declared Faults", () =>
    Effect.gen(function*() {
      const missing = yield* Effect.flip(CompleteTodo({ id: TodoId.make("nope") }))
      expect(missing).toStrictEqual(new TodoNotFound({ id: TodoId.make("nope") }))

      const done = yield* Effect.flip(CompleteTodo({ id: TodoId.make("t1") }))
      expect(done).toBeInstanceOf(AlreadyDone)
      expect(Fault.kindOf(done)).toBe("Conflict")
    }).pipe(Effect.provide(TodosInMemory([todo(true)]))))

  it("keeps the spec for adapters", () => {
    expect(CompleteTodo.errors).toEqual([TodoNotFound, AlreadyDone])
    expect(CompleteTodo.success).toBe(Todo)
    expect(Schema.decodeUnknownSync(CompleteTodo.input)({ id: "t1" })).toEqual({ id: "t1" })
    expect(CompleteTodo.errors.map(Fault.kindOf)).toEqual(["NotFound", "Conflict"])
  })

  it("has no name unless one is given", () => {
    expect(CompleteTodo.name).toBeUndefined()
  })
})
