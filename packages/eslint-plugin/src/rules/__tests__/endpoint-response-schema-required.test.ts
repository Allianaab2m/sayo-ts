import { RuleTester } from "@typescript-eslint/rule-tester"
import { endpointResponseSchemaRequired } from "../endpoint-response-schema-required.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("endpoint-response-schema-required", endpointResponseSchemaRequired, {
  valid: [
    `HttpApiEndpoint.get("getUser", "/users/:id", { params: { id: Schema.String }, success: UserResponse })`,
    `HttpApiEndpoint.post("createUser", "/users", { payload: CreateUserRequest, success: UserResponse })`,
  ],
  invalid: [
    {
      code: `HttpApiEndpoint.get("health", "/health")`,
      errors: [{ messageId: "endpointResponseSchemaRequired" }],
    },
    {
      code: `HttpApiEndpoint.post("createUser", "/users", { payload: CreateUserRequest })`,
      errors: [{ messageId: "endpointResponseSchemaRequired" }],
    },
  ],
})
