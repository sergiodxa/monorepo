/**
 * Tests that a former host of the site redirects readers to the same page on the current
 * one, while requests that change something reach their handler on either host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { fetchApp } from "~/app/test/router";

describe("canonical-host", () => {
	test("redirects a page on the former host to the same path and query on sdxc.dev", async () => {
		let response = await fetchApp("https://sdxc.sergiodxa.com/api/result?tab=bun");

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe("https://sdxc.dev/api/result?tab=bun");
	});

	test("redirects a HEAD probe on the former host", async () => {
		let response = await fetchApp("https://sdxc.sergiodxa.com/", { method: "HEAD" });

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe("https://sdxc.dev/");
	});

	test("serves the page on the current host", async () => {
		let response = await fetchApp("https://sdxc.dev/llms.txt");

		expect(response.status).toBe(200);
	});

	test("lets a POST on the former host reach its handler", async () => {
		let response = await fetchApp("https://sdxc.sergiodxa.com/mcp", {
			method: "POST",
			headers: { origin: "https://sdxc.sergiodxa.com", "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
		});

		expect(response.status).not.toBe(301);
	});
});
