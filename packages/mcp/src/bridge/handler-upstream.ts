/**
 * Adapts an in-process `createHandler` `fetch` into {@link UpstreamClient} so bridge
 * integration tests exercise translation against `@sdxc/mcp/server` without HTTP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import {
	LATEST_PROTOCOL_VERSION,
	METHOD_HEADER,
	MetaKey,
	NAME_HEADER,
	PROTOCOL_VERSION_HEADER,
} from "../protocol.js";

import type {
	CallToolResult,
	DiscoverResult,
	ReadResourceResult,
	ResourcesListResult,
	TemplatesListResult,
	ToolsListResult,
	UpstreamClient,
} from "./upstream.js";

import { UpstreamError } from "./upstream.js";

/** Minimal surface of `createHandler(...).fetch` the adapter needs. */
export interface HandlerFetch {
	(input: Request): Promise<Response>;
}

/** Identity the adapter advertises in every upstream `_meta` / header pair. */
const BRIDGE_CLIENT_INFO = { name: "mcp-bridge-test", version: "0.0.1" } as const;

/**
 * Wraps a server handler's `fetch` as an {@link UpstreamClient}.
 *
 * @param fetchHandler The `mcp.fetch` function from `createHandler`.
 * @param endpoint Absolute URL used only as the Request URL (never fetched on the network).
 */
export function handlerUpstream(
	fetchHandler: HandlerFetch,
	endpoint = "https://example.com/mcp",
): UpstreamClient {
	let closed = false;
	let nextId = 1;

	async function rpc(
		method: string,
		params: Record<string, unknown> = {},
		name?: string,
	): Promise<Result<Record<string, unknown>, UpstreamError>> {
		if (closed) return failure(new UpstreamError("Upstream client is closed"));

		let headers: Record<string, string> = {
			"Content-Type": "application/json",
			[PROTOCOL_VERSION_HEADER]: LATEST_PROTOCOL_VERSION,
			[METHOD_HEADER]: method,
		};
		if (name !== undefined) headers[NAME_HEADER] = name;

		let body = {
			jsonrpc: "2.0",
			id: nextId++,
			method,
			params: {
				...params,
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientInfo]: BRIDGE_CLIENT_INFO,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		};

		let response = await fetchHandler(
			new Request(endpoint, { method: "POST", headers, body: JSON.stringify(body) }),
		);
		let payload = (await response.json()) as {
			result?: Record<string, unknown>;
			error?: { code: number; message: string; data?: unknown };
		};

		if (payload.error) {
			return failure(
				new UpstreamError(payload.error.message, {
					code: payload.error.code,
					data: payload.error.data,
				}),
			);
		}
		if (!payload.result) {
			return failure(new UpstreamError("Upstream response had no result"));
		}
		return success(payload.result);
	}

	return {
		async discover() {
			let outcome = await rpc("server/discover");
			if (outcome.status === "failure") return outcome;
			let meta = outcome.data._meta;
			let serverInfo: DiscoverResult["serverInfo"];
			if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
				let info = (meta as Record<string, unknown>)[MetaKey.ServerInfo];
				if (typeof info === "object" && info !== null && !Array.isArray(info)) {
					serverInfo = info as DiscoverResult["serverInfo"];
				}
			}
			return success({
				capabilities: outcome.data.capabilities as DiscoverResult["capabilities"],
				instructions:
					typeof outcome.data.instructions === "string" ? outcome.data.instructions : undefined,
				supportedVersions: outcome.data.supportedVersions as DiscoverResult["supportedVersions"],
				serverInfo,
			});
		},
		async list() {
			return rpc("tools/list") as Promise<Result<ToolsListResult, UpstreamError>>;
		},
		async call(name, args) {
			return rpc(
				"tools/call",
				{ name, ...(args === undefined ? {} : { arguments: args }) },
				name,
			) as Promise<Result<CallToolResult, UpstreamError>>;
		},
		async resources() {
			return rpc("resources/list") as Promise<Result<ResourcesListResult, UpstreamError>>;
		},
		async templates() {
			return rpc("resources/templates/list") as Promise<Result<TemplatesListResult, UpstreamError>>;
		},
		async read(uri) {
			return rpc("resources/read", { uri }, uri) as Promise<
				Result<ReadResourceResult, UpstreamError>
			>;
		},
		close() {
			closed = true;
		},
	};
}
