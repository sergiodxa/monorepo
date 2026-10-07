/**
 * Drives the composition root's router end to end, inside workerd against the real
 * bindings. Every route is mapped behind a loader, so the assertions here are that a
 * request still reaches the module it names, that the CMS guards still answer before the
 * module they protect is ever loaded, and that no other origin can write to the CMS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/well-known/security-txt";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { migratedDatabase } from "~/app/test/d1";
import { seedAdmin, signedInCookie } from "~/app/test/session";
import { SECURITY_TXT } from "~/config/security-txt";
import routes from "~/routes/web";

import createApplication from "./app";

/** Deferred work the request handed to `waitUntil`, kept so nothing escapes the test. */
let deferred: Array<Promise<unknown>> = [];

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: (promise) => deferred.push(promise),
	};
}

/** Builds the router and sends one request through it, the way the Worker entrypoint does. */
function fetchPath(path: string, init?: RequestInit) {
	return createApplication(environment()).fetch(
		new Request(new URL(path, "https://blog.test"), init),
	);
}

describe("the blog router", () => {
	test("reaches a deferred action's module", async () => {
		let response = await fetchPath("/mcp.md");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
	});

	test("reaches a deferred controller's action", async () => {
		let response = await fetchPath("/mcp");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	test("answers an unmapped path with the 404 page", async () => {
		let response = await fetchPath("/nothing-is-here");

		expect(response.status).toBe(404);
	});

	test("sends an anonymous visitor from the CMS dashboard to login, naming it as `next`", async () => {
		let response = await fetchPath("/cms");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${routes.auth.login.index.href()}?next=%2Fcms`);
	});

	test("sends an anonymous visitor from a CMS resource route to login, naming it as `next`", async () => {
		let response = await fetchPath("/cms/articles");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${routes.auth.login.index.href()}?next=%2Fcms%2Farticles`,
		);
	});

	/**
	 * The share sheet opens this page with an expired session, and the login has to bring
	 * the editor back to it with the shared URL still in the query.
	 */
	test("carries a CMS page's query along to login", async () => {
		let response = await fetchPath("/cms/bookmarks/new?url=https://example.com/post?id=7");
		let location = new URL(response.headers.get("location") ?? "", "https://blog.test");

		expect(response.status).toBe(303);
		expect(location.pathname).toBe(routes.auth.login.index.href());
		expect(location.searchParams.get("next")).toBe(
			"/cms/bookmarks/new?url=https%3A%2F%2Fexample.com%2Fpost%3Fid%3D7",
		);
	});

	test("sends an anonymous visitor away from a CMS write to the login page alone", async () => {
		let response = await fetchPath("/cms/cache/purge", { method: "POST" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.auth.login.index.href());
	});

	test("redirects a slashed path to its slash-free form, keeping the query", async () => {
		let response = await fetchPath("/articles/?page=2");

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("https://blog.test/articles?page=2");
	});

	test("redirects a slashed POST with a 308, so the client repeats it with its body", async () => {
		let response = await fetchPath("/webmention/", { method: "POST" });

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("https://blog.test/webmention");
	});

	test("serves security.txt with the site's contact", async () => {
		let response = await fetchPath("/.well-known/security.txt");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");

		let parsed = parse(await response.text());
		if (isFailure(parsed)) throw parsed.error;
		expect(parsed.data.contact.map(String)).toEqual(SECURITY_TXT.contact.map(String));
		expect(parsed.data.expires).toEqual(SECURITY_TXT.expires);
	});

	test("sends the security headers, with the CSP only reported and no nonce", async () => {
		let response = await fetchPath("/mcp");

		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
		expect(response.headers.get("content-security-policy")).toBeNull();

		let reported = response.headers.get("content-security-policy-report-only");
		expect(reported).toContain("default-src 'self'");
		expect(reported).not.toContain("nonce-");
	});

	test("logs the request under the trace its caller sent", async () => {
		let records: unknown[] = [];
		let spy = vi.spyOn(console, "log").mockImplementation((record) => records.push(record));

		try {
			await fetchPath("/mcp.md", {
				headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
			});
		} finally {
			spy.mockRestore();
		}

		expect(records).toContainEqual(
			expect.objectContaining({
				trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
				parent_span_id: "00f067aa0ba902b7",
			}),
		);
	});
});

describe("cross-origin protection", () => {
	let cookie = "";

	beforeAll(async () => {
		let adminId = await seedAdmin(await migratedDatabase());
		cookie = await signedInCookie(adminId, environment().COOKIE_SESSION_SECRET);
	});

	/** Empties the edge cache from the dashboard as the signed-in admin's browser. */
	function purgeCache(headers: Record<string, string>) {
		return fetchPath(routes.cms.purgeCache.href(), {
			method: routes.cms.purgeCache.method,
			headers: { cookie, ...headers },
		});
	}

	test("lets the signed-in admin write to the CMS from the CMS itself", async () => {
		let response = await purgeCache({ "sec-fetch-site": "same-origin" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toMatch(/^\/cms\?purge=/);
	});

	test.each([
		["another site", { "sec-fetch-site": "cross-site" }],
		[
			"a sibling subdomain, which the cookie's SameSite=Lax lets through",
			{ "sec-fetch-site": "same-site" },
		],
		[
			"another origin, named by a browser sending no Sec-Fetch-Site",
			{ origin: "https://evil.com" },
		],
	])("refuses a CMS write the signed-in admin's browser sends from %s", async (_, headers) => {
		let response = await purgeCache(headers);

		expect(response.status).toBe(403);
	});

	/** Each answers an empty body with its own refusal, which shows the handler was reached. */
	test.each([
		[routes.mcp.index.href(), 415],
		[routes.webmention.href(), 400],
	])(
		"hands a cross-origin POST at the cookieless machine path %s to its handler",
		async (path, status) => {
			let response = await fetchPath(path, {
				method: "POST",
				headers: { "sec-fetch-site": "cross-site" },
			});

			expect(response.status).toBe(status);
		},
	);
});
