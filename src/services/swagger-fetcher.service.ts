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
 * Set Swagger configurations directly (for Smithery deployment)
 */
export function setSwaggerConfigs(configs: SwaggerDocConfig[]): void {
  swaggerConfigs = configs;
}

/**
 * Initialize Swagger configurations
 * Read the configuration file path from the SWAGGER_CONFIG_PATH environment variable and validate it with the Zod schema
 */
export async function initSwaggerConfigs(): Promise<void> {
  const fs = await import("node:fs/promises");

  const configPath = process.env.SWAGGER_CONFIG_PATH;

  if (!configPath) {
    console.error("[swagger-mcp] SWAGGER_CONFIG_PATH environment variable is not set.");
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
