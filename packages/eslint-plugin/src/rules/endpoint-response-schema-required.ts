import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"])

export const endpointResponseSchemaRequired = createRule({
  name: "endpoint-response-schema-required",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require HttpApiEndpoint definitions to include a success response schema.",
    },
    messages: {
      endpointResponseSchemaRequired:
        "HttpApiEndpoint is missing a success response schema. Without a response schema, OpenAPI documentation will lack response type information and the derived client will have weak typing. Add a `success` option to the endpoint definition.",
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

        // Check if options object has a `success` property
        const optionsArg = node.arguments[2]
        if (!optionsArg || optionsArg.type !== AST_NODE_TYPES.ObjectExpression) {
          context.report({ node, messageId: "endpointResponseSchemaRequired" })
          return
        }

        const hasSuccess = optionsArg.properties.some(
          (prop) =>
            prop.type === AST_NODE_TYPES.Property &&
            prop.key.type === AST_NODE_TYPES.Identifier &&
            prop.key.name === "success",
        )

        if (!hasSuccess) {
          context.report({ node, messageId: "endpointResponseSchemaRequired" })
        }
      },
    }
  },
})
