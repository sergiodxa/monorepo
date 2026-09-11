/**
 * Drives the composition root's router end to end, inside workerd against the real
 * bindings. Every route is mapped behind a loader, so the assertions here are that a
 * request still reaches the module it names, and that the CMS guards still answer
 * before the module they protect is ever loaded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

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

	test("sends an anonymous visitor away from the CMS dashboard", async () => {
		let response = await fetchPath("/cms");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.auth.login.index.href());
	});

	test("sends an anonymous visitor away from a CMS resource route", async () => {
		let response = await fetchPath("/cms/articles");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.auth.login.index.href());
	});

	test("sends an anonymous visitor away from a CMS write", async () => {
		let response = await fetchPath("/cms/cache/purge", { method: "POST" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.auth.login.index.href());
	});
});
