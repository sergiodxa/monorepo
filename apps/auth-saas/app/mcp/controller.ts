/**
 * Implements every generated management tool with one handler: rebuilds the request its
 * operation describes from the call's parsed `params`, `query` and `body`, attaches the
 * caller's already-verified bearer token, and forwards it to the real management route,
 * whose response, scope enforcement included, becomes the tool's result unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ToolHandler } from "@sdxc/mcp";

import { ToolError } from "@sdxc/mcp";
import { env } from "cloudflare:workers";

import type { GeneratedTool } from "~/app/mcp/tools";

import { McpBearerToken } from "~/app/http/middleware/mcp-auth";
import { dispatchManagementRequest } from "~/app/mcp/dispatch";

/**
 * One parsed query value as the text the route's own query schema reads back to the same
 * value: a coerced number or boolean becomes its string form, a coerced date its ISO 8601
 * timestamp, and a structured value its JSON.
 */
function queryText(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}
	return JSON.stringify(value);
}

/**
 * The query string for a call's parsed `query` argument. An array repeats its key once per
 * item, the form the route reads back as an array, and an absent or `undefined` value
 * leaves its key out, so the route applies its own default for it.
 */
function searchParams(query: unknown): URLSearchParams {
	let search = new URLSearchParams();
	if (typeof query !== "object" || query === null) return search;

	for (let [key, value] of Object.entries(query)) {
		for (let item of Array.isArray(value) ? value : [value]) {
			if (item !== undefined && item !== null) search.append(key, queryText(item));
		}
	}
	return search;
}

/**
 * Builds the one handler every generated tool is mapped to, closing over which
 * operation it forwards to. The call's `body` is the operation's body schema's parse, so
 * it arrives with unknown keys stripped and defaults applied, and travels as JSON.
 *
 * @param generated - The tool and the operation it forwards to.
 * @returns The handler, for `mcp.tools.map(generated.tool, ...)`.
 * @throws ToolError When the route answers with an error status, carrying its body.
 * @example
 * for (let generated of GENERATED_TOOLS) mcp.tools.map(generated.tool, managementToolHandler(generated));
 */
export function managementToolHandler(
	generated: GeneratedTool,
): ToolHandler<Record<string, unknown>> {
	return async (ctx) => {
		let { params, query, body } = ctx.input;

		let href = generated.operation.route.href(params ?? {}, {
			searchParams: searchParams(query),
		});
		let url = new URL(href, `https://api.${env.PLATFORM_DOMAIN}`);

		let method =
			generated.operation.route.method === "ANY" ? "GET" : generated.operation.route.method;

		let headers = new Headers({ Authorization: `Bearer ${ctx.get(McpBearerToken)}` });
		let payload = body === undefined ? undefined : JSON.stringify(body);
		if (payload !== undefined) headers.set("Content-Type", "application/json");

		let response = await dispatchManagementRequest(
			new Request(url, { method, headers, body: payload }),
		);
		let text = await response.text();

		if (response.status >= 400)
			throw new ToolError(text.length > 0 ? text : `HTTP ${response.status}`);
		return text.length > 0 ? text : `HTTP ${response.status}`;
	};
}
