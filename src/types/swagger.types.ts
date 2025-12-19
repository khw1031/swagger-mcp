/**
 * TypeScript definitions related to Swagger/OpenAPI
 */

import type { OpenAPI } from "@scalar/openapi-types";

/**
 * Service information
 */
export interface ServiceInfo {
  serviceName: string;
  description?: string;
  environments: string[];
  apiGroups: string[];
}

/**
 * list_services response type
 */
export interface ListServicesResponse {
  availableEnvironments: string[];
  services: ServiceInfo[];
}

/**
 * API summary information
 */
export interface ApiSummary {
  operationId?: string;
  summary?: string;
  tags: string[];
}

/**
 * API list response type
 * Record<path, Record<method, ApiSummary>>
 */
export type ApiListResponse = Record<string, Record<string, ApiSummary>>;

/**
 * API detailed information
 */
export interface ApiDetail {
  parameters?: OpenAPI.Parameter[];
  requestBody?: Record<string, unknown>;
  responses?: Record<string, OpenAPI.ResponseObject>;
  componentRefs: string[];
  meta?: {
    totalRefsFound: number;
    depthLimitReached: boolean;
  };
}

/**
 * Component schema response type
 */
export type ComponentsResponse = Record<string, OpenAPI.SchemaObject>;

/**
 * Swagger document configuration
 */
export interface SwaggerDocConfig {
  name: string;
  environment: string;
  description?: string;
  url: string;
}

/**
 * HTTP method type
 */
export type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

/**
 * Cached Swagger document
 */
export interface CachedDocument {
  document: OpenAPI.Document;
  isDereferenced: boolean;
}
