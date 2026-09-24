/**
 * Reads a message body into bytes without ever holding more than a cap. A sender that declares
 * a length past the cap is refused before a byte is read, and one that streams past it is cut
 * off at the first chunk that crosses it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * What a bounded read produced: the bytes, `"too-large"` for a body past the cap, or
 * `"unreadable"` for a stream that failed partway.
 */
export type BoundedRead = Uint8Array | "too-large" | "unreadable";

/**
 * Reads a body, keeping the bytes exactly as they arrived.
 *
 * @param message - The request or response whose body to read.
 * @param maxBytes - The most bytes the body may carry.
 */
export async function readBytes(
	message: Request | Response,
	maxBytes: number,
): Promise<BoundedRead> {
	let declared = Number(message.headers.get("content-length") ?? Number.NaN);
	if (Number.isFinite(declared) && declared > maxBytes) {
		void message.body?.cancel().catch(() => undefined);
		return "too-large";
	}

	if (message.body === null) return new Uint8Array(0);

	let reader = message.body.getReader();
	let chunks: Uint8Array[] = [];
	let total = 0;

	try {
		for (;;) {
			let { done, value } = await reader.read();
			if (done || value === undefined) break;

			total += value.byteLength;
			if (total > maxBytes) {
				void reader.cancel().catch(() => undefined);
				return "too-large";
			}

			chunks.push(value);
		}
	} catch {
		return "unreadable";
	}

	let bytes = new Uint8Array(total);
	let offset = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return bytes;
}
