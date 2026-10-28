/**
 * Builds the Bazaar discovery extension for a catalog operation so facilitators
 * that index Bazaar can catalog the resource after a successful settle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BazaarExtension } from "@sdxc/x402";

import { bazaarHttpPost, bazaarMcpTool } from "@sdxc/x402";

import type { Operation } from "~/config/catalog";

/**
 * Bazaar extension for an HTTP `POST /v1/<id>` challenge.
 *
 * @param operation - Catalog row
 */
export function httpBazaar(operation: Operation): BazaarExtension {
	return bazaarHttpPost(operation.exampleInput, {
		type: "json",
		example: operation.exampleOutput,
	});
}

/**
 * Bazaar extension for an MCP `tools/call` challenge.
 *
 * @param operation - Catalog row
 */
export function mcpBazaar(operation: Operation): BazaarExtension {
	return bazaarMcpTool(
		operation.id,
		{ type: "json", example: operation.exampleOutput },
		operation.exampleInput,
	);
}
