/**
 * The unit of business logic.
 *
 * A UseCase declares what is needed at runtime (input, success, errors) and
 * derives everything the types already know (requirements). The declared
 * errors are checked against the body in both directions.
 */
import { Effect, Schema } from "effect"
import type * as Fault from "./Fault.ts"

export const TypeId = "~@sayo-ts/core/UseCase" as const

export interface Spec<
  Input extends Schema.Struct.Fields,
  Success extends Schema.Top,
  Errors extends ReadonlyArray<Fault.Any>
> {
  /** Only needed when the name must survive refactors (e.g. over RPC). */
  readonly name?: string
  readonly input: Input
  readonly success: Success
  readonly errors: Errors
}

export interface UseCase<
  Input extends Schema.Struct.Fields,
  Success extends Schema.Top,
  Errors extends ReadonlyArray<Fault.Any>,
  R
> {
  readonly [TypeId]: typeof TypeId
  (input: Schema.Struct.Type<Input>): Effect.Effect<Success["Type"], Declared<Errors>, R>
  readonly name: string | undefined
  readonly input: Schema.Struct<Input>
  readonly success: Success
  readonly errors: Errors
}

/** Any UseCase, whatever its spec. */
export type Any = UseCase<any, any, any, any>

/** The services a UseCase requires. */
export type Services<U> = U extends UseCase<any, any, any, infer R> ? R : never

/** Instances of the declared Fault classes. */
type Declared<Errors extends ReadonlyArray<Fault.Any>> = InstanceType<Errors[number]>

type ErrorOf<Eff> = [Eff] extends [never] ? never
  : [Eff] extends [Effect.Effect<any, infer E, any>] ? E
  : never
type ServicesOf<Eff> = [Eff] extends [never] ? never
  : [Eff] extends [Effect.Effect<any, any, infer R>] ? R
  : never

// Messages avoid double quotes: TS escapes them inside property names
type NameOf<E> = E extends { readonly _tag: infer Tag extends string } ? Tag : never

/** Errors the body can fail with that are missing from `errors`. */
type Undeclared<E, D> = E extends Fault.Fault
  ? [E] extends [D] ? never : `Fault ${NameOf<E>} is not declared in errors`
  : [NameOf<E>] extends [never] ? "An untagged error is not a Fault. Map it to a Fault, or die"
  : `Error ${NameOf<E>} is not a Fault. Map it to a Fault, or die`

/** Declared errors the body can never fail with. */
type Unused<D, E> = D extends unknown
  ? [D] extends [E] ? never : `Fault ${NameOf<D>} is declared in errors but never raised`
  : never

type SuccessMismatch<A, S extends Schema.Top> = [A] extends [S["Type"]] ? never
  : "The returned value does not match success"

type Problems<Eff, A, Success extends Schema.Top, Errors extends ReadonlyArray<Fault.Any>> =
  | Undeclared<ErrorOf<Eff>, Declared<Errors>>
  | Unused<Declared<Errors>, ErrorOf<Eff>>
  | SuccessMismatch<A, Success>

/**
 * `unknown` when the body agrees with the spec. Otherwise an object whose
 * property names describe each problem, so they show up in the TS error:
 *
 *   Property '"Fault AlreadyDone is not declared in errors"' is missing ...
 */
type Check<Eff, A, Success extends Schema.Top, Errors extends ReadonlyArray<Fault.Any>> =
  [Problems<Eff, A, Success, Errors>] extends [never] ? unknown
    : { readonly [P in Problems<Eff, A, Success, Errors>]: P }

/**
 * The check sits on the generator's return type, not on the body itself.
 * Intersecting the whole body with it would make TS fix Eff to its constraint
 * before the destructured input parameter is contextually typed.
 */
type Body<
  Input extends Schema.Struct.Fields,
  Eff,
  A,
  Success extends Schema.Top,
  Errors extends ReadonlyArray<Fault.Any>
> = (
  input: Schema.Struct.Type<Input>
) => Generator<Eff, A, never> & NoInfer<Check<Eff, A, Success, Errors>>

export const make = <
  const Input extends Schema.Struct.Fields,
  Success extends Schema.Top,
  const Errors extends ReadonlyArray<Fault.Any>
>(spec: Spec<Input, Success, Errors>) =>
<Eff extends Effect.Effect<any, any, any>, A>(
  body: Body<Input, Eff, A, Success, Errors>
): UseCase<Input, Success, Errors, ServicesOf<Eff>> => {
  const run = Effect.fn(spec.name ?? "UseCase")(
    body as (input: Schema.Struct.Type<Input>) => Generator<Eff, A, never>
  )
  // `name` is a read-only own property of functions, so it cannot be assigned
  return Object.defineProperties(run, {
    [TypeId]: { value: TypeId },
    name: { value: spec.name },
    input: { value: Schema.Struct(spec.input) },
    success: { value: spec.success },
    errors: { value: spec.errors }
  }) as unknown as UseCase<Input, Success, Errors, ServicesOf<Eff>>
}
