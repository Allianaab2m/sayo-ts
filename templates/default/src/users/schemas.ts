import { Schema } from "effect"

export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

export const CreateUserRequest = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
})

export type CreateUserRequest = typeof CreateUserRequest.Type
