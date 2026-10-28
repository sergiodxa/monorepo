/**
 * Internal Streamable HTTP transport for the MCP client: one JSON-RPC POST per
 * call, with protocol headers/`_meta` and a single `-32022` retry kept off the
 * public API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import type { JsonRpcFailure, JsonRpcSuccess, RequestId } from "../jsonrpc.js";
import type { Implementation } from "../protocol.js";

import { ErrorCode, JSONRPC_VERSION } from "../jsonrpc.js";
import {
	encodeHeaderValue,
	LATEST_PROTOCOL_VERSION,
	METHOD_HEADER,
	MetaKey,
	NAME_HEADER,
	PROTOCOL_VERSION_HEADER,
	SUPPORTED_PROTOCOL_VERSIONS,
} from "../protocol.js";

import { McpClientError } from "./errors.js";

/** Methods that require a mirrored `Mcp-Name` header. */
const NAME_SOURCE: Record<string, "name" | "uri"> = {
	"tools/call": "name",
	"resources/read": "uri",
};

/** Options for one RPC against a bound endpoint. */
export interface RpcOptions {
	url: URL;
	client: Implementation;
	headers: HeadersInit | undefined;
	credentials: RequestCredentials | undefined;
	signal: AbortSignal;
	/** Protocol revision to send; defaults to the package latest. */
	protocolVersion?: string;
}

/**
 * POSTs one JSON-RPC request and returns its `result` object, or a client error.
 * On `-32022` with `data.supported`, retries once with the newest shared revision.
 *
 * @param method The MCP method name.
 * @param params Method params without `_meta` (this layer adds it).
 * @param options Bound URL, identity, auth, and abort signal.
 */
export async function rpc(
	method: string,
	params: Record<string, unknown>,
	options: RpcOptions,
): Promise<Result<Record<string, unknown>, McpClientError>> {
	let version = options.protocolVersion ?? LATEST_PROTOCOL_VERSION;
	let first = await post(method, params, { ...options, protocolVersion: version });
	if (!isFailure(first)) return first;
	if (first.error.code !== ErrorCode.UnsupportedProtocolVersion) return first;

	let supported = readSupported(first.error.data);
	if (supported === undefined) return first;
	let negotiated = newestIntersection(supported);
	if (negotiated === undefined || negotiated === version) return first;
	return post(method, params, { ...options, protocolVersion: negotiated });
}

/** Performs one POST; used by {@link rpc} and its single retry. */
async function post(
	method: string,
	params: Record<string, unknown>,
	options: RpcOptions & { protocolVersion: string },
): Promise<Result<Record<string, unknown>, McpClientError>> {
	if (options.signal.aborted) {
		return failure(new McpClientError("MCP client session is closed"));
	}

	let id: RequestId = generateUUID();
	let body = {
		jsonrpc: JSONRPC_VERSION,
		id,
		method,
		params: {
			...params,
			_meta: {
				[MetaKey.ProtocolVersion]: options.protocolVersion,
				[MetaKey.ClientInfo]: options.client,
				[MetaKey.ClientCapabilities]: {},
			},
		},
	};

	let headers = new Headers(options.headers);
	headers.set("Content-Type", "application/json");
	headers.set(PROTOCOL_VERSION_HEADER, options.protocolVersion);
	headers.set(METHOD_HEADER, method);
	let nameField = NAME_SOURCE[method];
	if (nameField !== undefined) {
		let value = params[nameField];
		if (typeof value === "string") headers.set(NAME_HEADER, encodeHeaderValue(value));
	}

	let response: Response;
	try {
		response = await fetch(options.url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			credentials: options.credentials,
			signal: options.signal,
		});
	} catch (error) {
		if (options.signal.aborted) {
			return failure(new McpClientError("MCP client session is closed"));
		}
		let message = error instanceof Error ? error.message : "MCP request failed";
		return failure(new McpClientError(message));
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return failure(
			new McpClientError(`MCP endpoint returned non-JSON (HTTP ${response.status})`, {
				code: ErrorCode.ParseError,
			}),
		);
	}

	if (!isObject(payload)) {
		return failure(new McpClientError("MCP endpoint returned a non-object JSON body"));
	}

	if ("error" in payload) {
		let failureBody = payload as unknown as JsonRpcFailure;
		let error = failureBody.error;
		return failure(
			new McpClientError(error?.message ?? "MCP request failed", {
				code: typeof error?.code === "number" ? error.code : undefined,
				data: error?.data,
			}),
		);
	}

	if (!("result" in payload)) {
		return failure(new McpClientError("MCP endpoint returned neither result nor error"));
	}

	let successBody = payload as unknown as JsonRpcSuccess;
	if (!isObject(successBody.result)) {
		return failure(new McpClientError("MCP success result was not an object"));
	}
	return success(successBody.result as Record<string, unknown>);
}

/** Reads `data.supported` from an UnsupportedProtocolVersion error. */
function readSupported(data: unknown): string[] | undefined {
	if (!isObject(data)) return undefined;
	let supported = data.supported;
	if (!Array.isArray(supported)) return undefined;
	let versions = supported.filter((entry): entry is string => typeof entry === "string");
	return versions.length > 0 ? versions : undefined;
}

/**
 * Newest revision both this package and the remote list, preferring this
 * package's order in {@link SUPPORTED_PROTOCOL_VERSIONS}.
 */
function newestIntersection(remote: readonly string[]): string | undefined {
	for (let version of SUPPORTED_PROTOCOL_VERSIONS) {
		if (remote.includes(version)) return version;
	}
	return undefined;
}

/** Narrows an unknown value to a plain object. */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
