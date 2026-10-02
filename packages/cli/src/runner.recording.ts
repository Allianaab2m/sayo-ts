// Records what would be started instead of starting it, for the test profile.
import { Effect, Layer } from "effect"
import { Runner } from "./project.ts"

export const started: Array<{ readonly entry: string; readonly env: Readonly<Record<string, string>> }> = []

export const RunnerRecording = Layer.succeed(Runner, {
  watch: (entry, env) => Effect.sync(() => void started.push({ entry, env }))
})
