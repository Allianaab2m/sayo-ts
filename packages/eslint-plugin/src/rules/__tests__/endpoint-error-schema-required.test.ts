import { RuleTester } from "@typescript-eslint/rule-tester"
import { endpointErrorSchemaRequired } from "../endpoint-error-schema-required.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("endpoint-error-schema-required", endpointErrorSchemaRequired, {
  valid: [
    `HttpApiEndpoint.get("getUser", "/users/:id", { success: UserResponse, error: UserNotFound })`,
    `HttpApiEndpoint.post("createUser", "/users", { payload: Body, success: UserResponse, error: [NotFound, Conflict] })`,
  ],
  invalid: [
    {
      code: `HttpApiEndpoint.get("health", "/health")`,
      errors: [{ messageId: "endpointErrorSchemaRequired" }],
    },
    {
      code: `HttpApiEndpoint.get("getUser", "/users/:id", { success: UserResponse })`,
      errors: [{ messageId: "endpointErrorSchemaRequired" }],
    },
  ],
})
