/**
 * Unit tests for `GeoFetchDO.fetch`: it proxies the underlying `fetch` call, stamps the
 * response with an `X-Response-Time` header measuring elapsed time, and passes the
 * underlying response's status and body through unchanged for both success and error
 * statuses. Also covers the outcome tagging that lets the caller tell an unreachable
 * monitor apart from this object being unavailable: a failed proxied request resolves
 * as `unreachable` rather than rejecting, and the header is always overwritten so a
 * monitored endpoint can't declare its own outcome. The global `fetch` is stubbed per
 * test instead of hitting the network, and `cloudflare:workers` is replaced since
 * `GeoFetchDO extends DurableObject` imported from it: the object touches no binding, so
 * the env is empty and reading one would name the binding that was reached for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, mock, test } from "bun:test";

import { createDurableObjectState, createEnv } from "@pkg/cloudflare-mocks";

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({}),
	DurableObject: class {
		constructor() {}
	},
}));

let { GeoFetchDO } = await import("./geo-fetch");

let originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

/** The object under test on a fresh Durable Object state, with no bindings available. */
function createGeoFetch() {
	return new GeoFetchDO(createDurableObjectState({ name: "geo-fetch" }), createEnv<Env>({}));
}

describe("GeoFetchDO.fetch", () => {
	test("adds a non-negative X-Response-Time header and passes a 2xx response through unchanged", async () => {
		globalThis.fetch = (async () =>
			new Response("hello world", { status: 200 })) as unknown as typeof fetch;

		let instance = createGeoFetch();
		let response = await instance.fetch(new Request("https://example.com/ping"));

		let responseTime = Number(response.headers.get("X-Response-Time"));
		expect(Number.isFinite(responseTime)).toBe(true);
		expect(responseTime).toBeGreaterThanOrEqual(0);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello world");
	});

	test("passes a non-2xx response's status and body through unchanged", async () => {
		globalThis.fetch = (async () =>
			new Response("service unavailable", { status: 503 })) as unknown as typeof fetch;

		let instance = createGeoFetch();
		let response = await instance.fetch(new Request("https://example.com/ping"));

		let responseTime = Number(response.headers.get("X-Response-Time"));
		expect(Number.isFinite(responseTime)).toBe(true);
		expect(responseTime).toBeGreaterThanOrEqual(0);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe("service unavailable");
	});

	test("tags a proxied response as 'responded'", async () => {
		globalThis.fetch = (async () =>
			new Response("hello world", { status: 200 })) as unknown as typeof fetch;

		let instance = createGeoFetch();
		let response = await instance.fetch(new Request("https://example.com/ping"));

		expect(response.headers.get("X-Probe-Outcome")).toBe("responded");
	});

	test("overwrites an X-Probe-Outcome the monitored endpoint set on itself", async () => {
		globalThis.fetch = (async () =>
			new Response("hello world", {
				status: 200,
				headers: { "X-Probe-Outcome": "unreachable" },
			})) as unknown as typeof fetch;

		let instance = createGeoFetch();
		let response = await instance.fetch(new Request("https://example.com/ping"));

		expect(response.headers.get("X-Probe-Outcome")).toBe("responded");
	});

	test("resolves as 'unreachable' instead of rejecting when the request fails", async () => {
		globalThis.fetch = (async () => {
			throw new Error("connection refused");
		}) as unknown as typeof fetch;

		let instance = createGeoFetch();
		let response = await instance.fetch(new Request("https://example.com/ping"));

		expect(response.headers.get("X-Probe-Outcome")).toBe("unreachable");
		expect(response.headers.get("X-Probe-Error")).toBe("connection refused");
	});
});
