/**
 * Raw DEFLATE over the streams every runtime this package ships to provides,
 * which is the compression the HTTP-Redirect binding carries its request and
 * response payloads in, in both directions and with an expansion limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { wrap } from "@sdxc/result";

import { toBufferSource } from "./bytes.js";

/**
 * How many bytes one payload may decompress to. A redirect URL holds a few
 * kilobytes at most, so a payload that expands past this is a compression bomb
 * rather than a request, and it is stopped mid-stream instead of after.
 */
const MAX_INFLATED_BYTES = 1024 * 1024;

/**
 * Compresses bytes with raw DEFLATE, the form the redirect binding's
 * `SAMLRequest` parameter is base64 of.
 *
 * @param data - Bytes to compress
 * @returns The compressed bytes, or the failure the stream reported
 */
export async function deflateRaw(data: Uint8Array): Promise<Result<Bytes, Error>> {
	return await wrap(async () => {
		let stream = new CompressionStream("deflate-raw");
		let written = pump(stream.writable, data);
		let compressed = await collect(stream.readable, null);
		await written;
		return compressed;
	});
}

/**
 * Decompresses a raw DEFLATE payload, refusing one that expands past the limit
 * this module sets.
 *
 * @param data - Compressed bytes, as the binding carried them
 * @returns The original bytes, or the failure the stream reported
 */
export async function inflateRaw(data: Uint8Array): Promise<Result<Bytes, Error>> {
	return await wrap(async () => {
		let stream = new DecompressionStream("deflate-raw");
		let written = pump(stream.writable, data).catch(() => undefined);
		let inflated = await collect(stream.readable, MAX_INFLATED_BYTES);
		await written;
		return inflated;
	});
}

/**
 * Feeds the whole input through the writable half, running alongside the read
 * so a payload larger than the stream's internal queue keeps moving under the
 * backpressure the reader applies.
 */
async function pump(writable: WritableStream<BufferSource>, data: Uint8Array): Promise<void> {
	let writer = writable.getWriter();
	await writer.write(toBufferSource(data));
	await writer.close();
}

/**
 * Reads the whole readable half, stopping the moment the output passes the
 * limit, which is what keeps a bomb from being held in memory before it is
 * measured. A `null` limit reads to the end.
 */
async function collect(readable: ReadableStream<Uint8Array>, limit: number | null): Promise<Bytes> {
	let reader = readable.getReader();
	let chunks: Uint8Array[] = [];
	let size = 0;

	for (;;) {
		let { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		size += value.byteLength;
		if (limit !== null && size > limit) {
			await reader.cancel();
			throw new RangeError(`Decompressed payload exceeds ${limit} bytes`);
		}

		chunks.push(value);
	}

	return concatBytes(...chunks);
}
