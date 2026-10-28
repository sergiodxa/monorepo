/**
 * Builds the x402 `bazaar` discovery extension for a 402 challenge so facilitators
 * that index Bazaar can catalog the resource after a successful settle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** HTTP input advertised to Bazaar for a JSON POST body. */
export interface BazaarHttpPostInput {
	/** Discriminator for HTTP resources. */
	type: "http";
	/** HTTP method; POST for this package's JSON APIs. */
	method: "POST" | "PUT" | "PATCH";
	/** How the body is encoded. */
	bodyType: "json" | "form-data" | "text";
	/** Example body an agent can copy. */
	body: Record<string, unknown>;
}

/** MCP tool input advertised to Bazaar. */
export interface BazaarMcpInput {
	/** Discriminator for MCP tools. */
	type: "mcp";
	/** Tool name as declared to clients. */
	toolName: string;
	/** Example arguments object. */
	arguments?: Record<string, unknown>;
}

/** Output shape Bazaar catalogs alongside the input. */
export interface BazaarOutput {
	/** Media kind of the successful response. */
	type: string;
	/** Example success body. */
	example?: unknown;
}

/** Discovery `info` object under `extensions.bazaar`. */
export interface BazaarInfo {
	/** How a client calls the resource. */
	input: BazaarHttpPostInput | BazaarMcpInput;
	/** What a successful paid call returns. */
	output: BazaarOutput;
}

/** Full `extensions.bazaar` value: info plus the schema that validates it. */
export interface BazaarExtension {
	/** Discovery payload. */
	info: BazaarInfo;
	/** JSON Schema for `info` (draft 2020-12). */
	schema: Record<string, unknown>;
}

/** JSON Schema facilitators validate `info` against for HTTP POST bodies. */
const HTTP_POST_SCHEMA: Record<string, unknown> = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	type: "object",
	properties: {
		input: {
			type: "object",
			properties: {
				type: { type: "string", const: "http" },
				method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
				bodyType: { type: "string", enum: ["json", "form-data", "text"] },
				body: { type: "object" },
				queryParams: {
					type: "object",
					additionalProperties: { type: "string" },
				},
			},
			required: ["type", "method", "bodyType"],
			additionalProperties: false,
		},
		output: {
			type: "object",
			properties: {
				type: { type: "string" },
				example: {},
			},
			required: ["type"],
		},
	},
	required: ["input"],
};

/** JSON Schema facilitators validate `info` against for MCP tools. */
const MCP_SCHEMA: Record<string, unknown> = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	type: "object",
	properties: {
		input: {
			type: "object",
			properties: {
				type: { type: "string", const: "mcp" },
				toolName: { type: "string" },
				arguments: { type: "object" },
			},
			required: ["type", "toolName"],
			additionalProperties: false,
		},
		output: {
			type: "object",
			properties: {
				type: { type: "string" },
				example: {},
			},
			required: ["type"],
		},
	},
	required: ["input"],
};

/**
 * Builds a Bazaar extension for a JSON `POST` resource.
 *
 * @param body - Example JSON body
 * @param output - Example successful response
 */
export function bazaarHttpPost(
	body: Record<string, unknown>,
	output: BazaarOutput,
): BazaarExtension {
	return {
		info: {
			input: { type: "http", method: "POST", bodyType: "json", body },
			output,
		},
		schema: HTTP_POST_SCHEMA,
	};
}

/**
 * Builds a Bazaar extension for an MCP tool.
 *
 * @param toolName - Tool name clients call
 * @param output - Example successful tool result
 * @param args - Example arguments
 */
export function bazaarMcpTool(
	toolName: string,
	output: BazaarOutput,
	args?: Record<string, unknown>,
): BazaarExtension {
	return {
		info: {
			input: {
				type: "mcp",
				toolName,
				...(args === undefined ? {} : { arguments: args }),
			},
			output,
		},
		schema: MCP_SCHEMA,
	};
}
