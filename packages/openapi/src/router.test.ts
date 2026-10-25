/**
 * Tests for serving a document: negotiation between JSON and YAML, strong ETags with
 * `304` revalidation, a build that runs once on the first request, a failed build
 * answered as a problem, and a deprecated operation's notice on its route's responses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RequestContext } from "remix/router";

import { failure, unwrap } from "@sdxc/result";
import { createContextKey, createRouter } from "remix/router";
import { get } from "remix/routes";
import { describe, expect, test, vi } from "vitest";

import { OpenAPIBuildError } from "./errors.js";
import { defineOperation } from "./operation.js";
import { deprecationHeaders, openapiHandler } from "./router.js";
import { parse } from "./serialize.js";
import { createFixtureDocument } from "./test/fixtures.js";

/** Calls a handler the way the router does, with only the request it reads. */
function call(handler: ReturnType<typeof openapiHandler>, url: string, headers: HeadersInit = {}) {
	let request = new Request(url, { headers });
	return handler({ request } as RequestContext);
}

const URL_BASE = "https://api.example.com/openapi.json";

describe("openapiHandler", () => {
	test("serves application/openapi+json by default, with a strong ETag and the cache policy", async () => {
		let handler = openapiHandler(() => createFixtureDocument().build());
		let response = await call(handler, URL_BASE);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/openapi+json; version=3.1.1");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("Vary")).toBe("Accept");
		expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
		expect(unwrap(parse(await response.text())).info.title).toBe("Monitors API");
	});

	test("answers each registered and generic media type the Accept header prefers", async () => {
		let handler = openapiHandler(() => createFixtureDocument().build());
		let contentType = async (accept: string, url = URL_BASE) =>
			(await call(handler, url, { Accept: accept })).headers.get("Content-Type");

		expect(await contentType("*/*")).toBe("application/openapi+json; version=3.1.1");
		expect(await contentType("application/json")).toBe("application/json");
		expect(await contentType("application/openapi+yaml;version=3.1")).toBe(
			"application/openapi+yaml; version=3.1.1",
		);
		expect(await contentType("application/json, application/openapi+json;q=0.5")).toBe(
			"application/json",
		);
		expect(await contentType("text/html")).toBe("application/openapi+json; version=3.1.1");
		expect(await contentType("application/json", `${URL_BASE}?format=yaml`)).toBe(
			"application/openapi+yaml; version=3.1.1",
		);
		expect(await contentType("application/yaml", `${URL_BASE}?format=yaml`)).toBe(
			"application/yaml",
		);
	});

	test("serves YAML for ?format=yaml or an Accept preferring application/yaml", async () => {
		let handler = openapiHandler(() => createFixtureDocument().build(), {
			cacheControl: "no-cache",
		});
		let byQuery = await call(handler, `${URL_BASE}?format=yaml`);
		let byAccept = await call(handler, URL_BASE, {
			Accept: "application/yaml, application/json;q=0.5",
		});

		expect(byQuery.headers.get("Content-Type")).toBe("application/openapi+yaml; version=3.1.1");
		expect(byAccept.headers.get("Content-Type")).toBe("application/yaml");
		expect(byQuery.headers.get("Cache-Control")).toBe("no-cache");
		expect((await byQuery.text()).startsWith("openapi: 3.1.1\n")).toBe(true);
		expect(byQuery.headers.get("ETag")).not.toBe(
			(await call(handler, URL_BASE)).headers.get("ETag"),
		);
	});

	test("answers 304 when If-None-Match carries the representation's ETag", async () => {
		let handler = openapiHandler(() => createFixtureDocument().build());
		let etag = (await call(handler, URL_BASE)).headers.get("ETag") ?? "";
		let revalidated = await call(handler, URL_BASE, { "If-None-Match": `"other", ${etag}` });
		let weak = await call(handler, URL_BASE, { "If-None-Match": `W/${etag}` });

		expect(revalidated.status).toBe(304);
		expect(revalidated.headers.get("ETag")).toBe(etag);
		expect(await revalidated.text()).toBe("");
		expect(weak.status).toBe(304);
	});

	test("builds on the first request and reuses the result", async () => {
		let build = vi.fn(() => createFixtureDocument().build());
		let handler = openapiHandler(build);

		expect(build).not.toHaveBeenCalled();
		await Promise.all([call(handler, URL_BASE), call(handler, URL_BASE)]);
		await call(handler, `${URL_BASE}?format=yaml`);
		expect(build).toHaveBeenCalledTimes(1);
	});

	test("a failed build answers 500 with a problem document", async () => {
		let handler = openapiHandler(() =>
			failure(new OpenAPIBuildError('Security scheme "oauth" is not declared', "a", "/paths")),
		);
		let response = await call(handler, URL_BASE);

		expect(response.status).toBe(500);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(await response.json()).toMatchObject({
			title: "The OpenAPI document failed to build",
			detail: 'Security scheme "oauth" is not declared',
		});
	});

	test("serves a route whose router publishes context of its own", async () => {
		let Tenant = createContextKey<string>();
		let router = createRouter({
			middleware: [
				(ctx, next) => {
					ctx.set(Tenant, "acme", { property: "tenant" });
					return next();
				},
			],
		});
		router.get(
			get("/openapi.json"),
			openapiHandler(() => createFixtureDocument().build()),
		);

		let response = await router.fetch(URL_BASE);

		expect(response.status).toBe(200);
	});
});

describe("deprecationHeaders", () => {
	/** A router serving one operation through the middleware. */
	function serve(deprecated: Parameters<typeof defineOperation>[2]["deprecated"]) {
		let route = get("/api/v1/legacy");
		let operation = defineOperation("legacy", route, {
			summary: "Legacy",
			responses: { 200: { description: "OK" } },
			deprecated,
		});
		let router = createRouter();
		router.map(route, {
			middleware: [deprecationHeaders(operation)],
			handler: () =>
				new Response("ok", { headers: { Link: '<https://api.example.com/next>; rel="next"' } }),
		});
		return router.fetch("https://api.example.com/api/v1/legacy");
	}

	test("writes the operation's notice onto the response, keeping its links", async () => {
		let response = await serve({
			deprecation: new Date("2027-01-01T00:00:00Z"),
			sunset: new Date("2027-07-01T00:00:00Z"),
			deprecationLink: "https://docs.example.com/changelog",
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Deprecation")).toBe("@1798761600");
		expect(response.headers.get("Sunset")).toBe("Thu, 01 Jul 2027 00:00:00 GMT");
		expect(response.headers.get("Link")).toBe(
			'<https://api.example.com/next>; rel="next", <https://docs.example.com/changelog>; rel="deprecation"',
		);
		expect(await response.text()).toBe("ok");
	});

	test("passes the response through for an operation without a notice", async () => {
		for (let deprecated of [undefined, true]) {
			let response = await serve(deprecated);
			expect(response.headers.get("Deprecation")).toBeNull();
		}
	});
});
