import { expectTypeErrors } from "./support/typeErrors.ts"

expectTypeErrors("App.errors.ts", "App.make rejects profiles that do not wire every requirement")
