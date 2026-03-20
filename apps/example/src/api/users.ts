import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "@effect/platform"
import { Schema } from "effect"
import { User, CreateUserRequest, UserNotFound } from "../domain/users.js"

const userIdParam = HttpApiSchema.param("id", Schema.NumberFromString)

export class UsersGroup extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("listUsers")`/users`.addSuccess(
      Schema.Array(User),
    ),
  )
  .add(
    HttpApiEndpoint.get("getUser")`/users/${userIdParam}`
      .addSuccess(User)
      .addError(UserNotFound),
  )
  .add(
    HttpApiEndpoint.post("createUser")`/users`
      .setPayload(CreateUserRequest)
      .addSuccess(User, { status: 201 }),
  )
  .prefix("/api/v1") {}
