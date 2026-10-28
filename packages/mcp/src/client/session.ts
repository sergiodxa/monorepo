/**
 * Bound MCP client session: one-word methods over Streamable HTTP, with sync
 * `Disposable` teardown that aborts in-flight work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Implementation } from "../protocol.js";

import { MetaKey } from "../protocol.js";

import type {
	CallResult,
	ConnectOptions,
	DiscoverResult,
	ListResult,
	ReadResult,
	ResourcesResult,
	TemplatesResult,
} from "./types.js";

import { McpClientError } from "./errors.js";
import { rpc } from "./rpc.js";

/**
 * A session against one MCP endpoint. Prefer `using mcp = connect(options)` so
 * `[Symbol.dispose]` closes the session when the scope ends; call `close()` when
 * `using` is unavailable.
 */
export class McpClient implements Disposable {
	/** Endpoint URL this session posts to. */
	readonly url: URL;

	/** Client identity sent on every request. */
	readonly client: Implementation;

	/** Extra headers from {@link ConnectOptions}. */
	#headers: HeadersInit | undefined;

	/** Fetch credentials mode from {@link ConnectOptions}. */
	#credentials: RequestCredentials | undefined;

	/** Aborts in-flight requests when the session closes. */
	#controller: AbortController = new AbortController();

	/** Whether {@link close} or dispose has already run. */
	#closed = false;

	/** @param options Bound URL, identity, and auth from {@link connect}. */
	constructor(options: ConnectOptions) {
		this.url = new URL(options.url);
		this.client = options.client;
		this.#headers = options.headers;
		this.#credentials = options.credentials;
	}

	/**
	 * Asks the server what it supports (`server/discover`).
	 *
	 * @returns Discover payload, or a transport/protocol failure.
	 */
	async discover(): Promise<Result<DiscoverResult, McpClientError>> {
		let result = await this.#request("server/discover", {});
		if (isFailure(result)) return result;
		return success(asDiscover(result.data));
	}

	/**
	 * Lists tools (`tools/list`).
	 *
	 * @returns Tool descriptors, or a transport/protocol failure.
	 */
	async list(): Promise<Result<ListResult, McpClientError>> {
		let result = await this.#request("tools/list", {});
		if (isFailure(result)) return result;
		return success(asList(result.data));
	}

	/**
	 * Calls one tool by name (`tools/call`). A result with `isError` is still a
	 * successful RPC — only wire failures are `Result` failures.
	 *
	 * @param name Tool name from `list`.
	 * @param args Arguments object; defaults to `{}`.
	 */
	async call(
		name: string,
		args: Record<string, unknown> = {},
	): Promise<Result<CallResult, McpClientError>> {
		let result = await this.#request("tools/call", { name, arguments: args });
		if (isFailure(result)) return result;
		return success(asCall(result.data));
	}

	/**
	 * Lists resources (`resources/list`).
	 *
	 * @returns Resource entries, or a transport/protocol failure.
	 */
	async resources(): Promise<Result<ResourcesResult, McpClientError>> {
		let result = await this.#request("resources/list", {});
		if (isFailure(result)) return result;
		return success(asResources(result.data));
	}

	/**
	 * Lists resource templates (`resources/templates/list`).
	 *
	 * @returns Templates, or a transport/protocol failure.
	 */
	async templates(): Promise<Result<TemplatesResult, McpClientError>> {
		let result = await this.#request("resources/templates/list", {});
		if (isFailure(result)) return result;
		return success(asTemplates(result.data));
	}

	/**
	 * Reads one resource by URI (`resources/read`).
	 *
	 * @param uri Absolute resource URI.
	 */
	async read(uri: string): Promise<Result<ReadResult, McpClientError>> {
		let result = await this.#request("resources/read", { uri });
		if (isFailure(result)) return result;
		return success(asRead(result.data));
	}

