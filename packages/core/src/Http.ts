/**
 * Binds UseCases to HTTP by generating a plain Effect `HttpApi`.
 *
 * - Path parameters match input fields by name. The remaining fields come from
 *   the query string for GET and DELETE, and from the JSON body otherwise.
 * - Each declared Fault is answered with the status of its kind.
 * - `.auth(Middleware)` removes what the middleware provides (e.g. the current
 *   user) from the requirements the App must wire.
 */
import type { Context } from "effect"
import { Layer, Schema } from "effect"
import type { HttpApiMiddleware } from "effect/http-api"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import * as Fault from "./Fault.ts"
import type * as UseCase from "./UseCase.ts"

export const TypeId = "~@sayo-ts/core/Http" as const

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
type WithBody = "POST" | "PUT" | "PATCH"

export const statusOf: { readonly [K in Fault.Kind]: number } = {
  Invalid: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Unavailable: 503
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export interface Route<M extends Method, P extends string, U extends UseCase.Any> {
  readonly [TypeId]: "Route"
  readonly method: M
  readonly path: P
  readonly usecase: U
}

type AnyRoute = Route<Method, string, UseCase.Any>

type InputOf<U> = U extends UseCase.UseCase<infer I, any, any, any> ? I : never
type SuccessOf<U> = U extends UseCase.UseCase<any, infer S, any, any> ? S : never
type ErrorsOf<U> = U extends UseCase.UseCase<any, any, infer E, any> ? E[number] : never

/** `"/:id/items/:itemId"` → `"id" | "itemId"` */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}` ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}` ? Name
  : never

// Messages avoid double quotes: TS escapes them inside property names
type Problem<Message extends string> = { readonly [M in Message]: M }

type CheckPath<P extends string, U> = [Exclude<ParamNames<P>, keyof InputOf<U>>] extends [never] ? unknown
  : Problem<`Path parameter ${Exclude<ParamNames<P>, keyof InputOf<U>> & string} is not a field of the UseCase input`>

const route = <M extends Method>(method: M) =>
<const P extends string, U extends UseCase.Any>(
  path: P,
  usecase: U & NoInfer<CheckPath<P, U>>
): Route<M, P, U> => ({ [TypeId]: "Route", method, path, usecase })

export const get = route("GET")
export const post = route("POST")
export const put = route("PUT")
export const patch = route("PATCH")
export const del = route("DELETE")

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface Group<Prefix extends string, Routes extends Record<string, AnyRoute>, Auth = never> {
  readonly [TypeId]: "Group"
  readonly prefix: Prefix
  readonly routes: Routes
  readonly middlewares: ReadonlyArray<Context.Key<any, any>>
  /** Puts every route of the group behind a middleware, typically authentication. */
  readonly auth: <I extends HttpApiMiddleware.AnyId, S>(middleware: Context.Key<I, S>) => Group<Prefix, Routes, Auth | I>
}

export type AnyGroup = Group<string, Record<string, AnyRoute>, any>

const makeGroup = <Prefix extends string, Routes extends Record<string, AnyRoute>, Auth>(
  prefix: Prefix,
  routes: Routes,
  middlewares: ReadonlyArray<Context.Key<any, any>>
): Group<Prefix, Routes, Auth> => ({
  [TypeId]: "Group",
  prefix,
  routes,
  middlewares,
  auth: (middleware) => makeGroup(prefix, routes, [...middlewares, middleware])
})

export const group = <const Prefix extends string, const Routes extends Record<string, AnyRoute>>(
  prefix: Prefix,
  routes: Routes
): Group<Prefix, Routes> => makeGroup(prefix, routes, [])

/** The services a group needs from the App: UseCase requirements minus what its middlewares provide. */
export type Services<G> = G extends Group<any, infer Routes, infer Auth> ?
    | Exclude<UseCase.Services<Routes[keyof Routes]["usecase"]>, HttpApiMiddleware.Provides<Auth>>
    | Auth
    | HttpApiMiddleware.Requires<Auth>
  : never

// ---------------------------------------------------------------------------
// The generated HttpApi
// ---------------------------------------------------------------------------

// Narrow with a conditional type, not `F & Schema.Struct.Fields`: the index
// signature of Fields would leak `unknown` services into every codec.
type AsFields<F> = F extends Schema.Struct.Fields ? F : never
type StringTree<F> = [keyof F] extends [never] ? never : Schema.toCodecStringTree<Schema.Struct<AsFields<F>>>
type Json<F> = [keyof F] extends [never] ? never : Schema.toCodecJson<Schema.Struct<AsFields<F>>>
type ErrorCodec<E> = [E] extends [never] ? never : E extends Schema.Top ? Schema.toCodecJson<E> : never

