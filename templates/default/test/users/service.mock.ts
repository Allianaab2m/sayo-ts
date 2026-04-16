import { Effect, Layer } from "effect"
import { UserService } from "../../src/users/service.js"
import { UserNotFound } from "../../src/users/errors.js"
import { UserResponse } from "../../src/users/schemas.js"

const mockUser = new UserResponse({
  id: "test-1",
  name: "Test User",
  email: "test@example.com",
})

export const UserServiceMock: Layer.Layer<UserService> = Layer.succeed(
  UserService,
  UserService.of({
    findById: (id) =>
      id === "test-1"
        ? Effect.succeed(mockUser)
        : Effect.fail(new UserNotFound({ userId: id })),
    register: (input) =>
      Effect.succeed(
        new UserResponse({
          id: "test-new",
          name: input.name,
          email: input.email,
        }),
      ),
  }),
)
