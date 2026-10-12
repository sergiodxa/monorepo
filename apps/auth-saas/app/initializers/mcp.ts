/**
 * The platform's MCP server: the management API exposed as one tool per OpenAPI operation,
 * for an agent holding a bearer token from the platform tenant's own OIDC engine. The tools
 * are generated, so one handler serves them all and each is mapped in a loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler } from "@sdxc/mcp";

import { managementToolHandler } from "~/app/mcp/controller";
import GENERATED_TOOLS from "~/app/mcp/tools";

/**
 * How long a client may cache the tool list. The operation set changes only on
 * deploy, so an hour costs a client one re-listing a session rather than one a turn.
 */
const LIST_TTL_MS = 3_600_000;

/**
 * The platform's MCP server, built once at module scope. Every caller sees the same
 * generated tool list; the management route each call reaches enforces its own scopes.
 */
const mcp = createHandler({
	name: "auth-saas-management",
	title: "Auth SaaS Management API",
	version: "1.0.0",
	instructions:
		"Manage subjects, clients, agent clients, API keys, webhook endpoints, roles, credentials, audit events and tenant settings through the management API. Each tool maps one management API operation: pass its path variables as `params`, its query-string parameters as `query`, and its request body as `body`, each exactly as the operation's own OpenAPI document describes them.",
	listTtlMs: LIST_TTL_MS,
});

for (let generated of GENERATED_TOOLS) {
	mcp.tools.map(generated.tool, managementToolHandler(generated));
}

export default mcp;
