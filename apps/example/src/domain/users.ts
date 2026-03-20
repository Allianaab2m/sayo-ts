import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

export class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
  createdAt: Schema.DateTimeUtc,
}) {}

export class CreateUserRequest extends Schema.Class<CreateUserRequest>(
  "CreateUserRequest",
)({
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
}) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: Schema.Number },
  HttpApiSchema.annotations({ status: 404 }),
) {}
