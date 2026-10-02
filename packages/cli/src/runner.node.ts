// Runs the entry with `node --watch`, sharing this terminal.
import { spawn } from "node:child_process"
import { Effect, Layer } from "effect"
import { Runner } from "./project.ts"

export const RunnerNode = Layer.succeed(Runner, {
  watch: (entry, env) =>
    Effect.callback<void>((resume) => {
      const child = spawn(process.execPath, ["--watch", entry], {
        stdio: "inherit",
        env: { ...process.env, ...env }
      })
      child.on("exit", () => resume(Effect.void))
      return Effect.sync(() => void child.kill())
    })
})
