/**
 * Swagger/OpenAPI document parsing service
 */

import { dereference, validate } from "@scalar/openapi-parser";
import type { OpenAPI } from "@scalar/openapi-types";
import type {
  ServiceInfo,
  ListServicesResponse,
  ApiListResponse,
  ApiDetail,
  ComponentsResponse,
  HttpMethod,
  CachedDocument,
} from "../types/swagger.types.js";
import {
  getSwaggerConfigs,
  getSwaggerConfigByName,
  getAvailableEnvironments,
  getServiceEnvironments,
  fetchSwaggerDocument,
} from "./swagger-fetcher.service.js";

/**
 * Parsed document cache
 */
const documentCache = new Map<string, CachedDocument>();

/**
 * Parse and validate the Swagger document
 */
export async function parseSwaggerDocument(url: string): Promise<CachedDocument> {
  // Check the cache
  if (documentCache.has(url)) {
    return documentCache.get(url)!;
  }

  const content = await fetchSwaggerDocument(url);

  // Validate the document (only print warnings, skip errors)
  const { valid, errors } = await validate(content);
  if (!valid) {
    console.error(`[swagger-mcp] Warning: OpenAPI validation errors in ${url}:`);
    console.error(`[swagger-mcp] ${JSON.stringify(errors?.slice(0, 3))}...`);
    // Continue parsing even if validation fails (compatibility with Swagger documents)
  }

  // Try to resolve $ref (dereference)
  let schema: OpenAPI.Document | null = null;
  let isDereferenced = true;

  try {
    const result = await dereference(content);
    schema = result.schema as OpenAPI.Document;

    // Check if JSON serialization is possible even if dereference succeeds (circular reference validation)
    try {
      JSON.stringify(schema);
    } catch (stringifyError) {
      // JSON serialization failed = circular reference exists
      console.warn(
        `[swagger-mcp] Dereference succeeded but contains circular references for ${url}. Using raw document.`
      );
      isDereferenced = false;
      schema = JSON.parse(content) as OpenAPI.Document;
    }
  } catch (error) {
    // Dereference failed (circular references, etc.) - use the original document
    console.warn(
      `[swagger-mcp] Dereference failed for ${url}. Using raw document. ` +
        `Reason: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    isDereferenced = false;

    // Parse the original JSON/YAML to OpenAPI.Document
    schema = JSON.parse(content) as OpenAPI.Document;
  }

  if (!schema) {
    throw new Error("Failed to parse OpenAPI document");
  }

  // Save the cache (include dereference status)
  const cachedDoc: CachedDocument = { document: schema, isDereferenced };
  documentCache.set(url, cachedDoc);

  return cachedDoc;
}

/**
 * Expand the schema to 1depth only (prevent circular references)
 */
function expandSchemaOneDepth(
  doc: OpenAPI.Document,
  schemaName: string,
  visitedRefs = new Set<string>()
): OpenAPI.SchemaObject {
  const ref = `#/components/schemas/${schemaName}`;

  // Detect circular references
  if (visitedRefs.has(ref)) {
    return {
      $ref: ref,
      "x-circular-ref": true,
      description: "Circular reference detected",
    } as OpenAPI.SchemaObject;
  }

  const schema = doc.components?.schemas?.[schemaName];
  if (!schema) {
    return { $ref: ref, description: "Schema not found" } as OpenAPI.SchemaObject;
  }

  // Add to visited
  visitedRefs.add(ref);

  // Copy the schema shallowly
  const expandedSchema: OpenAPI.SchemaObject = { ...schema };

  // If properties exist, expand to 1depth
  if (expandedSchema.properties) {
    const expandedProperties: Record<string, OpenAPI.SchemaObject> = {};

    for (const [propName, propSchema] of Object.entries(expandedSchema.properties)) {
      // Try to expand only if $ref exists
      if (propSchema && typeof propSchema === "object" && "$ref" in propSchema) {
        const refPath = propSchema.$ref as string;
        const match = refPath.match(/^#\/components\/schemas\/(.+)$/);

        if (match) {
          const refSchemaName = match[1];
          // Recursive call to expand to 1depth
          expandedProperties[propName] = expandSchemaOneDepth(
            doc,
            refSchemaName,
            new Set(visitedRefs) // Copy to a new Set (each branch is independent)
          );
        } else {
          expandedProperties[propName] = propSchema;
        }
      } else {
        expandedProperties[propName] = propSchema as OpenAPI.SchemaObject;
      }
    }

    expandedSchema.properties = expandedProperties;
  }

  // Handle allOf, anyOf, oneOf (optional)
  if (expandedSchema.allOf) {
    type AllOfElement = NonNullable<typeof expandedSchema.allOf>[number];
    expandedSchema.allOf = expandedSchema.allOf.map((subSchema: AllOfElement) => {
      if (typeof subSchema === "object" && subSchema !== null && "$ref" in subSchema) {
        const refPath = subSchema.$ref as string;
        const match = refPath.match(/^#\/components\/schemas\/(.+)$/);
        if (match) {
          return expandSchemaOneDepth(doc, match[1], new Set(visitedRefs));
        }
      }
      return subSchema;
    }) as typeof expandedSchema.allOf;
  }

  // Remove from visited (backtrack)
  visitedRefs.delete(ref);

  return expandedSchema;
}

/**
 * Retrieve the list of all registered services
 * Return the environment information and the list of available environments for each service
 */
export async function listServices(): Promise<ListServicesResponse> {
  const configs = getSwaggerConfigs();
  const availableEnvironments = getAvailableEnvironments();

  // Group by service (same name services have different environments)
  const serviceMap = new Map<string, ServiceInfo>();

  for (const config of configs) {
    const existingService = serviceMap.get(config.name);

    if (existingService) {
      // 이미 존재하는 서비스면 환경만 추가
      const environments = getServiceEnvironments(config.name);
      existingService.environments = environments;
    } else {
      // 새 서비스 추가
      try {
        const { document: doc } = await parseSwaggerDocument(config.url);
        const tags = doc.tags?.map((t: { name: string }) => t.name) || [];

        serviceMap.set(config.name, {
          serviceName: config.name,
          description: config.description || doc.info?.description,
          environments: getServiceEnvironments(config.name),
          apiGroups: tags,
        });
      } catch {
        // 파싱 실패 시에도 기본 정보는 포함
        serviceMap.set(config.name, {
          serviceName: config.name,
          description: config.description,
          environments: getServiceEnvironments(config.name),
          apiGroups: [],
        });
      }
    }
  }

  return {
    availableEnvironments,
    services: [...serviceMap.values()],
  };
}

/**
 * Retrieve the list of APIs for a specific service
 */
export async function listApis(
  serviceName: string,
  environment: string,
  apiGroup?: string
): Promise<ApiListResponse> {
  const config = getSwaggerConfigByName(serviceName, environment);
  if (!config) {
    const availableEnvs = getServiceEnvironments(serviceName);
    if (availableEnvs.length > 0) {
      throw new Error(
        `Environment '${environment}' not found for service '${serviceName}'. Available environments: ${availableEnvs.join(", ")}`
      );
    }
    throw new Error(`Service not found: ${serviceName}`);
  }

  const { document: doc } = await parseSwaggerDocument(config.url);
  const result: ApiListResponse = {};

  for (const [path, pathItem] of Object.entries(doc.paths || {})) {
    if (!pathItem) continue;

    const methods: Record<string, { operationId?: string; summary?: string; tags: string[] }> = {};

    for (const method of ["get", "post", "put", "delete", "patch"] as const) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Filter by apiGroup
      if (apiGroup && !operation.tags?.includes(apiGroup)) {
        continue;
      }

      methods[method] = {
        operationId: operation.operationId,
        summary: operation.summary,
        tags: operation.tags || [],
      };
    }

    if (Object.keys(methods).length > 0) {
      result[path] = methods;
    }
  }

  return result;
}

/**
 * Retrieve the detailed specification of a specific API
 */
export async function getApiDetail(
  serviceName: string,
  environment: string,
  path: string,
  method: HttpMethod
): Promise<ApiDetail> {
  const config = getSwaggerConfigByName(serviceName, environment);
  if (!config) {
    const availableEnvs = getServiceEnvironments(serviceName);
    if (availableEnvs.length > 0) {
      throw new Error(
        `Environment '${environment}' not found for service '${serviceName}'. Available environments: ${availableEnvs.join(", ")}`
      );
    }
    throw new Error(`Service not found: ${serviceName}`);
  }

  const { document: doc } = await parseSwaggerDocument(config.url);
  const pathItem = doc.paths?.[path];

  if (!pathItem) {
    throw new Error(`Path not found: ${path}`);
  }

  const operation = pathItem[method];
  if (!operation) {
    throw new Error(`Method ${method.toUpperCase()} not found on path: ${path}`);
  }

  // Collect $ref references
  const componentRefs: string[] = [];
  const visitedRefs = new Set<string>();
  let depthLimitReached = false;

  const collectRefs = (obj: unknown, currentDepth: number = 0): void => {
    // Depth limit of 2
    if (currentDepth > 2) {
      depthLimitReached = true;
      return;
    }

    // Type guard
    if (!obj || typeof obj !== "object") return;

    // Collect $ref when found
    if ("$ref" in obj && typeof (obj as Record<string, unknown>).$ref === "string") {
      const ref = (obj as Record<string, unknown>).$ref as string;

      // Prevent duplicates (circular reference handling)
      if (!visitedRefs.has(ref)) {
        visitedRefs.add(ref);
        componentRefs.push(ref);
      }

      // Stop searching the branch when $ref is found
      return;
    }

    // Recursive search (depth increase)
    for (const value of Object.values(obj)) {
      collectRefs(value, currentDepth + 1);
    }
  };

  collectRefs(operation.parameters);
  collectRefs(operation.requestBody);
  collectRefs(operation.responses);

  // Warning log
  if (depthLimitReached) {
    console.warn(
      `[swagger-mcp] Depth limit reached for ${method.toUpperCase()} ${path}. ` +
        `Some deeply nested $refs may not be collected. Use get_components recursively if needed.`
    );
  }

  return {
    parameters: operation.parameters as OpenAPI.Parameter[],
    requestBody: operation.requestBody as Record<string, unknown>,
    responses: operation.responses as Record<string, OpenAPI.ResponseObject>,
    componentRefs: [...new Set(componentRefs)],
    meta: {
      totalRefsFound: componentRefs.length,
      depthLimitReached,
    },
  };
}

/**
 * Retrieve the component schemas
 */
export async function getComponents(
  serviceName: string,
  environment: string,
  refs: string[]
): Promise<ComponentsResponse> {
  const config = getSwaggerConfigByName(serviceName, environment);
  if (!config) {
    const availableEnvs = getServiceEnvironments(serviceName);
    if (availableEnvs.length > 0) {
      throw new Error(
        `Environment '${environment}' not found for service '${serviceName}'. Available environments: ${availableEnvs.join(", ")}`
      );
    }
    throw new Error(`Service not found: ${serviceName}`);
  }

  const { document: doc, isDereferenced } = await parseSwaggerDocument(config.url);
  const result: ComponentsResponse = {};
  const notFound: string[] = [];
  const circularRefs: string[] = [];

  for (const ref of refs) {
    // Parse $ref in the form of #/components/schemas/User
    const match = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (!match) {
      notFound.push(ref);
      continue;
    }

    const schemaName = match[1];

    // If dereference succeeds: use the existing logic
    if (isDereferenced) {
      const schema = doc.components?.schemas?.[schemaName];
      if (schema) {
        result[ref] = schema as OpenAPI.SchemaObject;
      } else {
        notFound.push(ref);
      }
    }
    // If dereference fails: expand to 1depth
    else {
      const schema = doc.components?.schemas?.[schemaName];
      if (schema) {
        const visitedRefs = new Set<string>();
        const expandedSchema = expandSchemaOneDepth(doc, schemaName, visitedRefs);
        result[ref] = expandedSchema;

        // Detect circular references
        if (expandedSchema["x-circular-ref"]) {
          circularRefs.push(ref);
        }
      } else {
        notFound.push(ref);
      }
    }
  }

  // Warning log
  if (notFound.length > 0) {
    console.warn(`[swagger-mcp] Components not found in ${serviceName}: ${notFound.join(", ")}`);
  }
  if (circularRefs.length > 0) {
    console.warn(`[swagger-mcp] Circular references detected in ${serviceName}: ${circularRefs.join(", ")}`);
  }

  return result;
}
