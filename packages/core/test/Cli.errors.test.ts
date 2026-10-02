import { expectTypeErrors } from "./support/typeErrors.ts"

expectTypeErrors("Cli.errors.ts", "Cli rejects commands and apps that do not fit together")
