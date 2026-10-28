/**
 * The platform's MCP server: the management API exposed as one tool per OpenAPI operation,
 * for an agent holding a bearer token from the platform tenant's own OIDC engine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireToolAbility } from "@sdxc/authz/mcp";
import { createHandler } from "@sdxc/mcp/server";

import { managementToolHandler } from "~/app/mcp/controller";
import GENERATED_TOOLS from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/**
 * How long a client may cache the tool list. The operation set changes only on
 * deploy, so an hour costs a client one re-listing a session rather than one a turn.
 */
const LIST_TTL_MS = 3_600_000;

/**
 * The platform's MCP server, built once at module scope. Every caller sees the same
 * generated tool list; a call outside the token's scopes refuses before it is forwarded,
 * and the management route it reaches applies the caller's membership role.
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
	let [ability] = abilities.filter({ metadata: { operation: generated.operation.operationId } });
	let handler = managementToolHandler(generated);
	mcp.tools.map(
		generated.tool,
		ability === undefined ? handler : { middleware: [requireToolAbility(ability)], handler },
	);
}

export default mcp;
