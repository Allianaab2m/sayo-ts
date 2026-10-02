// Each `// expect:` comment names a message tsc must report on the next line.
// Checked by test/App.errors.test.ts.
import { Layer } from "effect"
import * as App from "../../src/App.ts"
import { Clock } from "./domain.ts"
import { makeDb, TodosFromDb, TodosInMemory } from "./layers.ts"
import { CompleteTodo, Now } from "./usecases.ts"

const FixedClock = Layer.succeed(Clock, { now: () => 0 })

App.make({
  usecases: [CompleteTodo, Now],
  profiles: {
    // expect: Clock is required by a UseCase but not provided by this profile
    local: [TodosInMemory()],
    prod: [makeDb(), TodosFromDb, FixedClock]
  }
})

App.make({
  usecases: [CompleteTodo],
  profiles: {
    prod: [
      // expect: Db must be provided by a layer listed before this one
      TodosFromDb,
      makeDb()
    ]
  }
})

App.make({
  usecases: [CompleteTodo],
  profiles: {
    prod: [
      // expect: Db is not provided by any layer in this profile
      TodosFromDb
    ]
  }
})
