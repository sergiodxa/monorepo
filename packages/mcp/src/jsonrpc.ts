/**
 * The JSON-RPC 2.0 envelope MCP speaks, reduced to what a server has to read and write,
 * plus the error codes revision `2026-07-28` allocates.
 *
 * Kept apart from the transport so the message layer can be exercised without building a
 * `Request`, and apart from the tool layer so a handler never sees an id or a code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The only `jsonrpc` value either side may send. */
export const JSONRPC_VERSION = "2.0";

/**
 * The JSON-RPC error codes this server produces.
 *
 * The standard range is JSON-RPC's own. The `-32020` block is the sub-range MCP reserves
 * for protocol-defined errors; `-32000` to `-32019` is the legacy sub-range that new
 * implementations must not allocate from, which is why nothing here uses it.
 */
export const ErrorCode = {
	/** The body was not JSON. */
	ParseError: -32_700,
	/** The body was JSON, but not a message this server accepts. */
	InvalidRequest: -32_600,
	/** No such method, or no such tool. Answered over HTTP with `404`. */
	MethodNotFound: -32_601,
	/** Arguments, or the required request metadata, did not satisfy their contract. */
	InvalidParams: -32_602,
	/** The server failed for a reason the caller cannot act on. */
	InternalError: -32_603,
	/** An HTTP header does not match the body value it mirrors, or is missing. */
	HeaderMismatch: -32_020,
	/** The request needs a client capability the request did not declare. */
	MissingRequiredClientCapability: -32_021,
	/** The requested protocol revision is not one this server implements. */
	UnsupportedProtocolVersion: -32_022,
} as const;

/** One of the {@link ErrorCode} values. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * A request's correlation id.
 *
 * JSON-RPC also allows `null`, which MCP forbids: a message with a `null` id cannot be
 * told apart from a notification, so this server rejects one as an invalid request.
 */
export type RequestId = string | number;

/** An inbound message. Without `id` it is a notification and gets no response. */
export interface JsonRpcMessage {
	jsonrpc: typeof JSONRPC_VERSION;
	id?: RequestId;
	method: string;
	params?: Record<string, unknown>;
}

/**
 * A successful response.
 *
 * Every result carries `resultType`, which this revision made mandatory so a client can
 * tell a finished answer from one asking for more input without knowing the method.
 */
export interface JsonRpcSuccess {
	jsonrpc: typeof JSONRPC_VERSION;
	id: RequestId;
	result: { resultType: string; [key: string]: unknown };
}

/** A failed response. `id` is `null` when the request was too malformed to carry one. */
export interface JsonRpcFailure {
	jsonrpc: typeof JSONRPC_VERSION;
	id: RequestId | null;
	error: { code: number; message: string; data?: unknown };
}

/** Either half of what a server writes back. */
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

/**
 * Reports whether a parsed body is a message this server can dispatch.
 *
 * @param value A value parsed from the request body.
 * @returns True when it carries the right `jsonrpc` version, a `method`, an object
 * `params` if any, and either a usable `id` or none at all.
 */
export function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

	let message = value as Record<string, unknown>;
	if (message.jsonrpc !== JSONRPC_VERSION) return false;
	if (typeof message.method !== "string") return false;

	if (Object.hasOwn(message, "params")) {
		let params = message.params;
		if (typeof params !== "object" || params === null || Array.isArray(params)) return false;
	}

	if (!Object.hasOwn(message, "id")) return true;
	return typeof message.id === "string" || typeof message.id === "number";
}

/** Reports whether a message expects a response. */
export function isRequest(message: JsonRpcMessage): message is JsonRpcMessage & { id: RequestId } {
	return message.id !== undefined;
}

/**
 * Builds a successful response.
 *
 * @param id The id of the request being answered.
 * @param result The method's return value, which must already carry `resultType`.
 */
export function reply(id: RequestId, result: JsonRpcSuccess["result"]): JsonRpcSuccess {
	return { jsonrpc: JSONRPC_VERSION, id, result };
}

/**
 * Builds a failed response.
 *
 * @param id The id of the request being answered, or `null` when none could be read.
 * @param code One of the {@link ErrorCode} values.
 * @param message What went wrong, written for the client's developer.
 * @param data Structured detail, such as the list of failed argument constraints.
 */
export function replyError(
	id: RequestId | null,
	code: ErrorCode,
	message: string,
	data?: unknown,
): JsonRpcFailure {
	let error: JsonRpcFailure["error"] = { code, message };
	if (data !== undefined) error.data = data;
	return { jsonrpc: JSONRPC_VERSION, id, error };
}
