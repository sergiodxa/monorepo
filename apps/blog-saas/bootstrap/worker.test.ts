/**
 * Tests the worker's page-view metering — which exchanges are billed to
 * Analytics Engine as a page view, and which are exempt — driven through the
 * real worker `fetch` with a stubbed environment: a recording `ANALYTICS`
 * binding, a pre-seeded KV slug cache, and a tenant DO stub returning HTML.
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
} from "@sdxc/cloudflare-mocks";
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
 * Installed once, above the worker's dynamic import, since env is read at
 * import time. Tests reset the two recording bindings between runs, and only
 * the bindings a tenant page view touches are supplied here.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		PLATFORM_DOMAIN: "blog.test",
		ANALYTICS: analytics,
		SLUG_CACHE: slugCache,
		BLOG: createDurableObjectNamespace(() => async () => tenantResponse()),
		ASSETS: createFetcher(() => new Response("Not found", { status: 404 })),
		POLAR_ACCESS_TOKEN: "polar-token",
		POLAR_PRODUCT_ID: "product-1",
	}),
	DurableObject: class {},
}));

const worker = (await import("./worker")).default;

/**
 * Sends one request for a tenant page through the worker. The handler expects
 * the `cf`-carrying request the runtime hands it, so a plain `Request` is cast
 * to match here, since only the request's `method` and `headers` matter.
 */
function fetchTenantPage(method: string): Promise<Response> {
	let request = new Request("https://acme.blog.test/posts/hello", {
		method,
		headers: { "sec-fetch-dest": "document", accept: "text/html" },
	});

	return worker.fetch(request as unknown as Parameters<typeof worker.fetch>[0]);
}

describe("page view metering", () => {
	beforeEach(async () => {
		analytics.reset();
		slugCache.reset();

		/** Pre-seeds the cache so the subdomain resolves straight from KV. */
		await slugCache.put("slug:acme", JSON.stringify({ blogId: "blog-1", region: "weur" }));
	});

	test("bills a GET of a tenant page", async () => {
		let response = await fetchTenantPage("GET");

		expect(response.status).toBe(200);
		expect(analytics.dataPoints).toHaveLength(1);
		expect(analytics.dataPoints[0]?.blobs?.slice(0, 2)).toEqual(["blog-1", "page_view"]);
	});

	/**
	 * The guard reads the request's original method: downstream routers rewrite
	 * a `HEAD` probe's context method to `GET` before running the full handler,
	 * so metering off the rewritten method would bill uptime-monitor probes too.
	 */
	test("does not bill a HEAD probe of the same page", async () => {
		let response = await fetchTenantPage("HEAD");

		expect(response.status).toBe(200);
		expect(analytics.dataPoints).toHaveLength(0);
	});
});
