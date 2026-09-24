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
function post(url: string, body: string, contentType = "application/json"): Request {
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
		["key order in the body", post("https://api.example.com/monitors", '{ "a":1}')],
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

	test("reads a request without a body", async () => {
		let result = await fingerprint(new Request("https://api.example.com/x", { method: "POST" }));
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});
});
