/**
 * MCP Tools registration integration module
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListServicesTool } from "./list-services.tool.js";
import { registerListApisTool } from "./list-apis.tool.js";
import { registerGetApiDetailTool } from "./get-api-detail.tool.js";
import { registerGetComponentsTool } from "./get-components.tool.js";

/**
 * Register all MCP Tools to the server
 */
export function registerTools(server: McpServer): void {
  registerListServicesTool(server);
  registerListApisTool(server);
  registerGetApiDetailTool(server);
  registerGetComponentsTool(server);
}
