import { Context, Effect } from "effect"
import type { UserResponse } from "./schemas.js"
import type { CreateUserRequest } from "./schemas.js"
import type { UserNotFound, EmailAlreadyTaken } from "./errors.js"

export class UserService extends Context.Service<
  UserService,
  {
    readonly findById: (
      id: string,
    ) => Effect.Effect<UserResponse, UserNotFound>
    readonly register: (
      input: CreateUserRequest,
    ) => Effect.Effect<UserResponse, EmailAlreadyTaken>
  }
>()("UserService") {}
