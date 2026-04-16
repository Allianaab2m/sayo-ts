#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const toPascalCase = (str: string): string =>
  str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")

const toCamelCase = (str: string): string => {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

const generateErrors = (name: string): string => {
  const pascal = toPascalCase(name)
  return `import { Schema } from "effect"

export class ${pascal}NotFound extends Schema.TaggedErrorClass<${pascal}NotFound>()(
  "${pascal}NotFound",
  { ${toCamelCase(name)}Id: Schema.String },
) {}
`
}

const generateSchemas = (name: string): string => {
  const pascal = toPascalCase(name)
  return `import { Schema } from "effect"

export class ${pascal}Response extends Schema.Class<${pascal}Response>("${pascal}Response")({
  id: Schema.String,
}) {}

export const Create${pascal}Request = Schema.Struct({})

export type Create${pascal}Request = typeof Create${pascal}Request.Type
`
}

const generateService = (name: string): string => {
  const pascal = toPascalCase(name)
  return `import { Context, Effect } from "effect"
import type { ${pascal}Response } from "./schemas.js"
import type { ${pascal}NotFound } from "./errors.js"

export class ${pascal}Service extends Context.Service<
  ${pascal}Service,
  {
    readonly findById: (
      id: string,
    ) => Effect.Effect<${pascal}Response, ${pascal}NotFound>
  }
>()("${pascal}Service") {}
`
}

const generateServiceLive = (name: string): string => {
  const pascal = toPascalCase(name)
  return `import { Effect, Layer } from "effect"
import { ${pascal}Service } from "./service.js"
import { ${pascal}NotFound } from "./errors.js"
import { ${pascal}Response } from "./schemas.js"

export const ${pascal}ServiceLive: Layer.Layer<${pascal}Service> = Layer.succeed(
  ${pascal}Service,
  ${pascal}Service.of({
    findById: (id) =>
      Effect.gen(function* () {
        // TODO: implement
        return yield* new ${pascal}NotFound({ ${toCamelCase(name)}Id: id })
      }),
  }),
)
`
}

const generateApi = (name: string): string => {
  const pascal = toPascalCase(name)
  return `import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { ${pascal}Response } from "./schemas.js"
import { ${pascal}NotFound } from "./errors.js"

const get${pascal} = HttpApiEndpoint.get("get${pascal}", "/${name}s/:id", {
  params: { id: Schema.String },
  success: ${pascal}Response,
  error: ${pascal}NotFound.pipe(HttpApiSchema.status(404)),
})

export const ${pascal}sGroup = HttpApiGroup.make("${pascal}s").add(get${pascal})
`
}

const generateHandlers = (name: string): string => {
  const pascal = toPascalCase(name)
  return `import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { AppApi } from "../api.js"
import { ${pascal}Service } from "./service.js"

export const ${pascal}sHandlers = HttpApiBuilder.group(
  AppApi,
  "${pascal}s",
  (handlers) =>
    handlers.handle("get${pascal}", (req) =>
      Effect.gen(function* () {
        const service = yield* ${pascal}Service
        return yield* service.findById(req.params.id)
      }),
    ),
)
`
}

const main = async () => {
  const command = process.argv[2]
  const name = process.argv[3]

  if (command !== "generate" && command !== "g") {
    console.error("Usage: sayo generate <name>")
    console.error("       sayo g <name>")
    process.exit(1)
  }

  if (!name) {
    console.error("Usage: sayo generate <name>")
    process.exit(1)
  }

  const dir = join(process.cwd(), "src", name)
  await mkdir(dir, { recursive: true })

  const files = [
    ["errors.ts", generateErrors(name)],
    ["schemas.ts", generateSchemas(name)],
    ["service.ts", generateService(name)],
    ["service.live.ts", generateServiceLive(name)],
    ["api.ts", generateApi(name)],
    ["handlers.ts", generateHandlers(name)],
  ] as const

  for (const [filename, content] of files) {
    const filepath = join(dir, filename)
    await writeFile(filepath, content)
    console.log(`  created ${join("src", name, filename)}`)
  }

  console.log(`
Scaffolding complete! Next steps:

1. Add ${toPascalCase(name)}sGroup to your api.ts:
   import { ${toPascalCase(name)}sGroup } from "./${name}/api.js"
   export const AppApi = HttpApi.make("AppApi").add(${toPascalCase(name)}sGroup)

2. Add ${toPascalCase(name)}sHandlers and ${toPascalCase(name)}ServiceLive to your App.launch layers

3. Implement the service in ${name}/service.live.ts
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
