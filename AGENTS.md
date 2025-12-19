# @hynu/swagger-mcp

- Purpose: Provide OpenAPI/Swagger documents via MCP protocol to support LLM-based API integration automation
- Tech Stack: TypeScript, Zod v4, pnpm, tsdown, @modelcontextprotocol/sdk, @scalar/openapi-parser
- Target Users: Swagger users

## Executive Summary

@hynu/swagger-mcp is an open-source mcp server that provides API documentation (Swagger/OpenAPI) to LLMs through the Model Context Protocol (MCP). This enables developers to query API specifications using natural language and automatically generate API integration code with LLM assistance.

## Usage Example

- Server Developer: Simply notify API completion in natural language (e.g., "Display API development completed.")
- Integration Developer: Instantly query API specs through MCP clients (Cursor, Claude Code, Gemini, etc.).
- LLM analyzes API specs and supports automatic integration code generation.
- Client API integration work with prompts like "Use display API for integration request".
- Minimize time spent on API spec sharing, improve developer productivity.

## Technical Requirements

- Runtime: Node.js 24+ (LTS)
- Language: TypeScript
- Validation: Zod v4
- Package Manager: pnpm
- Bundler: tsdown
- MCP SDK: @modelcontextprotocol/sdk
- OpenAPI Parser: @scalar/openapi-parser

### System Architecture

The MCP server operates in a Stateless HTTP manner with the following structure:

- Transport Layer: Stateless Streamable HTTP (no session state maintenance, suitable for MSA environments)
- MCP Server: Tool and Resource provision based on @modelcontextprotocol/sdk
- OpenAPI Parser: Swagger/OpenAPI document parsing through @scalar/openapi-parser
- Data Source: Internal Swagger endpoints or static OpenAPI JSON/YAML files

### MCP Tools Definition

The following 4 Tools are provided sequentially to enable LLMs to query API information step by step:

1. list_services

- Retrieve a list of all registered services

```txt
Input: None
Output: Array<{ serviceName: string, description?: string, apiGroups: string[] }>
```

2. list_apis

- Retrieve the API list for a specific service. Returns only summarized information considering token limitations.

```txt
Input: { serviceName: string, apiGroup?: string }
Output: Record<path, Record<method, { operationId, summary, tags }>>
```

3. get_api_detail

- Retrieve detailed spec (parameters, requestBody, responses) for a specific API.

```txt
Input: { serviceName: string, path: string, method: string }
Output: { parameters, requestBody, responses, componentRefs: string[] }
```

4. get_components

- Retrieve detailed information of component schemas referenced by `$ref`

```txt
Input: { serviceName: string, refs: string[] }
Output: Record<refPath, SchemaObject>
```

### Data Flow

1. LLM calls list_services → Obtain all service list
2. Select appropriate service based on user request, then call list_apis → Obtain API list
3. Select required API, then call get_api_detail → Obtain detailed spec
4. If $ref references exist, call get_components → Obtain component schemas
5. LLM synthesizes collected information to respond to user or generate code

## Functional Requirements

### Core Features

| ID     | Feature Name          | Description                                             | Priority      |
|--------|----------------------|---------------------------------------------------------|---------------|
| FR-01  | Service List Query    | Return all registered services and API group information | P0 (Required) |
| FR-02  | API List Query        | Return API endpoint list per service in summary format   | P0 (Required) |
| FR-03  | API Detail Query      | Return parameters, request/response schemas for specific API | P0 (Required) |
| FR-04  | Component Schema Query| Return schema definitions referenced by $ref            | P0 (Required) |
| FR-05  | API Group Filtering   | Support tag-based pagination per API group              | P1 (Recommended) |
| FR-06  | OpenAPI Version Support| Parse OpenAPI 3.0.x and 3.1.x specifications           | P0 (Required) |
| FR-07  | Schema Normalization  | Simplify schemas in LLM-friendly format                 | P1 (Recommended) |
| FR-08  | Error Handling        | Graceful handling of parsing failures, network errors, etc. | P0 (Required) |

## Token Optimization Strategy

The following strategies are applied considering LLM context window limitations:
- Step-by-step information provision: Instead of providing the entire spec at once, query only necessary parts through Tools
- Schema normalization: Remove unnecessary metadata from Swagger originals, extract only core information
- `$ref` separation: Provide only reference paths for component schemas, query details through separate Tool
- API group pagination: For services with large numbers of APIs, group by tags and provide in segments
