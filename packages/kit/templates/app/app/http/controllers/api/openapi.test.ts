/**
 * `/api/openapi.json`, fetched through the app's router: one document naming the published
 * origin, which a client revalidates by its `ETag`.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { SITE_URL } from "~/config/constants";

describe("openapi", () => {
	test("names SITE_URL as the server whatever origin the request reached", async () => {
		let response = await createWebRouter().fetch("http://localhost:5173/api/openapi.json");

		let document = (await response.json()) as { servers: Array<{ url: string }> };
		expect(document.servers).toEqual([{ url: SITE_URL }]);
	});

	test("answers a request carrying the document's ETag with 304", async () => {
		let router = createWebRouter();
		let first = await router.fetch("https://example.com/api/openapi.json");

		let second = await router.fetch("https://example.com/api/openapi.json", {
			headers: { "If-None-Match": first.headers.get("ETag") ?? "" },
		});

		expect(second.status).toBe(304);
	});
});
