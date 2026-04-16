import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { UserResponse, CreateUserRequest } from "./schemas.js"
import { UserNotFound, EmailAlreadyTaken } from "./errors.js"

const getUser = HttpApiEndpoint.get("getUser", "/users/:id", {
  params: { id: Schema.String },
  success: UserResponse,
  error: UserNotFound.pipe(HttpApiSchema.status(404)),
})

const createUser = HttpApiEndpoint.post("createUser", "/users", {
  payload: CreateUserRequest,
  success: UserResponse,
  error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
})

export const UsersGroup = HttpApiGroup.make("Users").add(getUser).add(createUser)
