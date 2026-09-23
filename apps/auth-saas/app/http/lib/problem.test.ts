/**
 * Checks `managementProblem()`'s wire shape against a hand-written expectation matching
 * how the management client's `ManagementProblem` decodes a response: `type`, `title`,
 * `status`, a minted `instance`, and only when given, `detail` and `errors`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { managementProblem } from "./problem";

describe("managementProblem", () => {
	test("answers application/problem+json at the entry's status", async () => {
		let response = managementProblem("badCursor");

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("carries type, title, status and a minted instance with no detail or errors given", async () => {
		let response = managementProblem("kindImmutable");

		let body = (await response.json()) as Record<string, unknown>;

		expect(body.type).toBe("https://docs.example.com/errors/kind-immutable");
		expect(body.title).toBe("A client's kind may not change once registered");
		expect(body.status).toBe(409);
		expect(typeof body.instance).toBe("string");
		expect(body).not.toHaveProperty("detail");
		expect(body).not.toHaveProperty("errors");
	});

	test("carries detail and instance when given", async () => {
		let response = managementProblem("rateLimited", {
			detail: "This client's write budget is spent for this window.",
			instance: "req_abc123",
		});

		let body = (await response.json()) as Record<string, unknown>;

		expect(body.detail).toBe("This client's write budget is spent for this window.");
		expect(body.instance).toBe("req_abc123");
	});

	test("answers a dead download link and a verification ticket under separate types", async () => {
		let link = managementProblem("invalidTicket");
		let ticket = managementProblem("invalidVerificationTicket");

		expect(link.status).toBe(404);
		expect(ticket.status).toBe(400);
		expect(((await ticket.json()) as Record<string, unknown>).type).toBe(
			"https://docs.example.com/errors/invalid-verification-ticket",
		);
		expect(((await link.json()) as Record<string, unknown>).type).toBe(
			"https://docs.example.com/errors/invalid-ticket",
		);
	});

	test("carries a validation failure's errors, one per invalid field", async () => {
		let response = managementProblem("validationFailed", {
			extensions: {
				errors: [{ pointer: "/name", code: "required", message: "name is required" }],
			},
		});

		let body = (await response.json()) as Record<string, unknown>;

		expect(body.errors).toEqual([
			{ pointer: "/name", code: "required", message: "name is required" },
		]);
	});

	test("keeps headers passed through init", () => {
		let response = managementProblem("rateLimited", {}, { headers: { "Retry-After": "30" } });

		expect(response.headers.get("Retry-After")).toBe("30");
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
