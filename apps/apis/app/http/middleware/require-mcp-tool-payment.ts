/**
 * Collects x402 payment for priced MCP `tools/call` requests, keyed off the
 * `Mcp-Name` header so the body stays unread for the MCP handler. Discovery
 * methods and unknown tools pass through unpaid; the operator Bearer token
 * skips payment on priced calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { requirePayment } from "@sdxc/x402/middleware";

import { isOwnerRequest } from "~/app/services/owner-access";
import { findOperation } from "~/config/catalog";

/** Header the MCP Streamable HTTP transport uses to name the tool without reading the body. */
const MCP_METHOD = "mcp-method";

/** Header naming the tool on `tools/call`. */
const MCP_NAME = "mcp-name";

/**
 * Free MCP methods keep flowing; a priced `tools/call` answers 402 until settled,
 * unless the operator presents `OWNER_ACCESS_TOKEN`.
 */
export const requireMcpToolPayment: Middleware = async (ctx, next) => {
	let method = ctx.request.headers.get(MCP_METHOD)?.toLowerCase();
	if (method !== "tools/call") return next();

	let name = ctx.request.headers.get(MCP_NAME);
	if (name === null || name === "") return next();

	let operation = findOperation(name);
	if (operation === undefined) return next();

	if (isOwnerRequest(ctx.request)) {
		ctx.log.set({ owner: { bypass: true, operation: operation.id, surface: "mcp" } });
		return next();
	}

	return requirePayment({
		amount: operation.amount,
		description: operation.description,
		resourceUrl: () => `mcp://tool/${operation.id}`,
		mimeType: "application/json",
	})(ctx, next);
};
