import { RuleTester } from "@typescript-eslint/rule-tester"
import { noRunSyncInHandler } from "../no-run-sync-in-handler.js"
import { describe, it, afterAll } from "vitest"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("no-run-sync-in-handler", noRunSyncInHandler, {
  valid: [
    // Outside handler - allowed
    `Effect.runSync(myEffect)`,
    `Effect.runPromise(myEffect)`,
    // Inside handler but using Effect properly
    `handlers.handle("getUser", (req) => Effect.gen(function* () { return yield* service.findById(req.params.id) }))`,
  ],
  invalid: [
    {
      code: `handlers.handle("getUser", (req) => { const result = Effect.runSync(someEffect); return Effect.succeed(result) })`,
      errors: [{ messageId: "noRunSyncInHandler" }],
    },
    {
      code: `handlers.handle("getUser", async (req) => { await Effect.runPromise(someEffect) })`,
      errors: [{ messageId: "noRunSyncInHandler" }],
    },
    {
      code: `handlers.handle("getUser", (req) => { Effect.runFork(someEffect); return Effect.void })`,
      errors: [{ messageId: "noRunSyncInHandler" }],
    },
  ],
})