	/**
	 * Aborts in-flight requests and refuses further RPCs. Same path as
	 * `[Symbol.dispose]`.
	 */
	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.#controller.abort();
	}

	/** Runtime hook for `using`; identical to {@link close}. */
	[Symbol.dispose](): void {
		this.close();
	}

	/** Shared RPC path with closed-session guard. */
	async #request(
		method: string,
		params: Record<string, unknown>,
	): Promise<Result<Record<string, unknown>, McpClientError>> {
		if (this.#closed) {
			return failure(new McpClientError("MCP client session is closed"));
		}
		return rpc(method, params, {
			url: this.url,
			client: this.client,
			headers: this.#headers,
			credentials: this.#credentials,
			signal: this.#controller.signal,
		});
	}
}

/** Maps a raw discover result onto {@link DiscoverResult}. */
function asDiscover(data: Record<string, unknown>): DiscoverResult {
	let meta = isRecord(data._meta) ? data._meta : undefined;
	let serverInfo = meta?.[MetaKey.ServerInfo];
	return {
		supportedVersions: stringArray(data.supportedVersions),
		capabilities: isRecord(data.capabilities) ? data.capabilities : {},
		...(typeof data.instructions === "string" ? { instructions: data.instructions } : {}),
		...(typeof data.ttlMs === "number" ? { ttlMs: data.ttlMs } : {}),
		...(typeof data.cacheScope === "string" ? { cacheScope: data.cacheScope } : {}),
		...(isImplementation(serverInfo) ? { serverInfo } : {}),
	};
}

/** Maps a raw tools/list result onto {@link ListResult}. */
function asList(data: Record<string, unknown>): ListResult {
	return {
		tools: Array.isArray(data.tools) ? (data.tools as ListResult["tools"]) : [],
		...(typeof data.ttlMs === "number" ? { ttlMs: data.ttlMs } : {}),
		...(typeof data.cacheScope === "string" ? { cacheScope: data.cacheScope } : {}),
	};
}

/** Maps a raw tools/call result onto {@link CallResult}. */
function asCall(data: Record<string, unknown>): CallResult {
	return {
		content: Array.isArray(data.content) ? (data.content as CallResult["content"]) : [],
		...(Object.hasOwn(data, "structuredContent")
			? { structuredContent: data.structuredContent }
			: {}),
		...(typeof data.isError === "boolean" ? { isError: data.isError } : {}),
	};
}

/** Maps a raw resources/list result onto {@link ResourcesResult}. */
function asResources(data: Record<string, unknown>): ResourcesResult {
	return {
		resources: Array.isArray(data.resources)
			? (data.resources as ResourcesResult["resources"])
			: [],
		...(typeof data.ttlMs === "number" ? { ttlMs: data.ttlMs } : {}),
		...(typeof data.cacheScope === "string" ? { cacheScope: data.cacheScope } : {}),
	};
}

/** Maps a raw templates list result onto {@link TemplatesResult}. */
function asTemplates(data: Record<string, unknown>): TemplatesResult {
	return {
		resourceTemplates: Array.isArray(data.resourceTemplates)
			? (data.resourceTemplates as TemplatesResult["resourceTemplates"])
			: [],
		...(typeof data.ttlMs === "number" ? { ttlMs: data.ttlMs } : {}),
		...(typeof data.cacheScope === "string" ? { cacheScope: data.cacheScope } : {}),
	};
}

/** Maps a raw resources/read result onto {@link ReadResult}. */
function asRead(data: Record<string, unknown>): ReadResult {
	return {
		contents: Array.isArray(data.contents) ? (data.contents as ReadResult["contents"]) : [],
		...(typeof data.ttlMs === "number" ? { ttlMs: data.ttlMs } : {}),
		...(typeof data.cacheScope === "string" ? { cacheScope: data.cacheScope } : {}),
	};
}

/** Narrows to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrows a value to {@link Implementation}. */
function isImplementation(value: unknown): value is Implementation {
	if (!isRecord(value)) return false;
	return typeof value.name === "string" && typeof value.version === "string";
}

/** Coerces an unknown value to a string array. */
function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === "string");
}
