/**
 * Implements every generated management tool with one handler: builds a request
 * matching its operation's own method and path, substituting the call's own
 * validated arguments into the path and query, attaches the caller's own
 * already-verified bearer token read off the request context, and forwards it to the
 * real management route. The route's real response, scope enforcement included,
 * becomes the tool's result unchanged — this handler never re-checks or duplicates
 * that enforcement.
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

/** The path and query arguments a call carries, read off the tool's own recorded argument names. */
function routeArguments(
	generated: GeneratedTool,
	args: Record<string, unknown>,
): { params: Record<string, unknown>; query: Record<string, string | number> } {
	let params: Record<string, unknown> = {};
	for (let key of generated.paramKeys) {
		if (args[key] !== undefined) params[key] = args[key];
	}

	let query: Record<string, string | number> = {};
	for (let key of generated.queryKeys) {
		let value = args[key];
		if (typeof value === "string" || typeof value === "number") query[key] = value;
	}

	return { params, query };
}

/**
 * The forwarded request's own body: `undefined` when the tool declares none, the
 * `body` argument re-serialized when it was narrowed to an object, or the `body`
 * argument's JSON-encoded text re-parsed and re-serialized when the tool fell back to
 * a string argument — re-parsing here is what turns malformed input into a `ToolError`
 * the model can act on, rather than a request the real route would refuse blindly.
 */
function forwardedBody(
	generated: GeneratedTool,
	args: Record<string, unknown>,
): string | undefined {
	if (generated.bodyMode === "object") {
		return args.body === undefined ? undefined : JSON.stringify(args.body);
	}

	if (generated.bodyMode === "string" && typeof args.body === "string") {
		try {
			return JSON.stringify(JSON.parse(args.body));
		} catch {
			throw new ToolError("The body argument must be JSON-encoded text, and it did not parse.");
		}
	}

	return undefined;
}

/**
 * Builds the one handler every generated tool is mapped to, closing over which
 * operation it forwards to.
 *
 * @param generated - The tool, its operation, and how its arguments map onto a request.
 * @returns The handler, for `mcp.tools.map(generated.tool, ...)`.
 * @example
 * for (let generated of GENERATED_TOOLS) mcp.tools.map(generated.tool, managementToolHandler(generated));
 */
export function managementToolHandler(
	generated: GeneratedTool,
): ToolHandler<Record<string, unknown>> {
	return async (ctx) => {
		let args = ctx.input;
		let { params, query } = routeArguments(generated, args);

		let href = generated.operation.route.href(params, { searchParams: query });
		let url = new URL(href, `https://api.${env.PLATFORM_DOMAIN}`);

		let method =
			generated.operation.route.method === "ANY" ? "GET" : generated.operation.route.method;
		let body = forwardedBody(generated, args);

		let headers = new Headers({ Authorization: `Bearer ${ctx.get(McpBearerToken)}` });
		if (body !== undefined) headers.set("Content-Type", "application/json");

		let response = await dispatchManagementRequest(new Request(url, { method, headers, body }));
		let text = await response.text();

		if (response.status >= 400)
			throw new ToolError(text.length > 0 ? text : `HTTP ${response.status}`);
		return text.length > 0 ? text : `HTTP ${response.status}`;
	};
}
