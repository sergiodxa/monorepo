/**
 * The page chain's security headers, checked through the home page, since every page declares
 * the same chain and so sends the same policy.
 */

import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import home from "~/app/http/controllers/home";
import { logger } from "~/app/initializers/logger";
import routes from "~/routes/web";

/** A router with the home page and the log its controllers are typed to read. */
function createPageRouter() {
	let router = createRouter({ middleware: [log(logger)] });
	router.map(routes.home, home);
	return router;
}

describe("page", () => {
	test("sends the Content-Security-Policy with a page", async () => {
		let response = await createPageRouter().fetch("https://example.com/");

		expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});

	test("advertises no nonce when the page renders no inline script", async () => {
		let response = await createPageRouter().fetch("https://example.com/");

		expect(response.headers.get("content-security-policy")).toContain("script-src 'self';");
	});
});
