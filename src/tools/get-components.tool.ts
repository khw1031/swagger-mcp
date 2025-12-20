/**
 * get_components Tool
 * Retrieve the detailed information of the component schemas referenced by $ref
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { GetComponentsInputSchema } from "../schemas/tool-inputs.schema.js";
import { getComponents } from "../services/swagger-parser.service.js";

export const GET_COMPONENTS_TOOL_NAME = "get_components";
export const GET_COMPONENTS_TOOL_DESCRIPTION =
  "Retrieve the detailed information of the component schemas referenced by $ref. " +
  "The environment (environment) must be specified. " +
  "Use the componentRefs array returned from get_api_detail as the input. " +
  "Important: The serviceName parameter must match the exact 'serviceName' value from the list_services response. " +
  "If the user mentions a service in a different language, first call list_services to find the matching serviceName by checking the description field.";

export function registerGetComponentsTool(server: McpServer): void {
  server.registerTool(
    GET_COMPONENTS_TOOL_NAME,
    {
      description: GET_COMPONENTS_TOOL_DESCRIPTION,
      inputSchema: GetComponentsInputSchema.shape,
    },
    async ({ serviceName, environment, refs }) => {
      try {
        const components = await getComponents(serviceName, environment, refs);

        // Try to serialize to JSON (final circular reference validation)
        let responseText: string;
        try {
          responseText = JSON.stringify(
            {
              serviceName,
              environment,
              requestedRefs: refs,
              foundCount: Object.keys(components).length,
              components,
            },
            null,
            2
          );
        } catch (stringifyError) {
          // If JSON serialization fails, return only the schema references
          const schemaRefs = Object.keys(components);
          responseText = JSON.stringify(
            {
              serviceName,
              environment,
              requestedRefs: refs,
              foundCount: schemaRefs.length,
              error: "Circular reference detected in schemas. Only schema references are returned.",
              schemaRefs,
              hint: "Circular reference detected. Check the Swagger document directly or retrieve the individual schemas.",
            },
            null,
            2
          );
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          throw new McpError(ErrorCode.InvalidParams, error.message);
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error retrieving the component schemas: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  );
}
