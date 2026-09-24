/**
 * Reads and writes the `Idempotency-Key` field, which the IETF draft defines as an RFC 9651
 * Item whose value is an sf-string. Going through the Structured Fields parser means an
 * unquoted or malformed key is refused the same way every other client sees it refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { getField, stringify } from "@sdxc/structured-fields";

import { IdempotencyKeyError } from "./errors.js";

/** The field name the draft registers. */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Longest key accepted when the caller sets no bound; a UUID needs 36. */
const DEFAULT_MAX_LENGTH = 255;

/** Options for {@link readIdempotencyKey}. */
export interface ReadIdempotencyKeyOptions {
	/**
	 * Longest key accepted, in characters. A bound keeps a client from making the server
	 * hash and store arbitrarily large values.
	 * @default 255
	 */
	maxLength?: number;
}

/**
 * Reads the key from request headers. Parameters on the Item are ignored, since the draft
 * defines none; an empty string is refused because it cannot tell two operations apart.
 *
 * @param headers - The request headers
 * @param options - The length bound
 * @returns The key, `null` when the header is absent, or why the value is unacceptable
 * @example readIdempotencyKey(request.headers) // success("8e03978e-…") for `"8e03978e-…"`
 */
export function readIdempotencyKey(
	headers: Headers,
	options: ReadIdempotencyKeyOptions = {},
): Result<string | null, IdempotencyKeyError> {
	let parsed = getField(headers, IDEMPOTENCY_KEY_HEADER, "item");
	if (isFailure(parsed)) {
		return failure(
			new IdempotencyKeyError(
				`${IDEMPOTENCY_KEY_HEADER} is not a valid Structured Field Item`,
				"invalid",
				{
					cause: parsed.error,
				},
			),
		);
	}
	if (parsed.data === null) return success(null);

	let value = parsed.data.value;
	if (typeof value !== "string" || value.length === 0) {
		return failure(
			new IdempotencyKeyError(
				`${IDEMPOTENCY_KEY_HEADER} must be a non-empty quoted string`,
				"invalid",
			),
		);
	}

	let maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
	if (value.length > maxLength) {
		return failure(
			new IdempotencyKeyError(
				`${IDEMPOTENCY_KEY_HEADER} is longer than ${maxLength} characters`,
				"too-long",
			),
		);
	}
	return success(value);
}

/**
 * Serializes a key as the field's value: quoted, with `"` and `\` escaped. An sf-string
 * carries printable ASCII only, so a key with any other character fails.
 *
 * @param key - The key to send
 * @returns The field value, or why the key cannot be sent
 * @example formatIdempotencyKey("abc") // success('"abc"')
 */
export function formatIdempotencyKey(key: string): Result<string, IdempotencyKeyError> {
	if (key.length === 0) {
		return failure(new IdempotencyKeyError("An idempotency key cannot be empty", "invalid"));
	}
	let text = stringify(key, "item");
	if (isFailure(text)) {
		return failure(
			new IdempotencyKeyError("An idempotency key must be printable ASCII", "invalid", {
				cause: text.error,
			}),
		);
	}
	return text;
}
