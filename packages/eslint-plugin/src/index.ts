import { noRawPromise } from "./rules/no-raw-promise.js"
import { noTryCatch } from "./rules/no-try-catch.js"
import { taggedErrorRequired } from "./rules/tagged-error-required.js"
import { endpointResponseSchemaRequired } from "./rules/endpoint-response-schema-required.js"
import { endpointErrorSchemaRequired } from "./rules/endpoint-error-schema-required.js"
import { noRunSyncInHandler } from "./rules/no-run-sync-in-handler.js"
import { serviceInterfaceSeparation } from "./rules/service-interface-separation.js"

export const rules = {
  "no-raw-promise": noRawPromise,
  "no-try-catch": noTryCatch,
  "tagged-error-required": taggedErrorRequired,
  "endpoint-response-schema-required": endpointResponseSchemaRequired,
  "endpoint-error-schema-required": endpointErrorSchemaRequired,
  "no-run-sync-in-handler": noRunSyncInHandler,
  "service-interface-separation": serviceInterfaceSeparation,
}

const plugin = {
  rules,
  configs: {
    recommended: {
      plugins: {
        get "@sayo-ts"(): typeof plugin {
          return plugin
        },
      },
      rules: {
        "@sayo-ts/no-raw-promise": "error" as const,
        "@sayo-ts/no-try-catch": "error" as const,
        "@sayo-ts/tagged-error-required": "warn" as const,
        "@sayo-ts/endpoint-response-schema-required": "warn" as const,
        "@sayo-ts/endpoint-error-schema-required": "warn" as const,
        "@sayo-ts/no-run-sync-in-handler": "error" as const,
        "@sayo-ts/service-interface-separation": "warn" as const,
      },
    },
  },
}

export default plugin
