/**
 * The API route contract: every endpoint a machine client calls, and the OpenAPI operation
 * that types each documented one, so the published document and the handler that parses a
 * request read the same schemas.
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";
import { get, post, route } from "remix/routes";

/** The JSON endpoints under `/api`, and the MCP endpoint an agent connects to. */
const ROUTES = route({
	api: {
		health: get("/api/health"),
		openapi: get("/api/openapi.json"),
		notFound: "/api/*path",
	},
	mcp: post("/mcp"),
});

export default ROUTES;

/** GET /api/health, the check a monitor or load balancer polls. */
export const HEALTH = defineOperation("health", ROUTES.api.health, {
	summary: "Check the service",
	responses: {
		200: { description: "The service is up", body: s.object({ status: s.literal("ok") }) },
	},
});
