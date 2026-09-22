/**
 * Checks `problem()`'s wire shape against a hand-written expectation matching how
 * `packages/auth/src/management-client.ts`'s `ManagementProblem` decodes a response:
 * `type`, `title`, `status`, and only when given, `detail` and `errors`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { problem } from "./problem";

describe("problem", () => {
	test("answers application/problem+json at the given status", async () => {
		let response = problem({
			type: "https://docs.example.com/errors/invalid-scope",
			title: "The requested scope exceeds this client's ceiling",
			status: 400,
		});

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("carries type, title, status and a minted instance with no detail or errors given", async () => {
		let response = problem({
			type: "https://docs.example.com/errors/invalid-target",
			title: "The resource does not name this client's own tenant",
			status: 400,
		});

		let body = (await response.json()) as Record<string, unknown>;

		expect(body.type).toBe("https://docs.example.com/errors/invalid-target");
		expect(body.title).toBe("The resource does not name this client's own tenant");
		expect(body.status).toBe(400);
		expect(typeof body.instance).toBe("string");
		expect(body).not.toHaveProperty("detail");
		expect(body).not.toHaveProperty("errors");
	});

	test("carries detail and instance when given", async () => {
		let response = problem({
			type: "https://docs.example.com/errors/rate-limited",
			title: "Too many requests",
			status: 429,
			detail: "This client's write budget is spent for this window.",
			instance: "req_abc123",
		});

		let body = (await response.json()) as Record<string, unknown>;

		expect(body.detail).toBe("This client's write budget is spent for this window.");
		expect(body.instance).toBe("req_abc123");
	});

	test("carries a validation failure's errors, one per invalid field", async () => {
		let response = problem({
			type: "https://docs.example.com/errors/validation",
			title: "The request body did not validate",
			status: 422,
			errors: [{ pointer: "/name", code: "required", message: "name is required" }],
		});

		let body = (await response.json()) as Record<string, unknown>;

		expect(body.errors).toEqual([
			{ pointer: "/name", code: "required", message: "name is required" },
		]);
	});
});
