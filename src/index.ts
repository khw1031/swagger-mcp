/**
 * @hynu/swagger-mcp Entry Point
 *
 * OpenAPI/Swagger documents are provided via the MCP protocol to support LLM-based API integration automation.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod/v4";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { initSwaggerConfigs } from "./services/swagger-fetcher.service.js";

/**
 * Smithery configSchema
 * Defines the configuration options for the MCP server
 */
export const configSchema = z.object({
  swaggerConfigPath: z
    .string()
    .describe("Absolute path to the swagger-config.json file"),
});

type SmitheryConfig = z.infer<typeof configSchema>;

/**
 * Smithery entry point
 * Creates MCP server for Smithery deployment and capability discovery
 *
 * @param options - Smithery options containing config
 * @returns MCP Server instance
 */
export default async function (options?: { config?: SmitheryConfig }) {
  const configPath = options?.config?.swaggerConfigPath;
  await initSwaggerConfigs(configPath);
  const mcpServer = createServer();
  return mcpServer.server;
}

/**
 * CLI entry point
 * Runs MCP server with stdio transport for local execution
 */
async function main(): Promise<void> {
  await initSwaggerConfigs();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run CLI only when executed directly (not when imported by Smithery)
const __filename = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === __filename;

if (isDirectRun) {
  main().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });
}
