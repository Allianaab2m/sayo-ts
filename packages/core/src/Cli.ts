/**
 * Binds UseCases to a command line by generating an Effect `Command` tree.
 *
 * - Input fields become flags (`dryRun` → `--dry-run`); fields listed in
 *   `args` become positional arguments, in that order. Values are decoded with
 *   the field's Schema, optional fields become optional flags, and Booleans
 *   become switches.
 * - Each declared Fault ends the process with the exit code of its kind.
 * - What the CLI platform provides (file system, terminal, processes) is
 *   removed from the requirements the App must wire.
 */
import { Console, Effect, Option, Schema } from "effect"
import { Argument, Command, Flag } from "effect/cli"
import * as Fault from "./Fault.ts"
import type * as UseCase from "./UseCase.ts"

export const TypeId = "~@sayo-ts/core/Cli" as const

/** Exit codes per Fault kind, following sysexits(3). */
export const exitCodeOf: { readonly [K in Fault.Kind]: number } = {
  Invalid: 65, // EX_DATAERR
  Unauthorized: 77, // EX_NOPERM
  Forbidden: 77, // EX_NOPERM
  NotFound: 66, // EX_NOINPUT
  Conflict: 73, // EX_CANTCREAT
  Unavailable: 69 // EX_UNAVAILABLE
}

/** The exit code for malformed command lines (EX_USAGE). */
export const usageExitCode = 64

type InputOf<U> = U extends UseCase.UseCase<infer I, any, any, any> ? I : never

export interface CommandSpec<U extends UseCase.Any> {
  readonly [TypeId]: "Command"
  readonly usecase: U
  readonly args: ReadonlyArray<string>
  readonly description: string | undefined
}

type AnyCommand = CommandSpec<UseCase.Any>

/** Commands by name. A nested record becomes a command with subcommands. */
export interface Tree {
  readonly [name: string]: AnyCommand | Tree
}

export const command = <U extends UseCase.Any, const Args extends ReadonlyArray<keyof InputOf<U> & string> = []>(
  usecase: U,
  options?: {
    /** Input fields taken as positional arguments, in this order. */
    readonly args?: Args
    readonly description?: string
  }
): CommandSpec<U> => ({
  [TypeId]: "Command",
  usecase,
  args: options?.args ?? [],
  description: options?.description
})

/** The services a command tree needs from the App: UseCase requirements minus the CLI platform. */
export type Services<T> = T extends CommandSpec<infer U> ? Exclude<UseCase.Services<U>, Command.Environment>
  : T extends Tree ? Services<T[keyof T]>
  : never

// ---------------------------------------------------------------------------
// The generated Command tree
// ---------------------------------------------------------------------------

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const isCommand = (u: AnyCommand | Tree): u is AnyCommand => (u as AnyCommand)[TypeId] === "Command"

const param = (name: string, field: Schema.Top, positional: boolean): any => {
  const optional = field.ast.context?.isOptional === true
  if (!positional && field.ast._tag === "Boolean") return Flag.Boolean(kebab(name)).pipe(Flag.withDefault(false))
  const codec = Schema.toCodecStringTree(field) as any
  if (positional) {
    const argument = Argument.String(name).pipe(Argument.withSchema(codec))
    return optional ? Argument.optional(argument) : argument
  }
  const flag = Flag.String(kebab(name)).pipe(Flag.withSchema(codec))
  return optional ? Flag.optional(flag) : flag
}

/** Formats a success value: strings as is, nothing for void, JSON otherwise. */
const print = (success: Schema.Top, value: unknown) =>
  value === undefined
    ? Effect.void
    : typeof value === "string"
    ? Console.log(value)
    : Console.log(JSON.stringify(Schema.encodeSync(Schema.toCodecJson(success) as any)(value), null, 2))

/** Raised to end the process with a given exit code once the Fault has been reported. */
class Exit extends Schema.TaggedError<Exit>()("~@sayo-ts/core/Cli/Exit", { code: Schema.Number }) {}

const leaf = (name: string, spec: AnyCommand): any => {
  const fields = spec.usecase.input.fields as Schema.Struct.Fields
  const config: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    config[key] = param(key, field as Schema.Top, spec.args.includes(key))
  }
  const cmd = Command.make(name, config as any, (parsed: Record<string, unknown>) => {
    const input: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Option.isOption(value)) {
        if (Option.isSome(value)) input[key] = value.value
      } else input[key] = value
    }
    return spec.usecase(input as any).pipe(
      Effect.flatMap((value) => print(spec.usecase.success, value)),
      Effect.catchIf(Fault.isFault, (fault) =>
        Console.error(`${fault._tag}: ${JSON.stringify({ ...fault, _tag: undefined })}`).pipe(
          Effect.andThen(Effect.fail(new Exit({ code: exitCodeOf[Fault.kindOf(fault)] })))
        ))
    )
  })
  return spec.description === undefined ? cmd : Command.withDescription(cmd, spec.description)
}

const node = (name: string, tree: AnyCommand | Tree): any =>
  isCommand(tree)
    ? leaf(name, tree)
    : Command.make(name).pipe(Command.withSubcommands(Object.entries(tree).map(([key, sub]) => node(key, sub)) as any))

/**
 * Runs a command tree on the given arguments and returns the exit code:
 * 0 on success, the Fault's code, or 64 for a malformed command line.
 */
export const run = (
  tree: Tree,
  options: { readonly name: string; readonly version: string }
) =>
(argv: ReadonlyArray<string>): Effect.Effect<number, never, any> =>
  Command.runWith(node(options.name, tree), { version: options.version })(argv).pipe(
    Effect.as(0),
    Effect.catch((error: unknown) =>
      Effect.succeed(error instanceof Exit ? error.code : usageExitCode)
    )
  ) as Effect.Effect<number, never, any>
