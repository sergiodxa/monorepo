/**
 * Failures the MCP client returns through `@sdxc/result` when transport or
 * JSON-RPC goes wrong. A tool result with `isError` is not one of these — that
 * is a successful RPC whose payload is model-facing guidance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An I/O or protocol failure talking to an MCP endpoint. Callers receive it inside
 * a `Result` failure; the client never throws it across the public API.
 */
export class McpClientError extends Error {
	override readonly name = "McpClientError";

	/**
	 * Optional JSON-RPC error code when the failure came from a protocol error
	 * response rather than transport.
	 */
	readonly code: number | undefined;

	/** Optional structured `error.data` from the JSON-RPC failure. */
	readonly data: unknown;

	/**
	 * @param message What went wrong, written for the caller's developer.
	 * @param options Optional JSON-RPC code and data when the server answered with an error.
	 */
	constructor(message: string, options: { code?: number; data?: unknown } = {}) {
		super(message);
		this.code = options.code;
		this.data = options.data;
	}
}
