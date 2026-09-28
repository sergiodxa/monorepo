/**
 * MCP tools generated mechanically from the management API's own OpenAPI operations:
 * one tool per operation, its input schema derived from the operation's own params,
 * query and body schemas, and its handler a forwarded HTTP request carrying the
 * caller's own bearer token — so a tool never re-implements what its operation's own
 * route already does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { JSONSchema } from "@sdxc/json-schema";
import type { Operation } from "@sdxc/openapi";

import { toJSONSchema } from "@sdxc/json-schema";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { AGENT_CLIENTS_OPERATIONS } from "~/app/http/openapi/agent-clients";
import { API_KEYS_OPERATIONS } from "~/app/http/openapi/api-keys";
import { AUDIT_OPERATIONS } from "~/app/http/openapi/audit";
import { CLIENTS_OPERATIONS } from "~/app/http/openapi/clients";
import { CREDENTIALS_OPERATIONS } from "~/app/http/openapi/credentials";
import { PUBLIC_OPERATIONS } from "~/app/http/openapi/public";
import { ROLES_OPERATIONS } from "~/app/http/openapi/roles";
import { SUBJECTS_OPERATIONS } from "~/app/http/openapi/subjects";
import { TENANTS_OPERATIONS } from "~/app/http/openapi/tenants";
import { WEBHOOK_ENDPOINTS_OPERATIONS } from "~/app/http/openapi/webhook-endpoints";
import { dispatchManagementRequest } from "~/app/mcp/dispatch";

/** Any operation this module reads only its declared, schema-carrying parts of. */
type AnyOperation = Operation<any, any, any, any, any>;

/** An object schema's own JSON Schema, the shape every params and query schema takes. */
interface ObjectJSONSchema {
	type?: string;
	properties?: Record<string, JSONSchema>;
	required?: string[];
}

/** Every management operation, in the same order the OpenAPI document lists them. */
const MANAGEMENT_OPERATIONS: readonly AnyOperation[] = [
	...PUBLIC_OPERATIONS,
	...SUBJECTS_OPERATIONS,
	...AGENT_CLIENTS_OPERATIONS,
	...CLIENTS_OPERATIONS,
	...API_KEYS_OPERATIONS,
	...WEBHOOK_ENDPOINTS_OPERATIONS,
	...ROLES_OPERATIONS,
	...CREDENTIALS_OPERATIONS,
	...AUDIT_OPERATIONS,
	...TENANTS_OPERATIONS,
] as unknown as readonly AnyOperation[];

/** Every operation, by the tool name it is exposed under. */
const OPERATIONS_BY_NAME: ReadonlyMap<string, AnyOperation> = new Map(
	MANAGEMENT_OPERATIONS.map((operation) => [operation.operationId, operation]),
);

/** Whether a value is a schema itself, rather than a record of media types to schemas. */
function isStandardSchema(value: unknown): value is object {
	return typeof value === "object" && value !== null && "~standard" in value;
}

/**
 * The one schema a declared body is read through: itself when it is a bare schema, or
 * whichever JSON media type it declares, preferring `application/json`, since a tool
 * argument carries one value regardless of which media type the real request sends.
 */
function representativeBodySchema(body: unknown): unknown {
	if (body === undefined) return null;
	if (isStandardSchema(body)) return body;

	let record = body as Record<string, unknown>;
	return (
		record["application/json"] ??
		record["application/merge-patch+json"] ??
		Object.values(record)[0] ??
		null
	);
}

/** An object schema's own properties and required members, inlining nested definitions. */
function objectProperties(schema: unknown): {
	properties: Record<string, JSONSchema>;
	required: string[];
} {
	let converted = toJSONSchema(schema as Parameters<typeof toJSONSchema>[0], { refs: "inline" });
	if (isFailure(converted)) return { properties: {}, required: [] };

	let json = converted.data as ObjectJSONSchema;
	return { properties: json.properties ?? {}, required: json.required ?? [] };
}

/**
 * The tool input schema an operation's params, query and body declare: path and query
 * fields flattened at the top level, and a declared body nested under its own `body`
 * property, since a body may be a whole document rather than a set of named fields.
 */
