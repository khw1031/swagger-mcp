/**
 * @hynu/swagger-mcp Entry Point
 *
 * OpenAPI/Swagger documents are provided via the MCP protocol to support LLM-based API integration automation.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { initSwaggerConfigs } from "./services/swagger-fetcher.service.js";

async function main(): Promise<void> {
  // Initialize Swagger configurations
  await initSwaggerConfigs();

  // Create MCP server
  const server = createServer();

  // Connect Stdio Transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
