import { ESLintUtils } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

const PROMISE_STATIC_METHODS = new Set([
  "resolve",
  "reject",
  "all",
  "race",
  "allSettled",
  "any",
])

export const noRawPromise = createRule({
  name: "no-raw-promise",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct usage of Promise. Use Effect.tryPromise() or Effect.gen with yield* instead.",
    },
    messages: {
      noRawPromise:
        "Raw Promise usage detected. Use Effect.tryPromise() to wrap existing Promise-based APIs, or use Effect.gen with yield* for async operations.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Promise"
        ) {
          context.report({ node, messageId: "noRawPromise" })
        }
      },
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "Promise" &&
          node.property.type === "Identifier" &&
          PROMISE_STATIC_METHODS.has(node.property.name)
        ) {
          // Allow if inside Effect.tryPromise argument
          context.report({ node, messageId: "noRawPromise" })
        }
      },
    }
  },
})
