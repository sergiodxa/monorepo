/**
 * Public `@sdxc/mcp/client` entry: sync `connect` and the one-word session API
 * for Streamable HTTP revision `2026-07-28`. Imports no Remix and no server
 * handler modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ConnectOptions } from "./client/types.js";

import { McpClient } from "./client/session.js";

export { McpClientError } from "./client/errors.js";
export { McpClient } from "./client/session.js";
export type {
	CallResult,
	ConnectOptions,
	DiscoverResult,
	ListResult,
	ReadResult,
	ResourceContents,
	ResourceListEntry,
	ResourceTemplateEntry,
	ResourcesResult,
	TemplatesResult,
	TextContent,
	ToolListEntry,
} from "./client/types.js";
export type { Implementation } from "./protocol.js";

/**
 * Binds a client session to a Streamable HTTP MCP endpoint. Sync and cheap: no
 * network until the first RPC. Prefer `using mcp = connect(options)` so the
 * session closes when the scope ends.
 *
 * @param options Endpoint URL, client identity, and optional auth headers.
 * @returns A {@link McpClient} implementing `Disposable`.
 * @example
 * using mcp = connect({ url: "https://example.com/mcp", client: { name: "app", version: "1.0.0" } });
 * await mcp.list();
 */
export function connect(options: ConnectOptions): McpClient {
	return new McpClient(options);
}
