/**
 * Tests the API's problem catalog: every type lives under the public error reference,
 * that reference lists every type with its status, and a validation failure round-trips
 * through the catalog with its `errors` extension intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import errorsDoc from "~/resources/docs/api/errors.md?raw";

import { apiProblems, invalidField, problemInstance } from "./api-problems";

describe("apiProblems", () => {
	test("puts every type under the public error reference", () => {
		for (let entry of apiProblems.entries()) {
			expect(entry.type).toMatch(/^https:\/\/uptime\.sergiodxa\.com\/docs\/api\/errors\/[a-z-]+$/);
		}
	});

	test("is listed, type by type and with its status, in the error reference", () => {
		for (let entry of apiProblems.entries()) {
			let slug = entry.type.split("/").pop();
			expect(errorsDoc).toMatch(new RegExp(`\\| ${entry.status}\\s+\\| \`${slug}\`\\s*\\|`));
		}
	});

	test("answers with problem+json and the entry's status, keeping headers from init", async () => {
		let response = apiProblems.rateLimited(
			{ detail: "Slow down", instance: problemInstance() },
			{ headers: { "Retry-After": "30" } },
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(response.headers.get("Retry-After")).toBe("30");
	});

	test("round-trips a refused field through the catalog", async () => {
		let result = await apiProblems.parse(invalidField("Slug is already in use", "/slug"));

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result) || !apiProblems.is(result.data, "validationError")) return;
		expect(result.data.status).toBe(400);
		expect(result.data.detail).toBe("Slug is already in use");
		expect(result.data.instance).toMatch(/^urn:uuid:/);
		expect(result.data.extensions.errors).toEqual([
			{ pointer: "/slug", code: "invalid", message: "Slug is already in use" },
		]);
	});
});
