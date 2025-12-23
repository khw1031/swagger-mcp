/**
 * Swagger 문서 fetch 서비스
 */

import { SwaggerConfigSchema, type SwaggerDocConfig } from "../schemas/swagger.schema.js";

/**
 * Swagger document configuration store
 * Load the configuration file path from the SWAGGER_CONFIG_PATH environment variable or use the default value
 */
let swaggerConfigs: SwaggerDocConfig[] = [];

/**
 * Initialize Swagger configurations
 * Read the configuration file path from the parameter or SWAGGER_CONFIG_PATH environment variable
 *
 * @param configPathParam - Optional path to the swagger-config.json file (from Smithery config)
 */
export async function initSwaggerConfigs(configPathParam?: string): Promise<void> {
  const fs = await import("node:fs/promises");

  // Smithery config takes precedence over environment variable
  const configPath = configPathParam || process.env.SWAGGER_CONFIG_PATH;

  if (!configPath) {
    console.error("[swagger-mcp] SWAGGER_CONFIG_PATH is not set. Provide it via Smithery config or environment variable.");
    swaggerConfigs = [];
    return;
  }

  // Load the file and validate it with the Zod schema
  try {
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    const result = SwaggerConfigSchema.safeParse(parsed);

    if (!result.success) {
      console.error(`[swagger-mcp] Invalid config file (${configPath}):`);
      console.error(result.error.message);
      swaggerConfigs = [];
      return;
    }

    swaggerConfigs = result.data.services;
    console.error(
      `[swagger-mcp] Loaded ${swaggerConfigs.length} service config(s) from ${configPath}`
    );
  } catch (error) {
    console.error(`[swagger-mcp] Failed to load config from ${configPath}:`, error);
    swaggerConfigs = [];
  }
}

/**
 * Return the configuration of all registered services
 */
export function getSwaggerConfigs(): SwaggerDocConfig[] {
  return swaggerConfigs;
}

/**
 * Return the list of all registered environments
 */
export function getAvailableEnvironments(): string[] {
  const environments = new Set<string>();
  for (const config of swaggerConfigs) {
    environments.add(config.environment);
  }
  return [...environments];
}

/**
 * Return the list of available environments for a specific service
 */
export function getServiceEnvironments(serviceName: string): string[] {
  return swaggerConfigs
    .filter((config) => config.name === serviceName)
    .map((config) => config.environment);
}

/**
 * Return the configuration of a specific service by name and environment
 */
export function getSwaggerConfigByName(
  serviceName: string,
  environment: string
): SwaggerDocConfig | undefined {
  return swaggerConfigs.find(
    (config) => config.name === serviceName && config.environment === environment
  );
}

/**
 * Fetch the original text of the Swagger document from the URL
 */
export async function fetchSwaggerDocument(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch swagger document: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
