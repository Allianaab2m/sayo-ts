// What the sayo command line does, as Schemas, Faults, a Service and UseCases.
// Nothing here knows about argv, flags or exit codes.
import { Context, Effect, FileSystem, Path, Schema } from "effect"
import { Fault, UseCase } from "@sayo-ts/core"

/** `complete-todo` or `completeTodo`. */
export const UseCaseName = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z][a-zA-Z0-9]*(-[a-zA-Z0-9]+)*$/))
)

export class FileExists extends Fault.Conflict("FileExists", { path: Schema.String }) {}
export class EntryNotFound extends Fault.NotFound("EntryNotFound", { entry: Schema.String }) {}

/** Starts a program and keeps it running, restarting on changes. */
export class Runner extends Context.Service<Runner, {
  readonly watch: (entry: string, env: Readonly<Record<string, string>>) => Effect.Effect<void>
}>()("Runner") {}

const words = (name: string) => name.split(/-|(?=[A-Z])/).filter((w) => w.length > 0)
const pascal = (name: string) => words(name).map((w) => w[0]!.toUpperCase() + w.slice(1)).join("")
const kebab = (name: string) => words(name).map((w) => w.toLowerCase()).join("-")

export const skeleton = (name: string) => `import { Schema } from "effect";
import { UseCase } from "@sayo-ts/core";

export const ${pascal(name)} = UseCase.make({
  input: {},
  success: Schema.Void,
  errors: [],
})(function* () {
  // Write the business logic here. Yield the services it needs.
});
`

export const GenerateUseCase = UseCase.make({
  input: { name: UseCaseName, dir: Schema.optional(Schema.String) },
  success: Schema.String,
  errors: [FileExists]
})(function*({ name, dir }) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const file = path.join(dir ?? "src", `${kebab(name)}.ts`)
  if (yield* fs.exists(file).pipe(Effect.orDie)) return yield* new FileExists({ path: file })
  yield* fs.makeDirectory(path.dirname(file), { recursive: true }).pipe(Effect.orDie)
  yield* fs.writeFileString(file, skeleton(name)).pipe(Effect.orDie)
  return `created ${file}`
})

export const Dev = UseCase.make({
  input: { entry: Schema.optional(Schema.String), profile: Schema.optional(Schema.String) },
  success: Schema.Void,
  errors: [EntryNotFound]
})(function*({ entry, profile }) {
  const fs = yield* FileSystem.FileSystem
  const file = entry ?? "src/main.ts"
  if (!(yield* fs.exists(file).pipe(Effect.orDie))) return yield* new EntryNotFound({ entry: file })
  yield* (yield* Runner).watch(file, { SAYO_PROFILE: profile ?? "local" })
})
