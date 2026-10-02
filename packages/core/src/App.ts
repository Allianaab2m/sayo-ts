/**
 * An application: the UseCases it serves and the profiles that implement
 * their requirements.
 *
 * A profile lists layers in dependency order. Every layer may use what the
 * layers before it provide, so wiring is a left fold at runtime. The order and
 * the coverage of every requirement are checked by the type checker, with the
 * problem reported on the offending layer or profile.
 */
import { Data, Effect, Layer } from "effect"
import type * as UseCase from "./UseCase.ts"

export const TypeId = "~@sayo-ts/core/App" as const

type AnyLayer = Layer.Any

/** Layers listed in dependency order. */
export type Profile = ReadonlyArray<AnyLayer>

/** Raised when a profile is booted where its guard refuses it. */
export class ProfileRejected extends Data.TaggedError("ProfileRejected")<{
  readonly profile: string
}> {}

export interface Config<
  UseCases extends ReadonlyArray<UseCase.Any>,
  Profiles extends Record<string, Profile>
> {
  readonly usecases: UseCases
  readonly profiles: Profiles
  /** Refuses to boot a profile where it must not run (e.g. fakes in production). */
  readonly guard?: { readonly [K in keyof Profiles]?: () => boolean }
}

export interface App<Profiles extends Record<string, Profile>> {
  readonly [TypeId]: typeof TypeId
  readonly profiles: ReadonlyArray<keyof Profiles & string>
  /** Every service of the profile, wired. Dies with ProfileRejected if its guard refuses. */
  readonly layer: <K extends keyof Profiles & string>(
    profile: K
  ) => Layer.Layer<Provided<Profiles[K]>, Layer.Error<Profiles[K][number]>>
}

type Provided<P extends Profile> = Layer.Success<P[number]>

// Messages avoid double quotes: TS escapes them inside property names
type NameOf<S> = S extends { readonly key: infer K extends string } ? K : "An unnamed service"

/** An object whose property names describe each problem, so they show up in the TS error. */
type Problem<Message extends string> = { readonly [M in Message]: M }

type OrderMessage<S, All> = S extends unknown
  ? [S] extends [All] ? `${NameOf<S>} must be provided by a layer listed before this one`
  : `${NameOf<S>} is not provided by any layer in this profile`
  : never

/**
 * Marks each layer whose requirements are not provided by the layers before it.
 * Tail-recursive with an accumulator, so long profiles stay within TS's
 * recursion limit (1000 instead of ~50).
 */
type CheckOrder<Ls, Before, All, Checked extends ReadonlyArray<unknown> = readonly []> = Ls extends
  readonly [infer Head extends AnyLayer, ...infer Rest] ? CheckOrder<
    Rest,
    Before | Layer.Success<Head>,
    All,
    readonly [
      ...Checked,
      [Exclude<Layer.Services<Head>, Before>] extends [never] ? Head
        : Head & Problem<OrderMessage<Exclude<Layer.Services<Head>, Before>, All>>
    ]
  >
  : Checked

type CoverageMessage<S> = S extends unknown ? `${NameOf<S>} is required by a UseCase but not provided by this profile`
  : never

type CheckProfile<P extends Profile, Required> =
  & CheckOrder<P, never, Provided<P>>
  & ([Exclude<Required, Provided<P>>] extends [never] ? unknown
    : Problem<CoverageMessage<Exclude<Required, Provided<P>>>>)

type Check<Profiles extends Record<string, Profile>, Required> = {
  readonly [K in keyof Profiles]: CheckProfile<Profiles[K], Required>
}

// Layer is contravariant in what it provides, so the fold is typed loosely and
// the result type comes from App.layer's signature.
type Loose = Layer.Layer<any, any, any>

const wire = (profile: Profile): Loose =>
  (profile as ReadonlyArray<Loose>).reduce<Loose>(
    (before, layer) => layer.pipe(Layer.provideMerge(before)),
    Layer.empty as unknown as Loose
  )

export const make = <
  const UseCases extends ReadonlyArray<UseCase.Any>,
  const Profiles extends Record<string, Profile>
>(
  config: Config<UseCases, Profiles> & {
    readonly profiles: NoInfer<Check<Profiles, UseCase.Services<UseCases[number]>>>
  }
): App<Profiles> => ({
  [TypeId]: TypeId,
  profiles: Object.keys(config.profiles),
  layer: (profile) =>
    Layer.unwrap(Effect.suspend(() => {
      const allowed = config.guard?.[profile]?.() ?? true
      return allowed
        ? Effect.succeed(wire(config.profiles[profile]!))
        : Effect.die(new ProfileRejected({ profile }))
    })) as never
})
