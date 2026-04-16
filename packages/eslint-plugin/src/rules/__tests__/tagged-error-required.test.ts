import { RuleTester } from "@typescript-eslint/rule-tester"
import { taggedErrorRequired } from "../tagged-error-required.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("tagged-error-required", taggedErrorRequired, {
  valid: [
    `Effect.fail(new UserNotFound({ userId: "1" }))`,
    `Effect.fail(new MyCustomError({ message: "oops" }))`,
    `Effect.succeed(42)`,
  ],
  invalid: [
    {
      code: `Effect.fail("something went wrong")`,
      errors: [{ messageId: "taggedErrorRequired" }],
    },
    {
      code: `Effect.fail(new Error("something went wrong"))`,
      errors: [{ messageId: "taggedErrorRequired" }],
    },
    {
      code: `Effect.fail({ message: "oops" })`,
      errors: [{ messageId: "taggedErrorRequired" }],
    },
  ],
})
