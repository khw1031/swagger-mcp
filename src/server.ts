/**
 * MCP Server instance configuration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import pkg from "../package.json" with { type: "json" };

/**
 * Create and configure MCP Server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  // Register Tools
  registerTools(server);

  return server;
}
