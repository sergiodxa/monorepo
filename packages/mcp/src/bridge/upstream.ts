/**
 * The one-word upstream surface the bridge needs from `@sdxc/mcp/client`, kept as a local
 * contract so the stdio face can be tested with a double instead of HTTP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { McpClientError } from "../client.js";

/**
 * What `server/discover` returns once protocol framing is peeled off. The bridge uses it to
 * fill the agent-facing `initialize` reply without forwarding that handshake upstream.
 */
export interface DiscoverResult {
	capabilities?: Record<string, unknown>;
	instructions?: string;
	serverInfo?: { name: string; version: string; title?: string };
	supportedVersions?: readonly string[];
}

/** A successful `tools/list` payload, before modern-only fields are stripped for the agent. */
export interface ToolsListResult {
	tools: unknown[];
	ttlMs?: number;
	cacheScope?: string;
}

/** A successful `tools/call` payload. */
export interface CallToolResult {
	content?: unknown[];
	structuredContent?: unknown;
	isError?: boolean;
}

/** A successful `resources/list` payload. */
export interface ResourcesListResult {
	resources: unknown[];
	ttlMs?: number;
	cacheScope?: string;
}

/** A successful `resources/templates/list` payload. */
export interface TemplatesListResult {
	resourceTemplates: unknown[];
	ttlMs?: number;
	cacheScope?: string;
}

/** A successful `resources/read` payload. */
export interface ReadResourceResult {
	contents: unknown[];
	ttlMs?: number;
	cacheScope?: string;
}

/**
 * Upstream failures the bridge turns into JSON-RPC errors toward the agent. Same class the
 * `@sdxc/mcp/client` session returns through `@sdxc/result`.
 */
export { McpClientError as UpstreamError };

/**
 * The subset of `McpClient` the bridge calls. Production wires this to `connect()`; tests
 * inject a double so framing and translation stay independent of the HTTP client.
 */
export interface UpstreamClient {
	/** Loads server identity and capabilities for the local `initialize` shim. */
	discover(): Promise<Result<DiscoverResult, McpClientError>>;
	/** Lists tools (`tools/list`). */
	list(): Promise<Result<ToolsListResult, McpClientError>>;
	/**
	 * Invokes one tool (`tools/call`).
	 *
	 * @param name Tool name from the agent request.
	 * @param args Tool arguments; omitted when the agent sent none.
	 */
	call(
		name: string,
		args?: Record<string, unknown>,
	): Promise<Result<CallToolResult, McpClientError>>;
	/** Lists concrete resources (`resources/list`). */
	resources(): Promise<Result<ResourcesListResult, McpClientError>>;
	/** Lists resource templates (`resources/templates/list`). */
	templates(): Promise<Result<TemplatesListResult, McpClientError>>;
	/**
	 * Reads one resource (`resources/read`).
	 *
	 * @param uri Resource URI from the agent request.
	 */
	read(uri: string): Promise<Result<ReadResourceResult, McpClientError>>;
	/** Aborts in-flight work and refuses further RPCs. */
	close(): void;
}
