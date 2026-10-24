/**
 * The API route contract: every endpoint a machine client calls, and the OpenAPI operation
 * that types each documented one, so the published document and the handler that parses a
 * request read the same schemas.
 */

import HEALTH_REPORT from "@sdxc/health/schema";
import { defineOperation } from "@sdxc/openapi";
import { get, post, route } from "remix/routes";

/**
 * The health check at `/health`, the path monitors look for first, the JSON endpoints under
 * `/api`, and the MCP endpoint an agent connects to.
 */
const ROUTES = route({
	health: get("/health"),
	api: {
		openapi: get("/api/openapi.json"),
		notFound: "/api/*path",
	},
	mcp: post("/mcp"),
});

export default ROUTES;

/** GET /health, the check a monitor or load balancer polls, answered as `application/health+json`. */
export const HEALTH = defineOperation("health", ROUTES.health, {
	summary: "Check the service and every dependency it reads",
	responses: {
		200: {
			description: "Every critical dependency answers: the report's status is `pass` or `warn`",
			body: { "application/health+json": HEALTH_REPORT },
		},
		503: {
			description: "A critical dependency fails: the report's status is `fail`",
			body: { "application/health+json": HEALTH_REPORT },
		},
	},
});
