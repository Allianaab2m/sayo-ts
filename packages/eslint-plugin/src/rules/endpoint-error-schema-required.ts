import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"])

export const endpointErrorSchemaRequired = createRule({
  name: "endpoint-error-schema-required",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require HttpApiEndpoint definitions to include error schema declarations.",
    },
    messages: {
      endpointErrorSchemaRequired:
        "HttpApiEndpoint has no error declarations. If this handler can fail, declare error schemas with the `error` option so they appear in OpenAPI documentation and the client can handle them. If this endpoint truly never fails, disable this rule with an inline comment.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        // Match HttpApiEndpoint.get/post/...("name", "/path", options?)
        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          node.callee.object.type !== AST_NODE_TYPES.Identifier ||
          node.callee.object.name !== "HttpApiEndpoint" ||
          node.callee.property.type !== AST_NODE_TYPES.Identifier ||
          !HTTP_METHODS.has(node.callee.property.name)
        ) {
          return
        }

        // Check if options object has an `error` property
        const optionsArg = node.arguments[2]
        if (!optionsArg || optionsArg.type !== AST_NODE_TYPES.ObjectExpression) {
          context.report({ node, messageId: "endpointErrorSchemaRequired" })
          return
        }

        const hasError = optionsArg.properties.some(
          (prop) =>
            prop.type === AST_NODE_TYPES.Property &&
            prop.key.type === AST_NODE_TYPES.Identifier &&
            prop.key.name === "error",
        )

        if (!hasError) {
          context.report({ node, messageId: "endpointErrorSchemaRequired" })
        }
      },
    }
  },
})
