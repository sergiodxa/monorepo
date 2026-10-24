/**
 * Dependency health checks in the Health Check Response Format for HTTP APIs: the runner a
 * service answers its health route with, and the reader for a report another service sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Health } from "./types.js";

export { HealthCheck } from "./health-check.js";
export { HEALTH_MEDIA_TYPE, isHealthResponse, parseHealth } from "./parse.js";
