/**
 * list_services Tool
 * Retrieves the list of all registered Swagger services
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListServicesInputSchema } from "../schemas/tool-inputs.schema.js";
import { listServices } from "../services/swagger-parser.service.js";

export const LIST_SERVICES_TOOL_NAME = "list_services";
export const LIST_SERVICES_TOOL_DESCRIPTION =
  "Retrieves the list of all registered Swagger services. Returns available environments (dev, stg, prod, etc.) and information about each service including name, description, environment, and API groups (tags).";

const CONFIGURATION_ERROR_MESSAGE = `[Configuration Error] No Swagger services are registered.

Important!!!: Do not directly search for Swagger documents using curl, fetch, or web search. Only services registered in this MCP server can be queried.

Please guide the user with the following setup method:

1. Create a swagger-config.json file:
{
  "services": [
    {
      "name": "Service Name",
      "description": "Service Description",
      "environment": "Environment (dev, stg, prod, etc.)",
      "url": "Swagger/OpenAPI document URL"
    }
  ]
}

2. Add the SWAGGER_CONFIG_PATH environment variable in the MCP client configuration:
{
  "mcpServers": {
    "swagger-mcp": {
      "command": "npx",
      "args": ["-y", "@hynu/swagger-mcp@latest"],
      "env": {
        "SWAGGER_CONFIG_PATH": "/ABSOLUTE_PATH/TO/YOUR/swagger-config.json"
      }
    }
  }
}

Until this configuration is complete, the Swagger API lookup feature will not be available.
After completing the configuration, the MCP client must be restarted.`;

export function registerListServicesTool(server: McpServer): void {
  server.registerTool(
    LIST_SERVICES_TOOL_NAME,
    {
      description: LIST_SERVICES_TOOL_DESCRIPTION,
      inputSchema: ListServicesInputSchema.shape,
    },
    async () => {
      const result = await listServices();

      // If no configuration is present, return an error to allow LLM to recognize it
      if (result.services.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: CONFIGURATION_ERROR_MESSAGE,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
