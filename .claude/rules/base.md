# SYSTEM_CODING_GUIDELINES

## 1. PROJECT_STRUCTURE

MCP server projects are structured with functional module separation as a principle.

- Do not write all logic in a single file. Separate `tools/`, `resources/`, `schemas/` directories.

```txt
/
├── src/
│   ├── index.ts              # Entry point, server bootstrap
│   ├── server.ts             # McpServer instance configuration
│   ├── tools/                # MCP Tool definitions
│   │   ├── index.ts
│   │   ├── list-services.tool.ts
│   │   ├── get-api-spec.tool.ts
│   │   └── get-api-detail.tool.ts
│   ├── resources/            # MCP Resource definitions (read-only data)
│   │   └── swagger-docs.resource.ts
│   ├── schemas/              # Zod schema definitions
│   │   ├── tool-inputs.schema.ts
│   │   └── swagger.schema.ts
│   ├── services/             # Business logic
│   │   ├── swagger-parser.service.ts
│   │   └── swagger-fetcher.service.ts
│   └── types/                # TypeScript type definitions
│       └── swagger.types.ts
├── tsdown.config.ts
├── tsconfig.json
└── package.json
```

Provide internal Swagger list via Resource.

```ts
// Load internal Swagger list from configuration file
const swaggerDocs = loadSwaggerConfig();

// Provide Resource so LLM can first understand the list
server.resource("swagger-docs", "swagger://list", async () => ({
  contents: [{
    uri: "swagger://list",
    text: JSON.stringify(swaggerDocs.map(d => ({ name: d.name, description: d.description })))
  }]
}));

// Tools query by service name
server.tool("list_apis_by_service", {
  serviceName: z.string().describe("Service name to query"),
}, async ({ serviceName }) => {
  const doc = swaggerDocs.find(d => d.name === serviceName);
  if (!doc) throw new McpError(ErrorCode.InvalidParams, `Service not found: ${serviceName}`);
  // ...
});
```
```json
// MCP configuration example
{
  "mcpServers": {
    "swagger": {
      "command": "npx",
      "args": ["swagger-mcp"],
      "env": {
        "SWAGGER_CONFIG_PATH": "/path/to/swagger-config.json"
      }
    }
  }
}
```

## 2. MCP_SERVER_INITIALIZATION

Create McpServer instance with clear name/version and capabilities declaration.

- Use McpServer high-level API instead of Server class. (SDK recommendation)

```ts
// ✓ Recommended
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "swagger-mcp-server",
  version: "1.0.0",
});

// Transport connection is performed last after server setup is complete
const transport = new StdioServerTransport();
await server.connect(transport);

// ✗ Avoid
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
// Direct use of low-level Server class increases complexity
```

## 3. TOOL_DEFINITION_PATTERN

When defining Tools, pass name, Zod schema, and async handler in order to `server.tool()` method.

- Tool names use snake_case and follow verb_object naming pattern.

```ts
// ✓ Recommended
import { z } from "zod/v4";

server.tool(
  "list_swagger_services",
  "Returns a list of all API services registered in Swagger documents",
  {
    swaggerUrl: z.url().describe("Swagger JSON/YAML document URL"),
  },
  async ({ swaggerUrl }) => {
    const services = await swaggerService.listServices(swaggerUrl);
    return {
      content: [{ type: "text", text: JSON.stringify(services, null, 2) }],
    };
  }
);

// ✗ Avoid
server.tool(
  "getServices", // camelCase prohibited
  { url: z.string() }, // description missing
  async (args) => {
    /* ... */
  }
);
```

## 4. SWAGGER_DRILL_DOWN_STRATEGY

Document queries are implemented in a 3-step drill-down approach (service list → API spec → detailed information)

- Do not return the entire Swagger document at once. Prevents exceeding LLM token limits

