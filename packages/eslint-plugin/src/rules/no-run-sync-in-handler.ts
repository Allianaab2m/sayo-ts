import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils"
import type { TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

const FORBIDDEN_RUN_METHODS = new Set(["runSync", "runPromise", "runFork"])

const isInsideHandleCallback = (node: TSESTree.Node): boolean => {
  let current: TSESTree.Node | undefined = node.parent
  while (current) {
    // Look for .handle("name", callback) pattern
    if (
      current.type === AST_NODE_TYPES.CallExpression &&
      current.callee.type === AST_NODE_TYPES.MemberExpression &&
      current.callee.property.type === AST_NODE_TYPES.Identifier &&
      current.callee.property.name === "handle"
    ) {
      return true
    }
    current = current.parent
  }
  return false
}

export const noRunSyncInHandler = createRule({
  name: "no-run-sync-in-handler",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.runSync/runPromise/runFork inside HttpApiBuilder handlers.",
    },
    messages: {
      noRunSyncInHandler:
        "Do not call Effect.runSync/runPromise/runFork inside a handler. Handlers should return an Effect, which the framework will execute. Running effects manually breaks the fiber runtime and error tracking.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type !== AST_NODE_TYPES.Identifier ||
          node.object.name !== "Effect" ||
          node.property.type !== AST_NODE_TYPES.Identifier ||
          !FORBIDDEN_RUN_METHODS.has(node.property.name)
        ) {
          return
        }

        if (isInsideHandleCallback(node)) {
          context.report({ node, messageId: "noRunSyncInHandler" })
        }
      },
    }
  },
})
