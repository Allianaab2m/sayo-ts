import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { AppApi } from "../api.js"
import { UserService } from "./service.js"

export const UsersHandlers = HttpApiBuilder.group(
  AppApi,
  "Users",
  (handlers) =>
    handlers
      .handle("getUser", (req) =>
        Effect.gen(function* () {
          const service = yield* UserService
          return yield* service.findById(req.params.id)
        }),
      )
      .handle("createUser", (req) =>
        Effect.gen(function* () {
          const service = yield* UserService
          return yield* service.register(req.payload)
        }),
      ),
)
