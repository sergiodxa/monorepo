/**
 * zlib compression for `IDAT` data through the platform's `CompressionStream` and
 * `DecompressionStream`, which every Worker, browser, Bun and Node runtime ships, so the
 * package carries no deflate implementation of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Compresses `bytes` into a zlib stream (the `"deflate"` format, header and Adler-32
 * included) at the platform's default level.
 */
export function deflate(bytes: Uint8Array): Promise<Uint8Array> {
	return transform(bytes, new CompressionStream("deflate"));
}

/**
 * Decompresses a zlib stream. Rejects when the stream is corrupt, ends early, or carries a
 * wrong Adler-32.
 */
export function inflate(bytes: Uint8Array): Promise<Uint8Array> {
	return transform(bytes, new DecompressionStream("deflate"));
}

/**
 * Feeds `bytes` through `stream` and collects its output. The writer's own rejections are
 * observed so a failure surfaces once, through the readable side the caller awaits.
 */
async function transform(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
	let writer = stream.writable.getWriter();
	writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => undefined);
	writer.close().catch(() => undefined);
	let buffer = await new Response(stream.readable).arrayBuffer();
	return new Uint8Array(buffer);
}
