/**
 * Smithery entry point for @hynu/swagger-mcp
 *
 * This file exports the default createServer function required by Smithery.
 * It initializes Swagger configurations from SWAGGER_CONFIG_PATH environment variable
 * and creates the MCP server using existing logic.
 */

import { initSwaggerConfigs } from "./services/swagger-fetcher.service.js";
import { createServer } from "./server.js";

/**
 * Create MCP Server for Smithery deployment
 *
 * Uses existing logic:
 * - Reads config from SWAGGER_CONFIG_PATH environment variable
 * - Creates MCP server with registered tools
 *
 * @returns McpServer instance
 */
export default async function () {
  await initSwaggerConfigs();
  return createServer();
}
