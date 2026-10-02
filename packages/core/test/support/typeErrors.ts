import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const project = new URL("../fixtures/tsconfig.json", import.meta.url)
// typescript does not export its bin, so resolve it from the package root
const tsc = new URL("../../node_modules/typescript/bin/tsc", import.meta.url).pathname

interface Diagnostic {
  readonly file: string
  readonly line: number
  readonly text: string
}

/** Runs tsc on the fixtures once and groups each diagnostic with its elaboration lines. */
const diagnostics: Promise<ReadonlyArray<Diagnostic>> = promisify(execFile)(
  process.execPath,
  [tsc, "-p", project.pathname, "--pretty", "false"]
).then(() => "", (error: { stdout: string }) => error.stdout).then((output) => {
  const result: Array<Diagnostic> = []
  for (const line of output.split("\n")) {
    const head = /^(.+?)\((\d+),\d+\): error TS\d+: (.*)$/.exec(line)
    if (head) {
      result.push({ file: head[1]!, line: Number(head[2]), text: head[3]! })
    } else if (result.length > 0 && line.startsWith(" ")) {
      const last = result.pop()!
      result.push({ ...last, text: `${last.text}\n${line.trim()}` })
    }
  }
  return result
})

/**
 * Checks that tsc reports exactly the errors a fixture announces. Each
 * `// expect: <message>` comment names a message expected on the next line.
 */
export const expectTypeErrors = (fixture: string, title: string) =>
  describe(title, async () => {
    const lines = (await readFile(new URL(`../fixtures/${fixture}`, import.meta.url), "utf8")).split("\n")
    const expected = lines.flatMap((line, index) => {
      const match = /\/\/ expect: (.*)$/.exec(line)
      return match ? [{ line: index + 2, message: match[1]! }] : []
    })
    const actual = (await diagnostics).filter((d) => d.file.endsWith(`fixtures/${fixture}`))

    it.for(expected)("line $line: $message", ({ line, message }) => {
      const onLine = actual.filter((d) => d.line === line).map((d) => d.text).join("\n")
      expect(onLine).toContain(message)
    })

    it("reports nothing but the expected errors", () => {
      expect(actual.map((d) => d.line).sort()).toEqual(expected.map((e) => e.line).sort())
    })
  })
