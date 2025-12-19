/**
 * list_apis Tool
 * Retrieve the list of APIs for a specific service
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ListApisInputSchema } from "../schemas/tool-inputs.schema.js";
import { listApis } from "../services/swagger-parser.service.js";

export const LIST_APIS_TOOL_NAME = "list_apis";
export const LIST_APIS_TOOL_DESCRIPTION =
  "Retrieve the list of APIs for a specific service. " +
  "The environment (environment) must be specified. " +
  "For token optimization, only the summarized information (path, method, operationId, summary, tags) is returned.";

export function registerListApisTool(server: McpServer): void {
  server.registerTool(
    LIST_APIS_TOOL_NAME,
    {
      description: LIST_APIS_TOOL_DESCRIPTION,
      inputSchema: ListApisInputSchema.shape,
    },
    async ({ serviceName, environment, apiGroup }) => {
      try {
        const apis = await listApis(serviceName, environment, apiGroup);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  serviceName,
                  environment,
                  apiGroup: apiGroup || "all",
                  apiCount: Object.keys(apis).length,
                  apis,
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
          `Error retrieving the list of APIs: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  );
}
