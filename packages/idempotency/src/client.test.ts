/**
 * Tests the client helpers: random and derived keys, and setting the header on a
 * `RequestInit` or a `Request` without replacing a key the caller already chose.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	applyIdempotencyKey,
	deriveIdempotencyKey,
	generateIdempotencyKey,
	withIdempotencyKey,
} from "./client.js";
import { readIdempotencyKey } from "./header.js";

describe("generateIdempotencyKey", () => {
	test("mints a fresh UUID each call", () => {
		let first = generateIdempotencyKey();
		expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(generateIdempotencyKey()).not.toBe(first);
	});
});

describe("deriveIdempotencyKey", () => {
	test("is stable for the same parts and differs for others", async () => {
		let key = await deriveIdempotencyKey("job-1", "create-monitor");
		expect(key).toMatch(/^[0-9a-f]{64}$/);
		expect(await deriveIdempotencyKey("job-1", "create-monitor")).toBe(key);
		expect(await deriveIdempotencyKey("job-1", "create-alert")).not.toBe(key);
	});

	test("keeps part boundaries", async () => {
		expect(await deriveIdempotencyKey("ab", "c")).not.toBe(await deriveIdempotencyKey("a", "bc"));
	});
});

describe("withIdempotencyKey", () => {
	test("sets the header as an sf-string on a copy, keeping other headers", () => {
		let init: RequestInit = { method: "POST", headers: { Authorization: "Bearer t" } };
		let next = unwrap(withIdempotencyKey(init, "abc"));
		let headers = new Headers(next.headers);

		expect(headers.get("Idempotency-Key")).toBe('"abc"');
		expect(headers.get("Authorization")).toBe("Bearer t");
		expect(next.method).toBe("POST");
		expect(new Headers(init.headers).has("Idempotency-Key")).toBe(false);
	});

	test("fails for a key an sf-string cannot carry", () => {
		expect(isFailure(withIdempotencyKey({}, "café"))).toBe(true);
	});
});

describe("applyIdempotencyKey", () => {
	test("adds a generated key to a POST that has none", () => {
		let request = unwrap(applyIdempotencyKey(new Request("https://x.test", { method: "POST" })));
		let key = unwrap(readIdempotencyKey(request.headers));
		expect(key).toMatch(/^[0-9a-f-]{36}$/);
	});

	test("adds the given key to a PATCH, however it is cased", () => {
		let request = unwrap(
			applyIdempotencyKey(new Request("https://x.test", { method: "patch" }), "k1"),
		);
		expect(request.headers.get("Idempotency-Key")).toBe('"k1"');
	});

	test("keeps the key a retrying caller already set", () => {
		let original = new Request("https://x.test", {
			method: "POST",
			headers: { "Idempotency-Key": '"mine"' },
		});
		let request = unwrap(applyIdempotencyKey(original, "other"));
		expect(request.headers.get("Idempotency-Key")).toBe('"mine"');
	});

	test("leaves other methods alone", () => {
		let request = unwrap(applyIdempotencyKey(new Request("https://x.test"), "k1"));
		expect(request.headers.has("Idempotency-Key")).toBe(false);
	});

	test("keeps the body", async () => {
		let request = unwrap(
			applyIdempotencyKey(new Request("https://x.test", { method: "POST", body: "payload" })),
		);
		expect(await request.text()).toBe("payload");
	});

	test("fails for a key an sf-string cannot carry", () => {
		let result = applyIdempotencyKey(new Request("https://x.test", { method: "POST" }), "a\nb");
		expect(isFailure(result)).toBe(true);
	});
});