```ts
// ✓ Recommended: Separate Tools for step-by-step queries
// Tool 1: Return only service list
server.tool(
  "list_api_services",
  "Query API service (tag) list",
  {
    swaggerUrl: z.url(),
  },
  async ({ swaggerUrl }) => {
    const doc = await parseSwagger(swaggerUrl);
    const services = doc.tags?.map((t) => ({
      name: t.name,
      description: t.description,
    }));
    return { content: [{ type: "text", text: JSON.stringify(services) }] };
  }
);

// Tool 2: Return API list for specific service
server.tool(
  "list_apis_by_service",
  "Query API endpoint list for specific service",
  {
    swaggerUrl: z.url(),
    serviceName: z.string().describe("Service (tag) name to query"),
  },
  async ({ swaggerUrl, serviceName }) => {
    const apis = await getApisByTag(swaggerUrl, serviceName);
    return { content: [{ type: "text", text: JSON.stringify(apis) }] };
  }
);

// Tool 3: Return detailed spec for specific API
server.tool(
  "get_api_detail",
  "Query detailed spec for specific API",
  {
    swaggerUrl: z.url(),
    path: z.string().describe("API path (e.g., /users/{id})"),
    method: z.enum(["get", "post", "put", "delete", "patch"]),
  },
  async ({ swaggerUrl, path, method }) => {
    const detail = await getApiDetail(swaggerUrl, path, method);
    return { content: [{ type: "text", text: JSON.stringify(detail) }] };
  }
);

// ✗ Avoid: Return entire document at once
server.tool("get_full_swagger", {}, async () => {
  const fullDoc = await parseSwagger(url);
  return { content: [{ type: "text", text: JSON.stringify(fullDoc) }] }; // Risk of token overflow
});
```

## 5. ZOD_SCHEMA_DEFINITION

Define all Tool inputs with Zod schemas and add descriptions for LLMs using `.describe()`.

- Prohibit use of `z.any()`. Specify concrete types whenever possible.

Use Zod v4.

```ts
// ✓ Recommended
import { z } from "zod/v4";

// Separate reusable schemas into separate files
export const SwaggerUrlSchema = z
  .url()
  .describe("URL of Swagger/OpenAPI document (JSON or YAML)");

export const HttpMethodSchema = z
  .enum(["get", "post", "put", "delete", "patch"])
  .describe("HTTP method");

export const GetApiDetailInputSchema = z.object({
  swaggerUrl: SwaggerUrlSchema,
  path: z.string().describe("API endpoint path (e.g., /api/users/{id})"),
  method: HttpMethodSchema,
});

// Utilize type inference
type GetApiDetailInput = z.infer<typeof GetApiDetailInputSchema>;

// ✗ Avoid
const badSchema = z.object({
  url: z.string(), // describe() missing
  data: z.any(), // any type used
});
```

## 6. SWAGGER_PARSER_SELECTION

Use `@scalar/openapi-parser` or `@readme/openapi-parser` for Swagger/OpenAPI parsing.

- Choose actively maintained libraries instead of deprecated `swagger-parser`

```ts
// ✓ Recommended: @scalar/openapi-parser
import { dereference, validate } from "@scalar/openapi-parser";

async function parseSwaggerDocument(url: string) {
  const response = await fetch(url);
  const content = await response.text();

  // Validation
  const { valid, errors } = await validate(content);
  if (!valid) {
    throw new Error(`Invalid OpenAPI spec: ${JSON.stringify(errors)}`);
  }

  // Resolve $ref (dereference)
  const { schema } = await dereference(content);
  return schema;
}

// ✓ Alternative: @readme/openapi-parser
import { validate, dereference } from "@readme/openapi-parser";

// ✗ Avoid: Legacy package
import SwaggerParser from "swagger-parser"; // No updates for over 4 years
```

## 7. ERROR_HANDLING_PATTERN

When errors occur during Tool execution, throw McpError or return structured error responses.

- Write error messages clearly so LLMs can understand them.

```ts
// ✓ Recommended
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

server.tool("get_api_detail", schema, async ({ swaggerUrl, path, method }) => {
  try {
    const doc = await parseSwagger(swaggerUrl);
    const pathItem = doc.paths?.[path];

    if (!pathItem) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `API path not found: ${path}. Please verify it is a valid path.`
      );
    }

    const operation = pathItem[method];
    if (!operation) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `${method.toUpperCase()} method not found in ${path}.`
      );
    }

    return { content: [{ type: "text", text: JSON.stringify(operation) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;

    // Wrap unexpected errors as InternalError
    throw new McpError(
      ErrorCode.InternalError,
      `Error processing Swagger document: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
});

