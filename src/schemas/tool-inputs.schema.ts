/**
 * MCP Tool input Zod schema definition
 */

import { z } from "zod/v4";
import { EnvironmentSchema } from "./swagger.schema.js";

/**
 * list_services Tool - no input
 */
export const ListServicesInputSchema = z.object({});

export type ListServicesInput = z.infer<typeof ListServicesInputSchema>;

/**
 * list_apis Tool input schema
 */
export const ListApisInputSchema = z.object({
  serviceName: z.string().describe("Service name to retrieve"),
  environment: EnvironmentSchema,
  apiGroup: z.string().optional().describe("Filter API group (tag) name"),
});

export type ListApisInput = z.infer<typeof ListApisInputSchema>;

/**
 * HTTP method schema
 */
export const HttpMethodSchema = z
  .enum(["get", "post", "put", "delete", "patch"])
  .describe("HTTP method");

/**
 * get_api_detail Tool input schema
 */
export const GetApiDetailInputSchema = z.object({
  serviceName: z.string().describe("Service name"),
  environment: EnvironmentSchema,
  path: z.string().describe("API endpoint path (e.g. /api/users/{id})"),
  method: HttpMethodSchema,
});

export type GetApiDetailInput = z.infer<typeof GetApiDetailInputSchema>;

/**
 * get_components Tool input schema
 */
export const GetComponentsInputSchema = z.object({
  serviceName: z.string().describe("Service name"),
  environment: EnvironmentSchema,
  refs: z.array(z.string()).describe("Array of $ref paths to retrieve (e.g. ['#/components/schemas/User'])"),
});

export type GetComponentsInput = z.infer<typeof GetComponentsInputSchema>;
