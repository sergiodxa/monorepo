/**
 * Public `@sdxc/mcp/client` entry: sync `connect` and the one-word session API
 * for Streamable HTTP revision `2026-07-28`. Imports no Remix router/handler
 * modules; optional result schemas use `@sdxc/json-schema`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ToolContract, UntypedTools } from "./client/catalog.js";
import type { ConnectOptions } from "./client/types.js";

import { McpClient } from "./client/session.js";

export { InvalidToolResultError, McpClientError } from "./client/errors.js";
export { McpClient } from "./client/session.js";
export type { OutputOf, ToolCatalog, ToolContract, UntypedTools } from "./client/catalog.js";
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
 * session closes when the scope ends. Pass `connect<Tools>(…)` to type tool
 * names and arguments from a first-party catalog; omit the generic for today's
 * loose string/`Record` surface.
 *
 * @template Tools First-party tool catalog; defaults to {@link UntypedTools}.
 * @param options Endpoint URL, client identity, and optional auth headers.
 * @returns A {@link McpClient} implementing `Disposable`.
 * @example
 * using mcp = connect({ url: "https://example.com/mcp", client: { name: "app", version: "1.0.0" } });
 * await mcp.list();
 * @example
 * using mcp = connect<UptimeTools>({ url, client: { name: "bridge", version: "1.0.0" } });
 * await mcp.call("list_monitors", { limit: 20 });
 */
export function connect<Tools extends Record<keyof Tools, ToolContract> = UntypedTools>(
	options: ConnectOptions,
): McpClient<Tools> {
	return new McpClient<Tools>(options);
}
