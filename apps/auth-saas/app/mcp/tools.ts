/**
 * MCP tools generated mechanically from the management API's own OpenAPI operations:
 * one tool per operation, named by its `operationId`, whose input nests the operation's
 * own params, query and body schemas, so a new operation there is a new tool here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DescribedSchema } from "@sdxc/json-schema";
import type { Tool, ToolAnnotations, ToolGroup } from "@sdxc/mcp";
import type { Operation } from "@sdxc/openapi";

import * as s from "@sdxc/json-schema";
import { tool, tools } from "@sdxc/mcp";
import { isFailure } from "@sdxc/result";

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

/** Any operation this module reads only its declared, schema-carrying parts of. */
// oxlint-disable-next-line typescript/no-explicit-any -- every operation's own params/query/body types differ; only the shared, schema-describing parts are read here
type AnyOperation = Operation<any, any, any, any, any>;

/** Any schema an operation declares: validates through data-schema and describes itself. */
// oxlint-disable-next-line typescript/no-explicit-any -- matches @sdxc/openapi's own `AnySchema` alias
type AnySchema = DescribedSchema<any, any>;

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

/**
 * One operation, generated into a tool. The tool's arguments are `params`, `query` and
 * `body`, each present only when the operation declares that part, and each validated
 * by exactly the schema the operation itself parses that part with.
 */
export interface GeneratedTool {
	readonly tool: Tool;
	readonly operation: AnyOperation;
}

/** Whether a declared body is one schema itself, rather than a record of media types to schemas. */
function isBareSchema(body: AnySchema | Record<string, AnySchema>): body is AnySchema {
	return "~standard" in body;
}

/** Whether a media type carries JSON: `application/json` or any `+json` suffix. */
function isJSONMediaType(mediaType: string): boolean {
	return mediaType === "application/json" || mediaType.endsWith("+json");
}

/**
 * Whether an operation's own declared request body travels as JSON (or a JSON-derived
 * media type such as a merge patch). An operation whose body is declared only in another
 * media type — the token endpoint's form encoding, a subject import's NDJSON upload — is
 * left out of the generated set, since its tool's handler forwards every body as JSON.
 */
function hasJSONCompatibleBody(operation: AnyOperation): boolean {
	let body = operation.spec.body as AnySchema | Record<string, AnySchema> | undefined;
	if (body === undefined || isBareSchema(body)) return true;
	return Object.keys(body).some((mediaType) => isJSONMediaType(mediaType));
}

/**
 * The one schema a declared body is read through: itself when it is a bare schema, or
 * whichever JSON media type it declares, preferring `application/json`, since a tool
 * argument carries one value regardless of which media type the real request sends.
 */
function representativeBodySchema(operation: AnyOperation): AnySchema | null {
	let body = operation.spec.body as AnySchema | Record<string, AnySchema> | undefined;
	if (body === undefined) return null;
	if (isBareSchema(body)) return body;

	return (
		body["application/json"] ??
		body["application/merge-patch+json"] ??
		Object.entries(body).find(([mediaType]) => isJSONMediaType(mediaType))?.[1] ??
		null
	);
}

/**
 * Whether a query schema requires at least one key. The real route parses an absent query
 * string as `{}`, so a query whose every key is optional is itself an optional argument.
 *
 * @throws Error When the schema cannot describe itself, which only a change to the
 * operation, not a call, can fix.
 */
function requiresAnyKey(operation: AnyOperation, schema: AnySchema): boolean {
	let described = s.toJSONSchema(schema, { direction: "input", refs: "inline" });
	if (isFailure(described)) {
		throw new Error(`${operation.operationId}: its query schema cannot describe itself`, {
			cause: described.error,
		});
	}
	return (described.data.required?.length ?? 0) > 0;
}

/**
 * The tool's arguments: each part the operation declares, under the name the handler
 * reads it back by. Params are always required, since every path variable is.
 */
function toolInput(operation: AnyOperation): s.Schema<unknown, Record<string, unknown>> {
	let shape: Record<string, AnySchema> = {};

	let { params, query } = operation.spec;
	if (params !== undefined) shape.params = params;
	if (query !== undefined) {
		shape.query = requiresAnyKey(operation, query) ? query : s.optional(query);
	}

	let body = representativeBodySchema(operation);
	if (body !== null) shape.body = body;

	return s.object(shape);
}

/** An operation's summary and, when it adds anything beyond the summary, its description. */
function toolDescription(operation: AnyOperation): string {
	let { summary, description } = operation.spec;
	return description === undefined ? summary : `${summary}\n\n${description}`;
}

/**
 * The hints a client weighs before running a tool without asking: read-only for a
 * `GET`, destructive for a `DELETE` or a same-effect removal reachable another way
 * (blocking, revoking, removing an identifier) — `unblock` restores access, so it stays
 * non-destructive. Every generated tool acts on this platform alone.
 */
function toolAnnotations(operation: AnyOperation): ToolAnnotations {
	let method = operation.route.method;
	let name = operation.operationId;
	let destructiveHint =
		method === "DELETE" || (/block|revoke|remove/i.test(name) && !/unblock/i.test(name));

	return { readOnlyHint: method === "GET", destructiveHint, openWorldHint: false };
}

/**
 * Generates one tool from one operation, or `null` when the operation's own request
 * body cannot be forwarded as JSON at all (see {@link hasJSONCompatibleBody}).
 */
function generateTool(operation: AnyOperation): GeneratedTool | null {
	if (!hasJSONCompatibleBody(operation)) return null;

	let declared = tool(operation.operationId, {
		description: toolDescription(operation),
		input: toolInput(operation),
		annotations: toolAnnotations(operation),
	});

	return { tool: declared, operation };
}

/**
 * Every management operation this generator can expose as a tool, in the OpenAPI
 * document's own operation order.
 *
 * @example
 * for (let generated of GENERATED_TOOLS) mcp.tools.map(generated.tool, managementToolHandler(generated));
 */
const GENERATED_TOOLS: readonly GeneratedTool[] = MANAGEMENT_OPERATIONS.map(generateTool).filter(
	(generated): generated is GeneratedTool => generated !== null,
);

/**
 * Validates the generated set the same way a hand-written tool tree is validated:
 * every tool's own name must be unique. `bootstrap/mcp-app.ts` maps
 * {@link GENERATED_TOOLS} one tool at a time, so this tree only runs the check.
 */
tools(
	Object.fromEntries(
		GENERATED_TOOLS.map((generated) => [generated.tool.name, generated.tool]),
	) as ToolGroup,
);

export default GENERATED_TOOLS;
