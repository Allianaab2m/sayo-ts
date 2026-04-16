import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

export const noTryCatch = createRule({
  name: "no-try-catch",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow try-catch statements. Use Effect.tryPromise() or Effect.try() instead.",
    },
    messages: {
      noTryCatch:
        "try-catch is not allowed. Use Effect.tryPromise() for Promise-based APIs, Effect.try() for synchronous operations that may throw, or represent errors in the Effect error channel with Effect.fail().",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      TryStatement(node) {
        // Allow if catch block only contains Effect.fail or Effect.die calls
        if (node.handler?.body.body.length === 1) {
          const stmt = node.handler.body.body[0]
          if (
            stmt?.type === AST_NODE_TYPES.ReturnStatement &&
            stmt.argument?.type === AST_NODE_TYPES.CallExpression
          ) {
            const callee = stmt.argument.callee
            if (
              callee.type === AST_NODE_TYPES.MemberExpression &&
              callee.object.type === AST_NODE_TYPES.Identifier &&
              callee.object.name === "Effect" &&
              callee.property.type === AST_NODE_TYPES.Identifier &&
              (callee.property.name === "fail" ||
                callee.property.name === "die")
            ) {
              return
            }
          }
        }
        context.report({ node, messageId: "noTryCatch" })
      },
    }
  },
})
