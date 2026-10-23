/**
 * Tests the public page cache: a `200` HTML page gets a five-minute private policy with `Cookie`
 * and `Accept-Language` merged into its `Vary`, while a page with its own policy, a cookie, an
 * error or redirect status, or a non-HTML body keeps the headers its handler gave it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import publicPageCache from "~/app/http/middleware/public-page-cache";

/** Runs the middleware in front of a handler answering `response`, for a `GET` by default. */
async function serve(response: Response, method = "GET"): Promise<Response> {
	let middleware = publicPageCache();
	let request = new Request("https://uptime.test/features/monitors", { method });
	let context = { request } as unknown as Parameters<typeof middleware>[0];
	return (await middleware(context, async () => response)) as Response;
}

/** A rendered HTML page, as `ctx.render` answers it. */
function page(init: ResponseInit = {}): Response {
	let headers = new Headers(init.headers);
	headers.set("Content-Type", "text/html; charset=utf-8");
	return new Response("<!doctype html><p>page</p>", { ...init, headers });
}

describe("publicPageCache", () => {
	test("lets the browser keep a 200 HTML page for five minutes per cookie and language", async () => {
		let response = await serve(page());

		expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
		expect(response.headers.get("Vary")).toBe("cookie, accept-language");
		expect(await response.text()).toBe("<!doctype html><p>page</p>");
	});

	test("merges into the Vary the page already declares", async () => {
		let response = await serve(page({ headers: { Vary: "Accept-Encoding" } }));

		expect(response.headers.get("Vary")).toBe("accept-encoding, cookie, accept-language");
	});

	test("keeps the CSP the page carries on the stored response", async () => {
		let csp = "script-src 'nonce-abc' 'strict-dynamic'";
		let response = await serve(page({ headers: { "Content-Security-Policy": csp } }));

		expect(response.headers.get("Content-Security-Policy")).toBe(csp);
		expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
	});

	test("keeps a policy the controller already chose", async () => {
		let response = await serve(page({ headers: { "Cache-Control": "no-store" } }));

		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Vary")).toBeNull();
	});

	test("leaves a page that sets a cookie uncached", async () => {
		let response = await serve(page({ headers: { "Set-Cookie": "language=es; Path=/" } }));

		expect(response.headers.get("Cache-Control")).toBeNull();
	});

	test.each([404, 500])("leaves a %i page uncached", async (status) => {
		let response = await serve(page({ status }));

		expect(response.headers.get("Cache-Control")).toBeNull();
		expect(response.headers.get("Vary")).toBeNull();
	});

	test("leaves a redirect uncached", async () => {
		let response = await serve(Response.redirect("https://uptime.test/docs/overview", 302));

		expect(response.status).toBe(302);
		expect(response.headers.get("Cache-Control")).toBeNull();
	});

	test("leaves a non-HTML answer uncached", async () => {
		let response = await serve(Response.json({ ok: true }));

		expect(response.headers.get("Cache-Control")).toBeNull();
	});

	test("leaves a POST uncached", async () => {
		let response = await serve(page(), "POST");

		expect(response.headers.get("Cache-Control")).toBeNull();
	});
});
