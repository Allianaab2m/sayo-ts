import { RuleTester } from "@typescript-eslint/rule-tester"
import { noRawPromise } from "../no-raw-promise.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("no-raw-promise", noRawPromise, {
  valid: [
    `Effect.tryPromise(() => fetch("/api"))`,
    `Effect.gen(function* () { yield* someEffect })`,
    `const x = 1`,
  ],
  invalid: [
    {
      code: `new Promise((resolve) => resolve(1))`,
      errors: [{ messageId: "noRawPromise" }],
    },
    {
      code: `Promise.resolve(1)`,
      errors: [{ messageId: "noRawPromise" }],
    },
    {
      code: `Promise.reject(new Error("fail"))`,
      errors: [{ messageId: "noRawPromise" }],
    },
    {
      code: `Promise.all([p1, p2])`,
      errors: [{ messageId: "noRawPromise" }],
    },
    {
      code: `Promise.race([p1, p2])`,
      errors: [{ messageId: "noRawPromise" }],
    },
    {
      code: `Promise.allSettled([p1, p2])`,
      errors: [{ messageId: "noRawPromise" }],
    },
  ],
})
