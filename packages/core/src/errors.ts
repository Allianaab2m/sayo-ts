import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

/**
 * sayo-ts が提供するベースエラー型。
 * これを使うと addError() を宣言した時点で HTTP ステータスが自動マッピングされる。
 *
 * Go の errors.Is() / Rust の Result<T, E> に対応する概念として、
 * エラーを型に刻むことで「どこで何が失敗するか」が関数シグネチャから読める。
 */

export class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  {
    message: Schema.String,
    resource: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Conflict extends Schema.TaggedError<Conflict>()(
  "Conflict",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 409 }),
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 401 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class UnprocessableEntity extends Schema.TaggedError<UnprocessableEntity>()(
  "UnprocessableEntity",
  { message: Schema.String, fields: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })) },
  HttpApiSchema.annotations({ status: 422 }),
) {}

export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
  "InternalServerError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 500 }),
) {}
