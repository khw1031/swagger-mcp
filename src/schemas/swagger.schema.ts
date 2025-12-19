/**
 * Zod schema related to Swagger document configuration
 */

import { z } from "zod/v4";

/**
 * Environment type schema
 */
export const EnvironmentSchema = z.string().describe("Environment (e.g. dev, stg, prod)");

export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Swagger document configuration schema
 */
export const SwaggerDocConfigSchema = z.object({
  name: z.string().describe("Service name"),
  environment: EnvironmentSchema,
  description: z.string().optional().describe("Service description"),
  url: z.url().describe("Swagger/OpenAPI document URL"),
});

export type SwaggerDocConfig = z.infer<typeof SwaggerDocConfigSchema>;

/**
 * Swagger configuration file schema
 */
export const SwaggerConfigSchema = z.object({
  services: z.array(SwaggerDocConfigSchema).describe("Registered service list"),
});

export type SwaggerConfig = z.infer<typeof SwaggerConfigSchema>;