/** `"/todos" + "/"` is `"/todos"`, not `"/todos/"`. */
export type Join<Prefix extends string, P extends string> = P extends "/" ? (Prefix extends "" ? "/" : Prefix)
  : `${Prefix}${P}`

const join = (prefix: string, path: string) => path === "/" ? (prefix === "" ? "/" : prefix) : `${prefix}${path}`

type Endpoint<Name extends string, Prefix extends string, R, Auth> = R extends Route<infer M, infer P, infer U>
  ? HttpApiEndpoint.HttpApiEndpoint<
    Name,
    M,
    Join<Prefix, P>,
    StringTree<Pick<InputOf<U>, ParamNames<P> & keyof InputOf<U>>>,
    M extends WithBody ? never : StringTree<Omit<InputOf<U>, ParamNames<P>>>,
    M extends WithBody ? Json<Omit<InputOf<U>, ParamNames<P>>> : never,
    never,
    Schema.toCodecJson<SuccessOf<U>>,
    ErrorCodec<ErrorsOf<U>>,
    Auth,
    [Auth] extends [never] ? never : HttpApiMiddleware.ApplyServices<Auth & HttpApiMiddleware.AnyId, never>
  >
  : never

type ApiGroup<Name extends string, G> = G extends Group<infer Prefix, infer Routes, infer Auth>
  ? HttpApiGroup.HttpApiGroup<Name, { [K in keyof Routes]: Endpoint<K & string, Prefix, Routes[K], Auth> }[keyof Routes]>
  : never

/** The HttpApi generated from named groups. Its clients come from `HttpApiClient.make`. */
export type Api<Groups extends Record<string, AnyGroup>> = HttpApi.HttpApi<
  "sayo",
  { [K in keyof Groups]: ApiGroup<K & string, Groups[K]> }[keyof Groups]
>

const paramNames = (path: string): ReadonlyArray<string> => [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]!)

const partition = (fields: Schema.Struct.Fields, names: ReadonlyArray<string>) => {
  const params: Record<string, Schema.Struct.Fields[string]> = {}
  const rest: Record<string, Schema.Struct.Fields[string]> = {}
  for (const [key, schema] of Object.entries(fields)) (names.includes(key) ? params : rest)[key] = schema
  return { params, rest }
}

const isEmpty = (fields: object) => Object.keys(fields).length === 0

const endpoint = (name: string, prefix: string, r: AnyRoute) => {
  const { params, rest } = partition(r.usecase.input.fields, paramNames(r.path))
  const withBody = r.method === "POST" || r.method === "PUT" || r.method === "PATCH"
  const errors = (r.usecase.errors as ReadonlyArray<Fault.Any>).map((e) =>
    e.pipe(HttpApiSchema.status(statusOf[Fault.kindOf(e)]))
  )
  return HttpApiEndpoint.make(r.method)(name, join(prefix, r.path) as `/${string}`, {
    ...(isEmpty(params) ? {} : { params: Schema.Struct(params) }),
    ...(isEmpty(rest) ? {} : withBody ? { payload: Schema.Struct(rest) } : { query: Schema.Struct(rest) }),
    success: r.usecase.success,
    ...(errors.length === 0 ? {} : { error: errors })
  } as any)
}

const apiGroup = (name: string, g: AnyGroup) => {
  // Paths are joined here rather than with HttpApiGroup.prefix, which keeps a trailing slash
  const endpoints = Object.entries(g.routes).map(([key, r]) => endpoint(key, g.prefix, r))
  let result: any = HttpApiGroup.make(name).add(...(endpoints as [any, ...Array<any>]))
  for (const middleware of g.middlewares) result = result.middleware(middleware)
  return result
}

export const toApi = <const Groups extends Record<string, AnyGroup>>(groups: Groups): Api<Groups> =>
  Object.entries(groups).reduce<any>((api, [name, g]) => api.add(apiGroup(name, g)), HttpApi.make("sayo"))

/** Handlers for every group: each endpoint calls its UseCase with the assembled input. */
export const handlers = <const Groups extends Record<string, AnyGroup>>(
  api: Api<Groups>,
  groups: Groups
): Layer.Layer<never, never, any> =>
  Layer.mergeAll(
    ...Object.entries(groups).map(([name, g]) =>
      HttpApiBuilder.group(api as any, name, (h: any) =>
        Object.entries(g.routes).reduce(
          (acc, [key, r]) =>
            acc.handle(key, (request: { params?: object; query?: object; payload?: object }) =>
              r.usecase({ ...request.params, ...request.query, ...request.payload } as any)),
          h
        )) as unknown as Layer.Layer<never, never, any>
    ) as [Layer.Layer<never, never, any>, ...Array<Layer.Layer<never, never, any>>]
  )
