/**
 * Tests for the keyset cursor codec.
 *
 * Cursors come back from clients, so every way one can be wrong resolves to a
 * returned value: bad base64url, bad UTF-8, bad JSON, and a payload that is
 * merely plausible all land on the same failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@pkg/crypto";
import { isFailure, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { decodeCursor, encodeCursor } from "./cursor";
import { InvalidCursorError, UnencodableCursorValueError } from "./errors";

describe("encodeCursor / decodeCursor", () => {
	test("round-trips the ordering columns, values, and direction", () => {
		let cursor = unwrap(encodeCursor("after", ["created_at", "id"], [1700000000, "evt_9"]));
		let decoded = unwrap(decodeCursor(cursor));

		expect(decoded.direction).toBe("after");
		expect(decoded.columns).toEqual(["created_at", "id"]);
		expect(decoded.values).toEqual([1700000000, "evt_9"]);
	});

	test("round-trips a backward cursor", () => {
		let cursor = unwrap(encodeCursor("before", ["id"], [42]));

		expect(unwrap(decodeCursor(cursor)).direction).toBe("before");
	});

	test("round-trips boolean and comma-bearing string values", () => {
		let cursor = unwrap(encodeCursor("after", ["flagged", "label"], [true, "a,b"]));

		expect(unwrap(decodeCursor(cursor)).values).toEqual([true, "a,b"]);
	});

	test("produces a URL-safe string with no padding", () => {
		let cursor = unwrap(encodeCursor("after", ["id"], ["a"]));

		expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(encodeURIComponent(cursor)).toBe(cursor);
	});

	test("refuses a null ordering value, which no SQL comparison could seek past", () => {
		let result = encodeCursor("after", ["created_at", "id"], [null, "evt_9"]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(UnencodableCursorValueError);
			expect(result.error.message).toContain("created_at");
		}
	});

	test("refuses a value that is missing from the row entirely", () => {
		let result = encodeCursor("after", ["id"], [undefined]);

		expect(isFailure(result)).toBe(true);
	});

	test("refuses a value JSON would turn into null", () => {
		expect(isFailure(encodeCursor("after", ["score"], [Number.NaN]))).toBe(true);
		expect(isFailure(encodeCursor("after", ["at"], [new Date()]))).toBe(true);
	});

	test("rejects a cursor that is not base64url", () => {
		let result = decodeCursor("not a cursor!!");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidCursorError);
	});

	test("rejects a truncated cursor rather than throwing from JSON.parse", () => {
		let cursor = unwrap(encodeCursor("after", ["id"], ["evt_9"]));
		let result = decodeCursor(cursor.slice(0, Math.floor(cursor.length / 2)));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidCursorError);
	});

	test("rejects valid base64url that is not JSON", () => {
		let result = decodeCursor(Base64Url.encode("plain text"));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("JSON");
	});

	test("rejects bytes that are not valid UTF-8", () => {
		let result = decodeCursor(Base64Url.encode(new Uint8Array([0xff, 0xfe, 0xfd])));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("UTF-8");
	});

	test("rejects JSON that is not a cursor payload", () => {
		let result = decodeCursor(Base64Url.encode(JSON.stringify({ page: 2 })));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("payload");
	});

	test("rejects a payload from a different cursor version", () => {
		let result = decodeCursor(
			Base64Url.encode(JSON.stringify({ v: 2, d: "after", k: ["id"], p: [1] })),
		);

		expect(isFailure(result)).toBe(true);
	});

	test("rejects a payload whose columns and values disagree in length", () => {
		let result = decodeCursor(
			Base64Url.encode(JSON.stringify({ v: 1, d: "after", k: ["a", "b"], p: [1] })),
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("disagree");
	});

	test("rejects a payload with no ordering columns", () => {
		let result = decodeCursor(Base64Url.encode(JSON.stringify({ v: 1, d: "after", k: [], p: [] })));

		expect(isFailure(result)).toBe(true);
	});

	test("rejects an empty string", () => {
		expect(isFailure(decodeCursor(""))).toBe(true);
	});
});
