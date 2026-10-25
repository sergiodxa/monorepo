/**
 * Tests for the request fingerprint: equal for byte-identical requests, different when the
 * method, path, query, media type or body differ, and blind to media type parameters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fingerprint } from "./fingerprint.js";

/** A JSON `POST`, the shape most protected requests have. */
function post(url: string, body: BodyInit, contentType = "application/json"): Request {
	return new Request(url, { method: "POST", body, headers: { "Content-Type": contentType } });
}

describe("fingerprint", () => {
	test("is 64 hex characters, equal for identical requests", async () => {
		let first = await fingerprint(post("https://api.example.com/monitors", '{"a":1}'));
		let second = await fingerprint(post("https://api.example.com/monitors", '{"a":1}'));
		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(second).toBe(first);
	});

	test("ignores the origin, since the record is already scoped to one API", async () => {
		let first = await fingerprint(post("https://a.example.com/monitors", "{}"));
		let second = await fingerprint(post("https://b.example.com/monitors", "{}"));
		expect(second).toBe(first);
	});

	test("ignores media type parameters and case", async () => {
		let first = await fingerprint(post("https://api.example.com/x", "{}", "application/json"));
		let second = await fingerprint(
			post("https://api.example.com/x", "{}", "Application/JSON; charset=utf-8"),
		);
		expect(second).toBe(first);
	});

	test.each([
		["body", post("https://api.example.com/monitors", '{"a":2}')],
		["path", post("https://api.example.com/alerts", '{"a":1}')],
		["query", post("https://api.example.com/monitors?dry=1", '{"a":1}')],
		["media type", post("https://api.example.com/monitors", '{"a":1}', "text/plain")],
		[
			"method",
			new Request("https://api.example.com/monitors", {
				method: "PATCH",
				body: '{"a":1}',
				headers: { "Content-Type": "application/json" },
			}),
		],
	])("changes with the %s", async (_, request) => {
		let base = await fingerprint(post("https://api.example.com/monitors", '{"a":1}'));
		expect(await fingerprint(request)).not.toBe(base);
	});

	test("ignores key order and whitespace in a JSON body", async () => {
		let first = await fingerprint(
			post("https://api.example.com/x", '{"a":1,"b":[1.50,{"d":2,"c":3}]}'),
		);
		let second = await fingerprint(
			post(
				"https://api.example.com/x",
				'{ "b": [1.5, { "c": 3, "d": 2 }], "a": 1 }',
				"application/merchant+json",
			),
		);
		let third = await fingerprint(
			post("https://api.example.com/x", '{ "b": [1.5, { "c": 3, "d": 2 }], "a": 1 }'),
		);
		expect(third).toBe(first);
		expect(second).not.toBe(first);
	});

	test("keeps the fingerprint of a body that is already canonical", async () => {
		let canonical = await fingerprint(post("https://api.example.com/x", '{"a":1}'));
		let raw = await fingerprint(post("https://api.example.com/x", '{"a":1}', "text/json"));
		let head = '["POST","/x","application/json"]\n{"a":1}';
		let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(head));
		let expected = Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		expect(canonical).toBe(expected);
		expect(raw).not.toBe(canonical);
	});

	test("compares a body with digits a double would round byte for byte", async () => {
		let first = await fingerprint(post("https://api.example.com/x", '{"id":12345678901234567890}'));
		let second = await fingerprint(
			post("https://api.example.com/x", '{"id":12345678901234567000}'),
		);
		expect(second).not.toBe(first);
	});

	test.each([
		["text that is not JSON", "{"],
		["JSON with a lone surrogate", '"\\ud800"'],
		["text that is not UTF-8", new Uint8Array([0x22, 0xff, 0x22])],
	])("hashes %s as sent", async (_, body) => {
		let bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
		let asJson = await fingerprint(post("https://api.example.com/x", bytes));
		let padded = await fingerprint(
			post("https://api.example.com/x", new Uint8Array([...bytes, 0x20])),
		);
		expect(padded).not.toBe(asJson);
	});

	test("reads a request without a body", async () => {
		let result = await fingerprint(new Request("https://api.example.com/x", { method: "POST" }));
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});
});
