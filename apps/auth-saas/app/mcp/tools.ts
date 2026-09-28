/**
 * MCP tools generated mechanically from the management API's own OpenAPI operations:
 * one tool per operation, its input schema narrowed from the operation's own params,
 * query and body schemas into `@sdxc/mcp`'s tool-argument subset, and its name the
 * operation's own `operationId` — the mapping the document already publishes, so
 * adding an operation there is the only change a new tool ever needs.
 *
 * Generation is separate from implementation, the same split `apps/blog`'s hand-written
 * tool tree keeps between its own `tools.ts` and `controllers/**` — this file only
 * decides what exists and what it takes; `app/mcp/controller.ts` forwards a call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DescribedSchema, JSONSchema } from "@sdxc/json-schema";
import type { ObjectSchema, Tool, ToolAnnotations, ToolGroup } from "@sdxc/mcp";
import type { Operation } from "@sdxc/openapi";

import { toJSONSchema } from "@sdxc/json-schema";
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

import { narrowObject } from "./schema.js";

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

/** How a generated tool's own `body` argument reaches the forwarded request. */
export type BodyMode = "none" | "object" | "string";

/** One operation, generated into a tool, with what its handler needs to rebuild the real request. */
export interface GeneratedTool {
	readonly tool: Tool<ObjectSchema>;
	readonly operation: AnyOperation;
	/** Argument names that fill the route's own path variables. */
	readonly paramKeys: readonly string[];
	/** Argument names that become query-string parameters. */
	readonly queryKeys: readonly string[];
	/** Whether the tool has no body, an object narrowed to the subset, or a JSON-encoded string fallback. */
	readonly bodyMode: BodyMode;
}

/**
 * Describes a schema as JSON Schema on its output side, the side a coercion (a query
 * parameter accepted as either a number or its string form) resolves to its single
 * clean type rather than the union its input side would otherwise describe.
 */
function describe(schema: AnySchema): JSONSchema {
	let described = toJSONSchema(schema, { refs: "inline", direction: "output" });
	if (isFailure(described)) {
		throw new Error(`Could not describe a schema for a generated tool: ${described.error.message}`);
	}
	return described.data;
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
 * media type such as a merge patch). A body declared only in another media type — the
 * token endpoint's form encoding, a subject import's NDJSON upload — has nothing this
 * generator's JSON-forwarding handler could send correctly, so that operation is left
 * out of the generated set entirely rather than forwarding the wrong media type.
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

/** An operation's summary and, when it adds anything beyond the summary, its description. */
function toolDescription(operation: AnyOperation): string {
	let { summary, description } = operation.spec;
	return description === undefined ? summary : `${summary}\n\n${description}`;
}

/**
 * The hints a client weighs before running a tool without asking: read-only for a
 * `GET`, destructive for a `DELETE` or a same-effect removal reachable another way
 * (blocking, revoking, removing an identifier) — `unblock` is excluded, since restoring
 * access is not itself a destructive act. Nothing generated here reaches outside this
 * platform.
 */
function toolAnnotations(operation: AnyOperation): ToolAnnotations {
	let method = operation.route.method;
	let name = operation.operationId;
	let destructiveHint =
		method === "DELETE" || (/block|revoke|remove/i.test(name) && !/unblock/i.test(name));

	return { readOnlyHint: method === "GET", destructiveHint, openWorldHint: false };
}

/**
 * Narrows an operation's params or query schema, throwing when it does not fit the
 * subset. Both are always flat objects of path or query scalars in this API, so a
 * failure here means the generator, not the operation, needs to change.
 */
function narrowFlatObject(
	operation: AnyOperation,
	schema: AnySchema,
	part: "params" | "query",
): ObjectSchema {
	let narrowed = narrowObject(describe(schema));
	if (narrowed === null) {
		throw new Error(
			`${operation.operationId}: its ${part} schema does not fit the tool argument subset`,
		);
	}
	return narrowed;
}

/**
 * Generates one tool from one operation, or `null` when the operation's own request
 * body cannot be forwarded as JSON at all (see {@link hasJSONCompatibleBody}).
 */
function generateTool(operation: AnyOperation): GeneratedTool | null {
	if (!hasJSONCompatibleBody(operation)) return null;

	let properties: Record<string, ObjectSchema["properties"][string]> = {};
	let required: string[] = [];
	let paramKeys: string[] = [];
	let queryKeys: string[] = [];

	if (operation.spec.params !== undefined) {
		let narrowed = narrowFlatObject(operation, operation.spec.params, "params");
		Object.assign(properties, narrowed.properties);
		if (narrowed.required) required.push(...narrowed.required);
		paramKeys = Object.keys(narrowed.properties);
	}

	if (operation.spec.query !== undefined) {
		let narrowed = narrowFlatObject(operation, operation.spec.query, "query");
		Object.assign(properties, narrowed.properties);
		if (narrowed.required) required.push(...narrowed.required);
		queryKeys = Object.keys(narrowed.properties);
	}

	let bodyMode: BodyMode = "none";
	let bodySchema = representativeBodySchema(operation);
	if (bodySchema !== null) {
		let narrowedBody = narrowObject(describe(bodySchema));
		if (narrowedBody !== null) {
			properties.body = narrowedBody;
			bodyMode = "object";
		} else {
			properties.body = {
				type: "string",
				description:
					"A JSON-encoded object matching this operation's own request body, as its own documentation describes.",
			};
			bodyMode = "string";
		}
	}

	let input: ObjectSchema = { type: "object", properties };
	if (required.length > 0) input = { ...input, required };

	let declared = tool(operation.operationId, {
		description: toolDescription(operation),
		input,
		annotations: toolAnnotations(operation),
	});

	return { tool: declared, operation, paramKeys, queryKeys, bodyMode };
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
 * every tool's own name must be unique. Never mapped itself — {@link GENERATED_TOOLS}
 * is what `bootstrap/mcp-app.ts` maps, one tool at a time.
 */
tools(
	Object.fromEntries(
		GENERATED_TOOLS.map((generated) => [generated.tool.name, generated.tool]),
	) as ToolGroup,
);

export default GENERATED_TOOLS;
