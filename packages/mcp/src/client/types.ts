/**
 * Result shapes the client returns from one-word RPC methods, mirroring the
 * `2026-07-28` Streamable HTTP payloads without exposing headers or `_meta`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Implementation } from "../protocol.js";

/** What `connect` stores until the first RPC opens the wire. */
export interface ConnectOptions {
	/** The Streamable HTTP MCP endpoint URL. */
	url: string | URL;
	/** This client's self-reported name and version, sent on every request. */
	client: Implementation;
	/** Extra headers on every POST (for example `Authorization`). */
	headers?: HeadersInit;
	/** Fetch credentials mode when the runtime supports it (browser). */
	credentials?: RequestCredentials;
}

/** What `server/discover` returns after protocol fields are stripped. */
export interface DiscoverResult {
	supportedVersions: string[];
	capabilities: Record<string, unknown>;
	instructions?: string;
	ttlMs?: number;
	cacheScope?: string;
	serverInfo?: Implementation;
}

/** One tool entry from `tools/list`. */
export interface ToolListEntry {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: unknown;
	outputSchema?: unknown;
	annotations?: Record<string, unknown>;
}

/** What `list` returns. */
export interface ListResult {
	tools: ToolListEntry[];
	ttlMs?: number;
	cacheScope?: string;
}

/** Text content block inside a tool call result. */
export interface TextContent {
	type: "text";
	text: string;
}

/**
 * What `call` returns. `isError` is model-facing guidance from the tool, not a
 * transport failure — those come as `Result` failures instead.
 */
export interface CallResult {
	content: TextContent[];
	structuredContent?: unknown;
	isError?: boolean;
}

/** One resource listing entry. */
export interface ResourceListEntry {
	uri: string;
	name: string;
	title?: string;
	description?: string;
	mimeType?: string;
}

/** What `resources` returns. */
export interface ResourcesResult {
	resources: ResourceListEntry[];
	ttlMs?: number;
	cacheScope?: string;
}

/** One resource template from `resources/templates/list`. */
export interface ResourceTemplateEntry {
	uriTemplate: string;
	name: string;
	title?: string;
	description?: string;
	mimeType?: string;
}

/** What `templates` returns. */
export interface TemplatesResult {
	resourceTemplates: ResourceTemplateEntry[];
	ttlMs?: number;
	cacheScope?: string;
}

/** One content item from `resources/read`. */
export interface ResourceContents {
	uri: string;
	mimeType?: string;
	text?: string;
	blob?: string;
}

/** What `read` returns. */
export interface ReadResult {
	contents: ResourceContents[];
	ttlMs?: number;
	cacheScope?: string;
}
