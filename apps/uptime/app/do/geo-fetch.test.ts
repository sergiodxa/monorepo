/**
 * Unit tests for `GeoFetchDO.fetch`: it proxies `fetch`, stamps the response with an
 * `X-Response-Time` header, and tags a failed proxied request as `unreachable` instead
 * of letting it reject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState, createEnv } from "@sdxc/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({}),
	DurableObject: class {
		constructor() {}
	},
}));

let { GeoFetchDO } = await import("./geo-fetch");

/** The monitored endpoint the object under test probes. */
let PROBE_URL = "https://example.com/ping";

/** MSW server standing in for the monitored endpoint. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The object under test on a fresh Durable Object state, with no bindings available. */
function createGeoFetch() {
	return new GeoFetchDO(createDurableObjectState({ name: "geo-fetch" }), createEnv<Env>({}));
}

/** Probes `PROBE_URL` through a fresh instance of the object under test. */
function probe() {
	return createGeoFetch().fetch(new Request(PROBE_URL));
}

/**
 * A mocked response whose `body` stream survives being read by the object under test.
 * Bun 1.3.14 empties a response's body stream when `clone()` follows reading `body`,
 * which the interceptor does; handing out a fresh stream per read keeps it observable.
 */
function respondWithBody(body: string, init?: ResponseInit) {
	let response = new HttpResponse(body, init);
	Object.defineProperty(response, "body", {
		configurable: true,
		get: () => new Blob([body]).stream(),
	});
	return response;
}

describe("GeoFetchDO.fetch", () => {
	test("adds a non-negative X-Response-Time header and passes a 2xx response through unchanged", async () => {
		server.use(http.get(PROBE_URL, () => respondWithBody("hello world", { status: 200 })));

		let response = await probe();

		let responseTime = Number(response.headers.get("X-Response-Time"));
		expect(Number.isFinite(responseTime)).toBe(true);
		expect(responseTime).toBeGreaterThanOrEqual(0);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello world");
	});

	test("passes a non-2xx response's status and body through unchanged", async () => {
		server.use(http.get(PROBE_URL, () => respondWithBody("service unavailable", { status: 503 })));

		let response = await probe();

		let responseTime = Number(response.headers.get("X-Response-Time"));
		expect(Number.isFinite(responseTime)).toBe(true);
		expect(responseTime).toBeGreaterThanOrEqual(0);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe("service unavailable");
	});

	test("tags a proxied response as 'responded'", async () => {
		server.use(http.get(PROBE_URL, () => new HttpResponse("hello world", { status: 200 })));

		let response = await probe();

		expect(response.headers.get("X-Probe-Outcome")).toBe("responded");
	});

	test("overwrites an X-Probe-Outcome the monitored endpoint set on itself", async () => {
		server.use(
			http.get(
				PROBE_URL,
				() =>
					new HttpResponse("hello world", {
						status: 200,
						headers: { "X-Probe-Outcome": "unreachable" },
					}),
			),
		);

		let response = await probe();

		expect(response.headers.get("X-Probe-Outcome")).toBe("responded");
	});

	test("resolves as 'unreachable' instead of rejecting when the request fails", async () => {
		server.use(http.get(PROBE_URL, () => HttpResponse.error()));

		let response = await probe();

		expect(response.headers.get("X-Probe-Outcome")).toBe("unreachable");
		expect(response.headers.get("X-Probe-Error")).toBe("Failed to fetch");
	});
});
