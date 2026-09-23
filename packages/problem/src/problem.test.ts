/**
 * Tests for writing problems: RFC 9457's defaults, extensions beside the standard
 * members without replacing them, and the response's status and headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { problem, stringify } from "./problem.js";

describe("stringify", () => {
	test("a status alone writes an about:blank problem titled with the status phrase", () => {
		expect(JSON.parse(stringify({ status: 404 }))).toEqual({
			type: "about:blank",
			title: "Not Found",
			status: 404,
		});
	});

	test("writes the RFC's out-of-credit example with its extensions at the top level", () => {
		let text = stringify({
			status: 403,
			type: "https://example.com/probs/out-of-credit",
			title: "You do not have enough credit.",
			detail: "Your current balance is 30, but that costs 50.",
			instance: "/account/12345/msgs/abc",
			extensions: { balance: 30, accounts: ["/account/12345", "/account/67890"] },
		});

		expect(JSON.parse(text)).toEqual({
			type: "https://example.com/probs/out-of-credit",
			title: "You do not have enough credit.",
			status: 403,
			detail: "Your current balance is 30, but that costs 50.",
			instance: "/account/12345/msgs/abc",
			balance: 30,
			accounts: ["/account/12345", "/account/67890"],
		});
	});

	test("an extension named like a standard member never replaces it", () => {
		let text = stringify({ status: 400, extensions: { status: 200, type: "x", detail: "y" } });

		expect(JSON.parse(text)).toEqual({ type: "about:blank", title: "Bad Request", status: 400 });
	});

	test("an unregistered status still gets a title", () => {
		expect((JSON.parse(stringify({ status: 499 })) as { title: string }).title).toBe(
			"Unknown Status",
		);
	});
});

describe("problem", () => {
	test("answers with the status and the problem media type", async () => {
		let response = problem({ status: 409, detail: "Already exists." });

		expect(response.status).toBe(409);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(await response.json()).toEqual({
			type: "about:blank",
			title: "Conflict",
			status: 409,
			detail: "Already exists.",
		});
	});

	test("merges extra headers but keeps its own status and content type", () => {
		let response = problem(
			{ status: 429 },
			{ status: 200, headers: { "Retry-After": "60", "Content-Type": "text/plain" } },
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBe("60");
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
