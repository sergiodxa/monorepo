/**
 * Opaque cursor codec for keyset paging.
 *
 * A cursor is the base64url of a small JSON payload holding the ordering column
 * names, the boundary row's values for them, and which edge of a page it marks.
 * Naming the columns lets an ordering change invalidate old cursors before they
 * can seek on the wrong key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { Base64Url } from "@pkg/crypto";
import { failure, isFailure, success } from "@pkg/result";
import * as s from "remix/data-schema";

import { InvalidCursorError, UnencodableCursorValueError } from "./errors";

/**
 * A row value that survives a round trip through a cursor.
 *
 * Dates, bigints, and `null` are rejected at encode time, since a coerced value
 * would compare against the wrong column type and return the wrong page.
 */
export type CursorValue = string | number | boolean;

/**
 * Which edge of a page a cursor marks, and therefore how to seek from it.
 *
 * `"after"` is minted from the last row of a page and seeks forward; `"before"`
 * is minted from the first row and seeks backward.
 */
export type CursorDirection = "after" | "before";

/** Payload version, so a future cursor format can be told apart from this one. */
const CURSOR_VERSION = 1;

/**
 * Keys stay short because cursors travel in query strings where every byte is
 * paid for by the client: `v` is the version, `d` the direction, `k` the
 * columns, and `p` the boundary row's positionally aligned values.
 */
interface CursorPayload {
	v: typeof CURSOR_VERSION;
	d: CursorDirection;
	k: string[];
	p: CursorValue[];
}

/** Validates a decoded payload, so a hand-crafted cursor cannot reach the seek builder. */
let CursorPayloadSchema = s.object({
	v: s.literal(CURSOR_VERSION),
	d: s.enum_(["after", "before"]),
	k: s.array(s.string()),
	p: s.array(s.union([s.string(), s.number(), s.boolean()])),
});

/**
 * A cursor after decoding and structural validation.
 *
 * Column names are kept so the caller can reject a cursor minted for a different
 * ordering before it is turned into a predicate.
 */
export interface DecodedCursor {
	/** Edge of the page this cursor was minted from. */
	direction: CursorDirection;
	/** Ordering column names, most significant first, exactly as they were encoded. */
	columns: string[];
	/** Boundary row values, positionally aligned with `columns`. */
	values: CursorValue[];
}

/**
 * Narrows an arbitrary row value to something a cursor can carry.
 *
 * `NaN` and `Infinity` are excluded along with `null` because `JSON.stringify`
 * turns each into `null`, and the decoded cursor then compares against it.
 */
function isCursorValue(value: unknown): value is CursorValue {
	if (typeof value === "string" || typeof value === "boolean") return true;
	return typeof value === "number" && Number.isFinite(value);
}

/**
 * Encodes a page boundary as an opaque, URL-safe cursor.
 *
 * The cursor is a plain base64url encoding, readable by anyone who has it, so
 * it must only ever carry ordering keys the client is already allowed to see.
 *
 * @param direction Edge of the page being encoded, which decides how it is seeked.
 * @param columns Ordering column names, most significant first.
 * @param values Boundary row values, positionally aligned with `columns`.
 * @returns The cursor string, or `UnencodableCursorValueError` for a null or exotic value.
 * @example
 * encodeCursor("after", ["created_at", "id"], [1700000000, "evt_9"]);
 */
export function encodeCursor(
	direction: CursorDirection,
	columns: readonly string[],
	values: readonly unknown[],
): Result<string, UnencodableCursorValueError> {
	let encodable: CursorValue[] = [];

	for (let [index, column] of columns.entries()) {
		let value = values[index];
		if (!isCursorValue(value)) return failure(new UnencodableCursorValueError(column));
		encodable.push(value);
	}

	let payload: CursorPayload = {
		v: CURSOR_VERSION,
		d: direction,
		k: [...columns],
		p: encodable,
	};

	return success(Base64Url.encode(JSON.stringify(payload)));
}

/**
 * Decodes and structurally validates a cursor.
 *
 * Every failure mode, including a payload that is not valid JSON, resolves to
 * `InvalidCursorError`, so callers always get a `400`-safe value.
 *
 * @param cursor The opaque string a client sent back.
 * @returns The decoded boundary, or `InvalidCursorError` when it is not a cursor this package minted.
 * @example
 * let decoded = decodeCursor(searchParams.get("cursor") ?? "");
 */
export function decodeCursor(cursor: string): Result<DecodedCursor, InvalidCursorError> {
	let bytes = Base64Url.decode(cursor);
	if (isFailure(bytes)) return failure(new InvalidCursorError("not base64url"));

	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.data);
	} catch {
		return failure(new InvalidCursorError("not valid UTF-8"));
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return failure(new InvalidCursorError("not valid JSON"));
	}

	let payload = s.parseSafe(CursorPayloadSchema, parsed);
	if (!payload.success) return failure(new InvalidCursorError("unrecognized payload"));

	if (payload.value.k.length !== payload.value.p.length) {
		return failure(new InvalidCursorError("column and value counts disagree"));
	}

	if (payload.value.k.length === 0) {
		return failure(new InvalidCursorError("no ordering columns"));
	}

	return success({
		direction: payload.value.d,
		columns: payload.value.k,
		values: payload.value.p,
	});
}
