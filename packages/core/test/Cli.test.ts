import { NodeServices } from "@effect/platform-node"
import { beforeEach, describe, expect, it } from "@effect/vitest"
import { Console, Effect } from "effect"
import * as App from "../src/App.ts"
import * as Cli from "../src/Cli.ts"
import { Todo, TodoId } from "./fixtures/domain.ts"
import { Exists, Greet } from "./fixtures/cli.ts"
import { TodosInMemory } from "./fixtures/layers.ts"
import { CompleteTodo } from "./fixtures/usecases.ts"

const t1 = new Todo({ id: TodoId.make("t1"), title: "run on a terminal", done: false })

const app = App.make({
  cli: {
    greet: Cli.command(Greet, { args: ["name"], description: "Says hello" }),
    exists: Cli.command(Exists, { args: ["path"] }),
    todo: {
      complete: Cli.command(CompleteTodo, { args: ["id"] })
    }
  },
  profiles: { test: [TodosInMemory([t1])] }
})

let out: Array<string>
let err: Array<string>
beforeEach(() => {
  out = []
  err = []
})

/** Captures what the commands print. */
const capture: Console.Console = {
  ...globalThis.console,
  log: (...args: ReadonlyArray<unknown>) => void out.push(args.join(" ")),
  error: (...args: ReadonlyArray<unknown>) => void err.push(args.join(" "))
} as Console.Console

const sayo = (...argv: Array<string>) =>
  app.cli("test", { name: "demo", version: "1.0.0" })(argv).pipe(
    Effect.provide(NodeServices.layer),
    Effect.provideService(Console.Console, capture)
  )

describe("Cli", () => {
  it.effect("turns input fields into positional arguments, flags and switches", () =>
    Effect.gen(function*() {
      expect(yield* sayo("greet", "alice", "--times", "2", "--loud")).toBe(0)
      expect(out).toEqual(["HELLO ALICE\nHELLO ALICE"])
    }))

  it.effect("leaves optional fields out unless given", () =>
    Effect.gen(function*() {
      yield* sayo("greet", "bob", "--times", "1")
      yield* sayo("greet", "bob", "--times", "1", "--suffix", "!")
      expect(out).toEqual(["hello bob", "hello bob!"])
    }))

  it.effect("prints non-string results as JSON and runs nested commands", () =>
    Effect.gen(function*() {
      expect(yield* sayo("todo", "complete", "t1")).toBe(0)
      expect(JSON.parse(out[0]!)).toEqual({ id: "t1", title: "run on a terminal", done: true })
    }))

  it.effect("exits with the code of the Fault's kind", () =>
    Effect.gen(function*() {
      expect(yield* sayo("todo", "complete", "nope")).toBe(Cli.exitCodeOf.NotFound)
      expect(err.join("\n")).toContain("TodoNotFound")
    }))

  it.effect("exits with 64 when the command line does not decode", () =>
    Effect.gen(function*() {
      expect(yield* sayo("greet", "alice", "--times", "many")).toBe(Cli.usageExitCode)
    }))

  it.effect("gets platform services from the CLI platform", () =>
    Effect.gen(function*() {
      expect(yield* sayo("exists", "package.json")).toBe(0)
      expect(yield* sayo("exists", "no-such-file")).toBe(0)
      expect(out).toEqual(["true", "false"])
    }))
})
