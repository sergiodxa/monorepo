/**
 * Reads, caps and lets go of message bodies, whichever runtime handed over the
 * message: the global `fetch`, a binding, a router, or a request a handler received.
 * The count over the stream enforces the cap, so a body never sits whole past it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { failedWith, OutboundError } from "./error.js";

/** How large a body may be. */
export interface ReadOptions {
	/** The most bytes the body may carry; one more and the read fails `too-large`. */
	maxBytes: number;
}

/** A body read as text, and the bytes that came off the wire to produce it. */
export interface ReadText {
	text: string;
	bytes: number;
}

/** A body read as bytes, exactly as they arrived. */
export interface ReadBytes {
	data: Uint8Array<ArrayBuffer>;
	bytes: number;
}

/**
 * Reads a body as UTF-8 text within a cap.
 *
 * @param message - The request or response whose body to read.
 * @param options - The cap.
 * @returns The text and its size in bytes; `too-large` past the cap, `timeout` when the
 * deadline `follow` set passed mid-body, and `network` when the stream broke off.
 * @example let body = await readText(response, { maxBytes: 2 * 1024 * 1024 });
 */
export async function readText(
	message: Request | Response,
	options: ReadOptions,
): Promise<Result<ReadText, OutboundError>> {
	let decoder = new TextDecoder();
	let text = "";

	let read = await consume(message, options.maxBytes, (chunk) => {
		text += decoder.decode(chunk, { stream: true });
	});
	if (isFailure(read)) return read;

	return success({ text: text + decoder.decode(), bytes: read.data });
}

/**
 * Reads a body as bytes within a cap, for a caller that verifies a signature over the
 * exact bytes or decodes them itself.
 *
 * @param message - The request or response whose body to read.
 * @param options - The cap.
 * @returns The bytes and their count, or the same failures as `readText`.
 * @example let body = await readBytes(request, { maxBytes: 1024 * 1024 });
 */
export async function readBytes(
	message: Request | Response,
	options: ReadOptions,
): Promise<Result<ReadBytes, OutboundError>> {
	let chunks: Uint8Array[] = [];

	let read = await consume(message, options.maxBytes, (chunk) => {
		chunks.push(chunk);
	});
	if (isFailure(read)) return read;

	let data = new Uint8Array(new ArrayBuffer(read.data));
	let offset = 0;
	for (let chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return success({ data, bytes: read.data });
}

/**
 * Answers the same response with a body that errors with a `too-large` `OutboundError`
 * at the first chunk past the cap, for a body passed through rather than read. A
 * declared length over the cap errors the body before any of it is forwarded.
 *
 * @param response - The response whose body to cap.
 * @param options - The cap.
 * @returns A response with the same status and headers, and the capped body.
 * @example return limitBody(upstream, { maxBytes: 5 * 1024 * 1024 });
 */
export function limitBody(response: Response, options: ReadOptions): Response {
	if (response.body === null) return response;

	let { maxBytes } = options;
	let url = response.url;
	let declared = declaredLength(response);
	let seen = 0;

	let capped = new TransformStream<Uint8Array, Uint8Array>({
		start(controller) {
			if (declared !== undefined && declared > maxBytes) controller.error(tooLarge(url, maxBytes));
		},
		transform(chunk, controller) {
			seen += chunk.byteLength;
			if (seen > maxBytes) controller.error(tooLarge(url, maxBytes));
			else controller.enqueue(chunk);
		},
	});

	return new Response(response.body.pipeThrough(capped), response);
}

/**
 * Lets go of a body left unread, telling the origin it may stop sending. The
 * cancellation runs on its own, so a stream that stalls costs the caller nothing.
 *
 * @param source - A body, a reader of one, or `null` for a message with none.
 * @example release(response.body);
 */
export function release(source: { cancel(): Promise<void> } | null): void {
	void source?.cancel().catch(() => undefined);
}

/** Reads the length a message claims, for the refusal that costs no bytes at all. */
export function declaredLength(message: Request | Response): number | undefined {
	let header = message.headers.get("content-length");
	if (header === null) return undefined;

	let length = Number(header);
	return Number.isFinite(length) ? length : undefined;
}

/**
 * Hands every chunk of a body to `take` and answers how many bytes it read. A
 * declared length over the cap fails before a byte is read, and crossing the cap
 * cancels the stream so the origin stops sending.
 */
async function consume(
	message: Request | Response,
	maxBytes: number,
	take: (chunk: Uint8Array) => void,
): Promise<Result<number, OutboundError>> {
	let url = message.url;

	let declared = declaredLength(message);
	if (declared !== undefined && declared > maxBytes) {
		release(message.body);
		return failure(tooLarge(url, maxBytes));
	}

	if (message.body === null) return success(0);

	let reader = message.body.getReader();
	let bytes = 0;

	try {
		for (;;) {
			let { done, value } = await reader.read();
			if (done || value === undefined) break;

			bytes += value.byteLength;
			if (bytes > maxBytes) {
				release(reader);
				return failure(tooLarge(url, maxBytes));
			}

			take(value);
		}
	} catch (error) {
		return failure(failedWith(url, error));
	}

	return success(bytes);
}

/** The failure for a body past its cap. */
function tooLarge(url: string, maxBytes: number): OutboundError {
	let label = url === "" ? "the body" : url;
	return new OutboundError(
		"too-large",
		url,
		`Refused ${label}: it exceeded the ${maxBytes} byte cap`,
	);
}
