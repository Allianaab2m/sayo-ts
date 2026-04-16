import { RuleTester } from "@typescript-eslint/rule-tester"
import { serviceInterfaceSeparation } from "../service-interface-separation.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("service-interface-separation", serviceInterfaceSeparation, {
  valid: [
    // Only service definition
    `class UserService extends Context.Service("UserService") {}`,
    // Only layer implementation
    `const UserServiceLive = Layer.succeed(UserService, impl)`,
    // Unrelated code
    `const x = 1`,
  ],
  invalid: [
    {
      code: `class UserService extends Context.Service("UserService") {}\nconst UserServiceLive = Layer.succeed(UserService, impl)`,
      errors: [{ messageId: "serviceInterfaceSeparation" }],
    },
  ],
})
