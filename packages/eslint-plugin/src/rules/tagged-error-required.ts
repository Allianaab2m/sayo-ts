import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

export const taggedErrorRequired = createRule({
  name: "tagged-error-required",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require Schema.TaggedErrorClass for error types passed to Effect.fail().",
    },
    messages: {
      taggedErrorRequired:
        'Use Schema.TaggedErrorClass for error types instead of plain Error or strings. Tagged errors are tracked in the Effect type parameter and enable exhaustive error handling.\n\nExample:\n  class MyError extends Schema.TaggedErrorClass<MyError>()("MyError", {\n    message: Schema.String\n  }) {}\n\n  Effect.fail(new MyError({ message: "something went wrong" }))',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        // Match Effect.fail(...)
        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          node.callee.object.type !== AST_NODE_TYPES.Identifier ||
          node.callee.object.name !== "Effect" ||
          node.callee.property.type !== AST_NODE_TYPES.Identifier ||
          node.callee.property.name !== "fail"
        ) {
          return
        }

        const arg = node.arguments[0]
        if (!arg) return

        // Flag string literals
        if (arg.type === AST_NODE_TYPES.Literal && typeof arg.value === "string") {
          context.report({ node, messageId: "taggedErrorRequired" })
          return
        }

        // Flag new Error(...)
        if (
          arg.type === AST_NODE_TYPES.NewExpression &&
          arg.callee.type === AST_NODE_TYPES.Identifier &&
          arg.callee.name === "Error"
        ) {
          context.report({ node, messageId: "taggedErrorRequired" })
          return
        }

        // Flag plain objects
        if (arg.type === AST_NODE_TYPES.ObjectExpression) {
          context.report({ node, messageId: "taggedErrorRequired" })
        }
      },
    }
  },
})
