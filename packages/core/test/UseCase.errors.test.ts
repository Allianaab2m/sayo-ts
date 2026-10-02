import { expectTypeErrors } from "./support/typeErrors.ts"

expectTypeErrors("UseCase.errors.ts", "UseCase.make rejects bodies that disagree with the spec")
