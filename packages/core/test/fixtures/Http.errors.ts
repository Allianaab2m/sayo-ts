// Each `// expect:` comment names a message tsc must report on the next line.
// Checked by test/Http.errors.test.ts.
import * as App from "../../src/App.ts"
import * as Http from "../../src/Http.ts"
import { Auth, AuthLive, GetTodo, Me } from "./http.ts"
import { TodosInMemory } from "./layers.ts"

Http.get(
  "/:todoId",
  // expect: Path parameter todoId is not a field of the UseCase input
  GetTodo
)

App.make({
  http: { me: Http.group("/me", { show: Http.get("/", Me) }) },
  profiles: {
    // expect: CurrentUser is required by the app but not provided by this profile
    test: [AuthLive]
  }
})

App.make({
  http: { me: Http.group("/me", { show: Http.get("/", Me) }).auth(Auth) },
  profiles: {
    // expect: Auth is required by the app but not provided by this profile
    test: [TodosInMemory()]
  }
})

// OK: the middleware provides CurrentUser, and the profile provides the middleware
App.make({
  http: { me: Http.group("/me", { show: Http.get("/", Me) }).auth(Auth) },
  profiles: { test: [AuthLive] }
})
