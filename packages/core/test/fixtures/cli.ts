import { Effect, FileSystem, Schema } from "effect"
import * as UseCase from "../../src/UseCase.ts"

export const Greet = UseCase.make({
  input: {
    name: Schema.String,
    times: Schema.Number,
    loud: Schema.Boolean,
    suffix: Schema.optional(Schema.String)
  },
  success: Schema.String,
  errors: []
})(function*({ name, times, loud, suffix }) {
  const line = `hello ${name}${suffix ?? ""}`
  return Array.from({ length: times }, () => loud ? line.toUpperCase() : line).join("\n")
})

/** Needs FileSystem, which the CLI platform provides: no profile has to wire it. */
export const Exists = UseCase.make({
  input: { path: Schema.String },
  success: Schema.Boolean,
  errors: []
})(function*({ path }) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.exists(path).pipe(Effect.orDie)
})
