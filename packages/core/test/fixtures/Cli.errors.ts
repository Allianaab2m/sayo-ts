// Each `// expect:` comment names a message tsc must report on the next line.
// Checked by test/Cli.errors.test.ts.
import * as App from "../../src/App.ts"
import * as Cli from "../../src/Cli.ts"
import { Exists, Greet } from "./cli.ts"
import { CompleteTodo } from "./usecases.ts"

Cli.command(Greet, {
  // expect: Type '"nickname"' is not assignable to type '"loud" | "name" | "suffix" | "times"'
  args: ["nickname"]
})

App.make({
  cli: { todo: { complete: Cli.command(CompleteTodo, { args: ["id"] }) } },
  profiles: {
    // expect: Todos is required by the app but not provided by this profile
    local: []
  }
})

// OK: FileSystem comes from the CLI platform, not from a profile
App.make({
  cli: { exists: Cli.command(Exists, { args: ["path"] }) },
  profiles: { local: [] }
})
