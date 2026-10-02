import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NodeServices } from "@effect/platform-node"
import { beforeEach, describe, expect, it } from "@effect/vitest"
import { Cli } from "@sayo-ts/core"
import { Console, Effect } from "effect"
import { app } from "../src/app.ts"
import { started } from "../src/runner.recording.ts"

let out: Array<string>
let err: Array<string>
let dir: string
beforeEach(() => {
  out = []
  err = []
  started.length = 0
  dir = mkdtempSync(join(tmpdir(), "sayo-cli-"))
})

const capture = {
  ...globalThis.console,
  log: (...args: ReadonlyArray<unknown>) => void out.push(args.join(" ")),
  error: (...args: ReadonlyArray<unknown>) => void err.push(args.join(" "))
} as Console.Console

const sayo = (...argv: Array<string>) =>
  app.cli("test", { name: "sayo", version: "0.1.0" })(argv).pipe(
    Effect.provide(NodeServices.layer),
    Effect.provideService(Console.Console, capture)
  )

describe("sayo generate usecase", () => {
  it.effect("writes a UseCase skeleton named after the argument", () =>
    Effect.gen(function*() {
      expect(yield* sayo("generate", "usecase", "complete-todo", "--dir", dir)).toBe(0)
      const source = readFileSync(join(dir, "complete-todo.ts"), "utf8")
      expect(source).toContain("export const CompleteTodo = UseCase.make({")
      expect(out).toEqual([`created ${join(dir, "complete-todo.ts")}`])
    }))

  it.effect("refuses to overwrite a file", () =>
    Effect.gen(function*() {
      yield* sayo("generate", "usecase", "completeTodo", "--dir", dir)
      expect(yield* sayo("generate", "usecase", "complete-todo", "--dir", dir)).toBe(Cli.exitCodeOf.Conflict)
      expect(err.join("\n")).toContain("FileExists")
    }))

  it.effect("rejects a name that is not an identifier", () =>
    Effect.gen(function*() {
      expect(yield* sayo("generate", "usecase", "Not A Name", "--dir", dir)).toBe(Cli.usageExitCode)
    }))
})

describe("sayo dev", () => {
  it.effect("starts the entry with the chosen profile", () =>
    Effect.gen(function*() {
      const entry = join(dir, "main.ts")
      writeFileSync(entry, "")
      expect(yield* sayo("dev", "--entry", entry, "--profile", "prod")).toBe(0)
      expect(started).toEqual([{ entry, env: { SAYO_PROFILE: "prod" } }])
    }))

  it.effect("fails when the entry does not exist", () =>
    Effect.gen(function*() {
      expect(yield* sayo("dev", "--entry", join(dir, "missing.ts"))).toBe(Cli.exitCodeOf.NotFound)
      expect(started).toEqual([])
    }))
})

describe("sayo --help", () => {
  it.effect("lists the commands", () =>
    Effect.gen(function*() {
      expect(yield* sayo("--help")).toBe(0)
      const help = out.join("\n")
      expect(help).toContain("dev")
      expect(help).toContain("generate")
    }))
})
