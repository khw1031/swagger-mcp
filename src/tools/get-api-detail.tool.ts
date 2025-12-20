/**
 * get_api_detail Tool
 * Retrieve the detailed specification of a specific API
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { GetApiDetailInputSchema } from "../schemas/tool-inputs.schema.js";
import { getApiDetail } from "../services/swagger-parser.service.js";

export const GET_API_DETAIL_TOOL_NAME = "get_api_detail";
export const GET_API_DETAIL_TOOL_DESCRIPTION =
  "Retrieve the detailed specification of a specific API (parameters, requestBody, responses). " +
  "The environment (environment) must be specified. " +
  "The components referenced by $ref are returned in the componentRefs array (collected up to a maximum depth of 2). " +
  "The get_components Tool can be used to retrieve the detailed schema. " +
  "If meta.depthLimitReached is true, there may be some $refs that are not collected due to deeply nested schemas. " +
  "Important: The serviceName parameter must match the exact 'serviceName' value from the list_services response. " +
  "If the user mentions a service in a different language, first call list_services to find the matching serviceName by checking the description field.";

export function registerGetApiDetailTool(server: McpServer): void {
  server.registerTool(
    GET_API_DETAIL_TOOL_NAME,
    {
      description: GET_API_DETAIL_TOOL_DESCRIPTION,
      inputSchema: GetApiDetailInputSchema.shape,
    },
    async ({ serviceName, environment, path, method }) => {
      try {
        const detail = await getApiDetail(serviceName, environment, path, method);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  serviceName,
                  environment,
                  path,
                  method: method.toUpperCase(),
                  ...detail,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          throw new McpError(ErrorCode.InvalidParams, error.message);
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error retrieving the detailed specification of a specific API: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  );
}
