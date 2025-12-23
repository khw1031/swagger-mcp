/**
 * @hynu/swagger-mcp Entry Point
 *
 * OpenAPI/Swagger documents are provided via the MCP protocol to support LLM-based API integration automation.
 */

import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { initSwaggerConfigs } from "./services/swagger-fetcher.service.js";

/**
 * Smithery entry point
 * Creates MCP server for Smithery deployment and capability discovery
 *
 * @returns MCP Server instance
 */
export default async function () {
  await initSwaggerConfigs();
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
