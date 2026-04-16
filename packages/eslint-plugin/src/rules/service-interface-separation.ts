import { ESLintUtils } from "@typescript-eslint/utils"
import type { TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/Allianaab2m/sayo-ts/blob/main/docs/rules/${name}.md`,
)

export const serviceInterfaceSeparation = createRule({
  name: "service-interface-separation",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when Service interface and Layer implementation are in the same file.",
    },
    messages: {
      serviceInterfaceSeparation:
        "Service interface and implementation are in the same file. Consider separating them:\n  - service.ts      → Context.Service definition (interface/port)\n  - service.live.ts → Layer implementation (adapter)\nThis enables easy Layer replacement for testing.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let hasServiceDefinition = false
    let hasLayerImplementation = false
    let programNode: TSESTree.Program | undefined

    return {
      Program(node) {
        programNode = node
      },

      MemberExpression(node) {
        // Detect Context.Service usage
        if (
          node.object.type === "Identifier" &&
          node.object.name === "Context" &&
          node.property.type === "Identifier" &&
          node.property.name === "Service"
        ) {
          hasServiceDefinition = true
        }

        // Detect Layer.succeed or Layer.effect
        if (
          node.object.type === "Identifier" &&
          node.object.name === "Layer" &&
          node.property.type === "Identifier" &&
          (node.property.name === "succeed" || node.property.name === "effect")
        ) {
          hasLayerImplementation = true
        }
      },

      "Program:exit"() {
        if (hasServiceDefinition && hasLayerImplementation && programNode) {
          context.report({
            node: programNode,
            messageId: "serviceInterfaceSeparation",
          })
        }
      },
    }
  },
})
