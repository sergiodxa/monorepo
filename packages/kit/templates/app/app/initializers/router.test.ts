/**
 * The router's own middleware, checked through a request's log record: what every page and
 * endpoint gets before its controller runs.
 */

import { Log } from "@sdxc/logger";
import { describe, expect, test } from "vite-plus/test";

import { createWebRouter } from "~/app/initializers/router";
import { SECURITY_TXT } from "~/config/security-txt";

/** How far ahead of `Expires` security.txt must be renewed. */
const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Fetches `request` through the router and answers the log record it wrote. */
async function record(request: Request) {
	let records: Array<Readonly<Record<string, unknown>>> = [];
	let log = new Log({ kind: "request", sink: (written) => records.push(written) });
	await log.run(() => createWebRouter().fetch(request));
	return records[0];
}

describe("router", () => {
	test("continues the caller's W3C trace", async () => {
		let written = await record(
			new Request("https://example.com/api/health", {
				headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
			}),
		);

		expect(written).toMatchObject({
			trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
			parent_span_id: "00f067aa0ba902b7",
		});
	});

	test("redirects a path with a trailing slash to the canonical one", async () => {
		let response = await createWebRouter().fetch("https://example.com/sitemap.xml/?page=2");

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("https://example.com/sitemap.xml?page=2");
	});

	test("serves security.txt with its contact", async () => {
		let response = await createWebRouter().fetch("https://example.com/.well-known/security.txt");

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Contact: mailto:security@example.com");
	});

	test("keeps security.txt current for at least another month", () => {
		expect(SECURITY_TXT.expires.getTime() - Date.now()).toBeGreaterThan(RENEWAL_WINDOW_MS);
	});

	test("previews the mapped emails at /_emails while developing", async () => {
		let response = await createWebRouter().fetch("https://example.com/_emails");

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Email previews");
	});

	test("redirects the www. host to the apex domain", async () => {
		let response = await createWebRouter().fetch("https://www.example.com/sitemap.xml");

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("https://example.com/sitemap.xml");
	});
});