function buildInputSchema(operation: AnyOperation): Tool["inputSchema"] {
	let properties: Record<string, JSONSchema> = {};
	let required: string[] = [];

	if (operation.spec.params !== undefined) {
		let params = objectProperties(operation.spec.params);
		Object.assign(properties, params.properties);
		required.push(...params.required);
	}

	if (operation.spec.query !== undefined) {
		let query = objectProperties(operation.spec.query);
		Object.assign(properties, query.properties);
		required.push(...query.required);
	}

	let representative = representativeBodySchema(operation.spec.body);
	if (representative !== null) {
		let converted = toJSONSchema(representative as Parameters<typeof toJSONSchema>[0], {
			refs: "inline",
		});
		if (!isFailure(converted)) {
			let { $schema: _dialect, ...body } = converted.data;
			properties.body = body as JSONSchema;
		}
	}

	let schema: Tool["inputSchema"] = { type: "object", properties };
	if (required.length > 0) schema.required = required;
	return schema;
}

/** An operation's summary and, when it adds anything beyond the summary, its description. */
function toolDescription(operation: AnyOperation): string {
	let { summary, description } = operation.spec;
	return description === undefined ? summary : `${summary}\n\n${description}`;
}

/**
 * Every management operation as an MCP tool, generated from the same OpenAPI operations
 * the management API's own document publishes — adding an operation there is the only
 * change a new tool ever needs.
 *
 * @returns The tools, in the document's own operation order.
 * @example
 * server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listManagementTools() }));
 */
export function listManagementTools(): Tool[] {
	return MANAGEMENT_OPERATIONS.map((operation) => ({
		name: operation.operationId,
		description: toolDescription(operation),
		inputSchema: buildInputSchema(operation),
	}));
}

/** The path and query arguments a tool call carries, read off its own declared params and query schemas. */
function routeArguments(
	operation: AnyOperation,
	args: Record<string, unknown>,
): { params: Record<string, unknown>; query: Record<string, string | number> } {
	let params: Record<string, unknown> = {};
	if (operation.spec.params !== undefined) {
		for (let key of Object.keys(objectProperties(operation.spec.params).properties)) {
			if (args[key] !== undefined) params[key] = args[key];
		}
	}

	let query: Record<string, string | number> = {};
	if (operation.spec.query !== undefined) {
		for (let key of Object.keys(objectProperties(operation.spec.query).properties)) {
			let value = args[key];
			if (typeof value === "string" || typeof value === "number") query[key] = value;
		}
	}

	return { params, query };
}

/**
 * Runs a tool call: builds a request matching its operation's own method and path,
 * substituting the call's own arguments into the path and query, attaches the
 * caller's own already-verified bearer token, and forwards it to the real management
 * route. The route's real response, scope enforcement included, becomes the tool's
 * result unchanged — this handler never re-checks or duplicates that enforcement.
 *
 * @param name - The tool name, an operation's own `operationId`.
 * @param args - The tool call's arguments, matching that tool's input schema.
 * @param token - The caller's bearer token, forwarded as the outbound request's own.
 * @returns The real management route's response, as the tool's result.
 * @example
 * await callManagementTool("subjectsList", { tenantId }, token);
 */
export async function callManagementTool(
	name: string,
	args: Record<string, unknown>,
	token: string,
): Promise<CallToolResult> {
	let operation = OPERATIONS_BY_NAME.get(name);
	if (operation === undefined) {
		return { isError: true, content: [{ type: "text", text: `Unknown tool "${name}"` }] };
	}

	let { params, query } = routeArguments(operation, args);
	let href = operation.route.href(params, { searchParams: query });
	let url = new URL(href, `https://api.${env.PLATFORM_DOMAIN}`);

	let method = operation.route.method === "ANY" ? "GET" : operation.route.method;
	let headers = new Headers({ Authorization: `Bearer ${token}` });
	let body: string | undefined;
	if (args.body !== undefined) {
		headers.set("Content-Type", "application/json");
		body = JSON.stringify(args.body);
	}

	let response = await dispatchManagementRequest(new Request(url, { method, headers, body }));
	let text = await response.text();

	return {
		isError: response.status >= 400,
		content: [{ type: "text", text: text.length > 0 ? text : `HTTP ${response.status}` }],
	};
}
