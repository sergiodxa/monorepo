/**
 * Tests the worker's page-view metering: which exchanges reach Analytics Engine as a
 * billable page view, and which must not. Driven through the real worker `fetch` with a
 * stubbed environment — a recording `ANALYTICS` binding, a KV slug cache pre-seeded so the
 * subdomain resolves without D1, and a tenant DO stub returning a plain HTML document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
	createFetcher,
	createKVNamespace,
} from "@pkg/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** Analytics Engine binding recording the data points this run reported. */
let analytics = createAnalyticsEngine();

/** Slug cache holding the one mapping the tenant subdomain resolves through. */
let slugCache = createKVNamespace();

/** The tenant DO's reply: a 200 HTML document, which is the billable shape. */
function tenantResponse(): Response {
	return new Response("<!doctype html><title>A post</title>", {
		status: 200,
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

/**
 * Publishes the bindings as the worker's environment. The mock only reaches imports that run
 * after it, and the worker and everything it pulls in read `env` at import time, so it is
 * installed once here, above the worker's dynamic import; each test empties the two recording
 * bindings in place instead of re-creating them. Only the bindings a tenant page view touches
 * are supplied, so reading any other one fails by name.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		PLATFORM_DOMAIN: "blog.test",
		ANALYTICS: analytics,
		SLUG_CACHE: slugCache,
		// The namespace hands back a stub whose `fetch` answers as the tenant would.
		BLOG: createDurableObjectNamespace(() => async () => tenantResponse()),
		ASSETS: createFetcher(() => new Response("Not found", { status: 404 })),
	}),
	DurableObject: class {},
}));

const worker = (await import("./worker")).default;

/** Sends one request for a tenant page through the worker. */
function fetchTenantPage(method: string): Promise<Response> {
	let request = new Request("https://acme.blog.test/posts/hello", {
		method,
		headers: { "sec-fetch-dest": "document", accept: "text/html" },
	});

	// The handler is typed for the `cf`-carrying request the runtime hands it; a plain
	// `Request` is what it actually reads here, and nothing on this path touches `cf`.
	return worker.fetch(request as unknown as Parameters<typeof worker.fetch>[0]);
}

describe("page view metering", () => {
	beforeEach(async () => {
		analytics.reset();
		slugCache.reset();

		// Pre-seeded so the subdomain resolves out of cache, without reaching D1.
		await slugCache.put("slug:acme", JSON.stringify({ blogId: "blog-1", region: "weur" }));
	});

	test("bills a GET of a tenant page", async () => {
		let response = await fetchTenantPage("GET");

		expect(response.status).toBe(200);
		expect(analytics.dataPoints).toHaveLength(1);
		expect(analytics.dataPoints[0]?.blobs?.slice(0, 2)).toEqual(["blog-1", "page_view"]);
	});

	/**
	 * The guard reads the *original* request method on purpose. The routers downstream put
	 * `HEAD` handling at the head of their chain, which rewrites the context's method to
	 * `GET` and runs the whole handler, so a probe produces exactly the 200 HTML document a
	 * real page view does. Metering off the rewritten method would therefore bill every
	 * uptime monitor's probe — an invoice for traffic no reader ever generated. A `HEAD`
	 * must never be billed.
	 */
	test("does not bill a HEAD probe of the same page", async () => {
		let response = await fetchTenantPage("HEAD");

		expect(response.status).toBe(200);
		expect(analytics.dataPoints).toHaveLength(0);
	});
});
