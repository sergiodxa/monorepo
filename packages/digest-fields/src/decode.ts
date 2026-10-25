/**
 * Removes the content codings a `Content-Encoding` field lists, recovering the unencoded
 * representation an `Unencoded-Digest` covers, so a receiver holding still-coded bytes can
 * verify that field without re-encoding anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { DigestError } from "./errors.js";

/** Shared UTF-8 encoder, so a text body turns into the same bytes `digest` hashes. */
const ENCODER = new TextEncoder();

/** Each decodable content coding, keyed by its registered name, with its stream format. */
const DECODERS: Readonly<Record<string, CompressionFormat | null>> = {
	identity: null,
	gzip: "gzip",
	"x-gzip": "gzip",
	deflate: "deflate",
};

/**
 * Decodes a body through every coding a `Content-Encoding` value lists, last applied first,
 * as the codings were stacked in the listed order. An empty value or `identity` leaves the
 * bytes as they are.
 *
 * @param body - The content as received, still coded.
 * @param contentEncoding - The `Content-Encoding` value, or `null` when the field is absent.
 * @returns The unencoded bytes, or `coding` when a coding is not `gzip`, `x-gzip`, `deflate`
 *   or `identity`, or when the body does not decode.
 * @example await decodeContent(gzipped, "gzip") // success(the original bytes)
 */
export async function decodeContent(
	body: BinaryLike,
	contentEncoding: string | null,
): Promise<Result<Bytes, DigestError>> {
	let codings = (contentEncoding ?? "")
		.split(",")
		.map((coding) => coding.trim().toLowerCase())
		.filter((coding) => coding !== "")
		.reverse();

	let bytes = toBytes(body);
	for (let coding of codings) {
		if (!Object.hasOwn(DECODERS, coding)) {
			return failure(new DigestError("coding", `Cannot decode the ${coding} content coding`));
		}
		let format = DECODERS[coding];
		if (!format) continue;

		let decoded = await decompress(bytes, format);
		if (isFailure(decoded)) return decoded;
		bytes = decoded.data;
	}
	return success(bytes);
}

/**
 * Runs bytes through one platform decompression stream, turning a corrupt body into a
 * `coding` failure.
 *
 * @param bytes - The coded bytes.
 * @param format - The stream format of the coding.
 */
async function decompress(
	bytes: Bytes,
	format: CompressionFormat,
): Promise<Result<Bytes, DigestError>> {
	try {
		let stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
		return success(new Uint8Array(await new Response(stream).arrayBuffer()));
	} catch (error) {
		return failure(
			new DigestError("coding", `The body does not decode as ${format}`, { cause: error }),
		);
	}
}

/**
 * Normalizes a body into bytes, reading text as UTF-8.
 *
 * @param body - Text or binary content.
 */
function toBytes(body: BinaryLike): Bytes {
	if (typeof body === "string") return ENCODER.encode(body);
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	return body.slice();
}
