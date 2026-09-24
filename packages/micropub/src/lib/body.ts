/**
 * Reads a Micropub POST body in the encoding its `Content-Type` names: JSON through a
 * byte cap that stops reading once exceeded, and forms from the `FormData` a middleware
 * already parsed or from the request itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { MicropubRequestError } from "./errors.js";

/** A body decoded as the encoding its media type names. */
export type Body = { kind: "json"; value: unknown } | { kind: "form"; formData: FormData };

/**
 * The lowercase essence of a media type, `type/subtype` without parameters, which is how
 * every media-type comparison in this package matches.
 */
export function mediaTypeEssence(contentType: string): string {
	return (contentType.split(";")[0] ?? "").trim().toLowerCase();
}

/**
 * Decodes the body. JSON is `application/json` or any `+json` type; forms are
 * `application/x-www-form-urlencoded` and `multipart/form-data`, read from `formData`
 * when a middleware consumed the stream first. Any other type is `invalid_request`.
 */
export async function readBody(
	request: Request,
	formData: FormData | undefined,
	maxJsonBytes: number,
): Promise<Result<Body, MicropubRequestError>> {
	let essence = mediaTypeEssence(request.headers.get("Content-Type") ?? "");
	if (essence === "application/json" || essence.endsWith("+json")) {
		let text = await readText(request, maxJsonBytes);
		if (isFailure(text)) return text;
		try {
			return success({ kind: "json", value: JSON.parse(text.data) });
		} catch {
			return failure(new MicropubRequestError("The body is not valid JSON."));
		}
	}
	if (essence === "application/x-www-form-urlencoded" || essence === "multipart/form-data") {
		if (formData !== undefined) return success({ kind: "form", formData });
		try {
			return success({ kind: "form", formData: await request.formData() });
		} catch {
			return failure(new MicropubRequestError(`The ${essence} body could not be read.`));
		}
	}
	return failure(
		new MicropubRequestError(
			`Micropub requests are form-encoded, multipart or JSON, not ${essence || "untyped"}.`,
		),
	);
}

/**
 * The body as UTF-8 text, refused as soon as it passes `maxBytes`, so an oversized
 * JSON body is never buffered whole.
 */
async function readText(
	request: Request,
	maxBytes: number,
): Promise<Result<string, MicropubRequestError>> {
	let tooLarge = new MicropubRequestError(`The JSON body is larger than ${maxBytes} bytes.`);
	let declared = Number(request.headers.get("Content-Length"));
	if (Number.isFinite(declared) && declared > maxBytes) return failure(tooLarge);
	if (request.body === null) return success("");
	let reader = request.body.getReader();
	let chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		let chunk = await reader.read();
		if (chunk.done) break;
		total += chunk.value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			return failure(tooLarge);
		}
		chunks.push(chunk.value);
	}
	let bytes = new Uint8Array(total);
	let offset = 0;
	for (let part of chunks) {
		bytes.set(part, offset);
		offset += part.byteLength;
	}
	return success(new TextDecoder().decode(bytes));
}
