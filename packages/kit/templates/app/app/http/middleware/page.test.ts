/**
 * The page chain's security headers, checked through the home page, since every page declares
 * the same chain and so sends the same policy.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

describe("page", () => {
	test("sends the Content-Security-Policy with a page", async () => {
		let response = await createWebRouter().fetch("https://example.com/");

		expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});

	test("advertises no nonce when the page renders no inline script", async () => {
		let response = await createWebRouter().fetch("https://example.com/");

		expect(response.headers.get("content-security-policy")).not.toContain("'nonce-");
	});
});