// ✗ Avoid
server.tool("bad_tool", schema, async (args) => {
  const data = await someOperation(); // No error handling
  return { content: [{ type: "text", text: data }] };
});
```

## 8. RESPONSE_FORMAT_OPTIMIZATION

Tool responses are returned in structured JSON format that is easy for LLMs to parse

- Include only core information, excluding unnecessary metadata

```ts
// ✓ Recommended: Return only extracted core information
interface ApiSummary {
  path: string;
  method: string;
  summary: string;
  operationId?: string;
  tags: string[];
}

server.tool(
  "list_apis_by_service",
  schema,
  async ({ swaggerUrl, serviceName }) => {
    const doc = await parseSwagger(swaggerUrl);

    const apis: ApiSummary[] = [];
    for (const [path, pathItem] of Object.entries(doc.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem || {})) {
        if (operation.tags?.includes(serviceName)) {
          apis.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary || "",
            operationId: operation.operationId,
            tags: operation.tags || [],
          });
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { serviceName, apiCount: apis.length, apis },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ✗ Avoid: Return original Swagger spec as-is
return { content: [{ type: "text", text: JSON.stringify(doc.paths[path]) }] };
// Includes unnecessary data like x-* extension fields, examples, etc.
```

## 9. NAMING_CONVENTIONS

Apply consistent naming conventions throughout the project

- Maintain consistency between file names and export names

| Target      | Convention            | Examples                                     |
| ----------- | --------------------- | -------------------------------------------- |
| Tool name   | snake_case            | list_api_services, get_api_detail           |
| File name   | kebab-case, .type.ts | list-services.tool.ts, swagger.schema.ts     |
| Class/Type  | PascalCase            | SwaggerDocument, ApiSummary                  |
| Function/Variable | camelCase         | parseSwagger, apiList                        |
| Constant    | UPPER_SNAKE_CASE      | DEFAULT_TIMEOUT, MAX_RETRY_COUNT             |
| Zod Schema  | PascalCase + Schema   | GetApiDetailInputSchema                      |

```ts
// ✓ Recommended
// src/tools/list-services.tool.ts
export const LIST_SERVICES_TOOL_NAME = "list_swagger_services";

export const ListServicesInputSchema = z.object({
  swaggerUrl: z.url(),
});

export type ListServicesInput = z.infer<typeof ListServicesInputSchema>;

export function registerListServicesTool(server: McpServer): void {
  server.tool(
    LIST_SERVICES_TOOL_NAME,
    ListServicesInputSchema,
    async (input) => {
      // ...
    }
  );
}
```

## 10. TSDOWN_CONFIGURATION

Use tsdown only for TypeScript → JavaScript conversion, creating a single executable entry point

- `dts` generation unnecessary, `external` configuration unnecessary

```txt
// tsdown.config.ts
// ✓ Recommended (standalone)
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  clean: true,
  target: "node20",
});

// package.json
{
  "name": "swagger-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "swagger-mcp": "./dist/index.mjs"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@scalar/openapi-parser": "^0.8.0",
    "zod": "^3.25.0"
  }
}

// ✗ Library distribution configuration (unnecessary for this project)
export default defineConfig({
  dts: true,                    // Type declarations unnecessary
  external: ["zod", "@modelcontextprotocol/sdk"],  // Peer handling unnecessary
  exports: { ".": { import: "...", types: "..." } },  // Export map unnecessary
});
```

## 11. TYPESCRIPT_STRICT_CONFIGURATION

Enable strict mode in tsconfig.json. Required for Zod usage.

## 12. TRANSPORT_SELECTION

Use only StdioServerTransport.
- No need to write HTTP, SSE transport related code.

```ts
// ✓ Recommended (local execution only)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "swagger-mcp-server",
  version: "1.0.0",
});

// Register Tools...

// stdio connection (that's all)
const transport = new StdioServerTransport();
await server.connect(transport);

// ✗ Unnecessary code (remove from this project)
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
// Entire remote server functionality unnecessary
```
