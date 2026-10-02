import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const fixture = new URL("./fixtures/UseCase.errors.ts", import.meta.url)
const project = new URL("./fixtures/tsconfig.json", import.meta.url)
// typescript does not export its bin, so resolve it from the package root
const tsc = new URL("../node_modules/typescript/bin/tsc", import.meta.url).pathname

interface Diagnostic {
  readonly line: number
  readonly text: string
}

/** Runs tsc on the fixtures and groups each diagnostic with its elaboration lines. */
const diagnose = async (): Promise<ReadonlyArray<Diagnostic>> => {
  const output = await promisify(execFile)(process.execPath, [tsc, "-p", project.pathname, "--pretty", "false"])
    .then(() => "", (error: { stdout: string }) => error.stdout)
  const diagnostics: Array<Diagnostic> = []
  for (const line of output.split("\n")) {
    const head = /^(.+?)\((\d+),\d+\): error TS\d+: (.*)$/.exec(line)
    if (head) {
      if (head[1]?.endsWith("UseCase.errors.ts")) diagnostics.push({ line: Number(head[2]), text: head[3] ?? "" })
    } else if (diagnostics.length > 0 && line.startsWith(" ")) {
      const last = diagnostics.pop()!
      diagnostics.push({ ...last, text: `${last.text}\n${line.trim()}` })
    }
  }
  return diagnostics
}

const expectations = async () => {
  const lines = (await readFile(fixture, "utf8")).split("\n")
  return lines.flatMap((line, index) => {
    const match = /\/\/ expect: (.*)$/.exec(line)
    return match ? [{ line: index + 2, message: match[1]! }] : []
  })
}

describe("UseCase.make rejects bodies that disagree with the spec", async () => {
  const [diagnostics, expected] = await Promise.all([diagnose(), expectations()])

  it.for(expected)("line $line: $message", ({ line, message }) => {
    const onLine = diagnostics.filter((d) => d.line === line).map((d) => d.text).join("\n")
    expect(onLine).toContain(message)
  })

  it("reports nothing but the expected errors", () => {
    expect(diagnostics.map((d) => d.line).sort()).toEqual(expected.map((e) => e.line).sort())
  })
})
