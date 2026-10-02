import { expectTypeErrors } from "./support/typeErrors.ts"

expectTypeErrors("Http.errors.ts", "Http rejects routes and apps that do not fit together")
