/**
 * Failures that some caller can act on.
 *
 * A Fault carries a kind, never a transport status. Adapters map kinds to
 * their own vocabulary (the HTTP adapter maps `NotFound` to 404, and so on).
 * Failures nobody can act on are not Faults: they die.
 */
import type { Cause } from "effect"
import { Schema } from "effect"

export const TypeId = "~@sayo-ts/core/Fault" as const

export type Kind =
  | "Invalid"
  | "Unauthorized"
  | "Forbidden"
  | "NotFound"
  | "Conflict"
  | "Unavailable"

/** Any Fault instance. */
export interface Fault<K extends Kind = Kind> extends Cause.YieldableError {
  readonly _tag: string
  readonly [TypeId]: K
}

type Instance<Tag extends string, Fields extends Schema.Struct.Fields, K extends Kind> =
  Schema.Struct.Type<Schema.TaggedStruct<Tag, Fields>["fields"]> & Fault<K>

/** The class returned by `Fault.NotFound(...)` and friends. */
export type FaultClass<Tag extends string, Fields extends Schema.Struct.Fields, K extends Kind> =
  Schema.Class<
    Instance<Tag, Fields, K>,
    Schema.TaggedStruct<Tag, Fields>,
    Cause.YieldableError & { readonly [TypeId]: K }
  >

/** Any class built by a Fault constructor. */
export type Any = Schema.Top & (abstract new(...args: any) => Fault)

export const isFault = (u: unknown): u is Fault =>
  typeof u === "object" && u !== null && TypeId in u

/** The kind of a Fault class or instance. */
export const kindOf = (fault: Any | Fault): Kind =>
  (typeof fault === "function" ? fault.prototype : fault)[TypeId]

const make = <K extends Kind>(kind: K) =>
<Tag extends string, const Fields extends Schema.Struct.Fields = {}>(
  tag: Tag,
  fields?: Fields
): FaultClass<Tag, Fields, K> => {
  // Self stays generic here, so TS cannot resolve TaggedError's missing-Self check
  const Base = Schema.TaggedError<Instance<Tag, Fields, K>, { readonly [TypeId]: K }>()(
    tag,
    fields ?? ({} as Fields)
  ) as unknown as FaultClass<Tag, Fields, K>
  Object.defineProperty(Base.prototype, TypeId, { value: kind, enumerable: false })
  return Base
}

/** The input is malformed or violates a business rule the caller can fix. */
export const Invalid = make("Invalid")
/** The caller is not authenticated. */
export const Unauthorized = make("Unauthorized")
/** The caller is authenticated but not allowed to do this. */
export const Forbidden = make("Forbidden")
/** The target does not exist. */
export const NotFound = make("NotFound")
/** The request conflicts with the current state. */
export const Conflict = make("Conflict")
/** A dependency is temporarily unavailable; retrying may succeed. */
export const Unavailable = make("Unavailable")
