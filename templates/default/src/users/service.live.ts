import { Effect, Layer } from "effect"
import { UserService } from "./service.js"
import { UserNotFound, EmailAlreadyTaken } from "./errors.js"
import { UserResponse } from "./schemas.js"

export const UserServiceLive: Layer.Layer<UserService> = Layer.succeed(
  UserService,
  UserService.of({
    findById: (id) =>
      Effect.gen(function* () {
        if (id === "1") {
          return new UserResponse({
            id: "1",
            name: "Alice",
            email: "alice@example.com",
          })
        }
        return yield* new UserNotFound({ userId: id })
      }),

    register: (input) =>
      Effect.gen(function* () {
        if (input.email === "taken@example.com") {
          return yield* new EmailAlreadyTaken({ email: input.email })
        }
        return new UserResponse({
          id: crypto.randomUUID(),
          name: input.name,
          email: input.email,
        })
      }),
  }),
)
