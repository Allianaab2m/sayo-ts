import { RuleTester } from "@typescript-eslint/rule-tester"
import { noTryCatch } from "../no-try-catch.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("no-try-catch", noTryCatch, {
  valid: [
    `Effect.try(() => JSON.parse(str))`,
    `Effect.tryPromise(() => fetch("/api"))`,
    // Allowed: catch block converts error to Effect
    {
      code: `try { riskyOperation() } catch (e) { return Effect.fail(new MyError({ cause: e })) }`,
    },
    {
      code: `try { riskyOperation() } catch (e) { return Effect.die(e) }`,
    },
  ],
  invalid: [
    {
      code: `try { doSomething() } catch (e) { console.log(e) }`,
      errors: [{ messageId: "noTryCatch" }],
    },
    {
      code: `try { doSomething() } catch (e) { throw e }`,
      errors: [{ messageId: "noTryCatch" }],
    },
    {
      code: `try { a() } catch (e) { const x = Effect.fail(e); return x }`,
      errors: [{ messageId: "noTryCatch" }],
    },
  ],
})
