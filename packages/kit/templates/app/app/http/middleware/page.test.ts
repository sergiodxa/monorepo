/**
 * The page chain's security headers and language, checked through the home page, since every
 * page declares the same chain and so sends the same policy. The home controller loads with the
 * file, so the cold import of the chain and its document stays outside each test's time limit.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

import "~/app/http/controllers/home";

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

	test("renders in the language the visitor asks for, or the fallback", async () => {
		let response = await createWebRouter().fetch(
			new Request("https://example.com/", { headers: { "accept-language": "fr-FR, en;q=0.5" } }),
		);

		let html = await response.text();
		expect(html).toContain('<html lang="en"');
		expect(html).toContain("<h1>Welcome</h1>");
		expect(html).toContain("<code>app/http/controllers/home.tsx</code>");
	});

	test("links the canonical URL on SITE_URL, whichever host served the page", async () => {
		let response = await createWebRouter().fetch("https://preview.example.net/?utm_source=mail");

		expect(await response.text()).toContain('<link rel="canonical" href="https://example.com/"');
	});
});
