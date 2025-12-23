/**
 * Smithery entry point for @hynu/swagger-mcp
 *
 * This file exports the default createServer function required by Smithery.
 * The config is received from Smithery's configSchema and used to initialize
 * the Swagger service configurations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { setSwaggerConfigs } from "./services/swagger-fetcher.service.js";
import { SwaggerConfigSchema, type SwaggerDocConfig } from "./schemas/swagger.schema.js";
import pkg from "../package.json" with { type: "json" };

interface SmitheryConfig {
  services: Array<{
    name: string;
    environment: string;
    description?: string;
    url: string;
  }>;
}

/**
 * Create MCP Server for Smithery deployment
 *
 * @param options - Smithery options containing config
 * @returns McpServer instance
 */
export default function createServer({ config }: { config: SmitheryConfig }) {
  // Validate and set swagger configurations
  const result = SwaggerConfigSchema.safeParse(config);

  if (result.success) {
    setSwaggerConfigs(result.data.services);
  } else {
    console.error("[swagger-mcp] Invalid config:", result.error.message);
    setSwaggerConfigs([]);
  }

  // Create MCP server
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  // Register Tools
  registerTools(server);

  return server.server;
}
