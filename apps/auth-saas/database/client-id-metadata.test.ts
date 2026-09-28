/**
 * Unit tests for `isClientIdUrl`'s shape check and `resolveCimdClient`'s fetch,
 * validation and short-lived cache, stubbing the metadata document with MSW so
 * these never reach a real network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { isClientIdUrl, resolveCimdClient } from "./client-id-metadata";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("isClientIdUrl", () => {
	test("accepts an absolute https URL with a path", () => {
		expect(isClientIdUrl("https://client.example.com/metadata.json")).toBe(true);
	});

	test("refuses an opaque id, the shape an ordinary registered client carries", () => {
		expect(isClientIdUrl("client_01H8XYZ")).toBe(false);
	});

	test("refuses http", () => {
		expect(isClientIdUrl("http://client.example.com/metadata.json")).toBe(false);
	});

	test("refuses a bare origin with no path", () => {
		expect(isClientIdUrl("https://client.example.com")).toBe(false);
		expect(isClientIdUrl("https://client.example.com/")).toBe(false);
	});

	test("refuses a URL carrying userinfo or a fragment", () => {
		expect(isClientIdUrl("https://user:pass@client.example.com/metadata.json")).toBe(false);
		expect(isClientIdUrl("https://client.example.com/metadata.json#section")).toBe(false);
	});
});

describe("resolveCimdClient", () => {
	/**
	 * Every test names its own URL: `resolveCimdClient` caches by URL for the module's
	 * whole lifetime, and this suite's tests otherwise run against that one shared cache.
	 */
	test("resolves a valid document into a client record", async () => {
		let url = "https://client.example.com/metadata-valid.json";
		server.use(
			http.get(url, () =>
				HttpResponse.json(
					{
						client_id: url,
						client_name: "Example Client",
						redirect_uris: ["https://client.example.com/callback"],
						scope: "openid profile",
					},
					{ headers: { "Content-Type": "application/json" } },
				),
			),
		);

		let resolved = await resolveCimdClient(url, Date.now());
		expect(resolved).toEqual({
			ok: true,
			client: {
				id: url,
				name: "Example Client",
				redirectUris: ["https://client.example.com/callback"],
				responseTypes: ["code"],
				scopes: ["openid", "profile"],
				logoUri: null,
				policyUri: null,
				tosUri: null,
			},
		});
	});

	test("refuses a document whose own client_id does not match the URL it was fetched from", async () => {
		let url = "https://client.example.com/metadata-mismatch.json";
		server.use(
			http.get(url, () =>
				HttpResponse.json(
					{
						client_id: "https://not-the-same-host.example.com/metadata.json",
						redirect_uris: ["https://client.example.com/callback"],
					},
					{ headers: { "Content-Type": "application/json" } },
				),
			),
		);

		let resolved = await resolveCimdClient(url, Date.now());
		expect(resolved).toEqual({ ok: false, reason: "invalid-metadata" });
	});

	test("refuses a document with no redirect_uris", async () => {
		let url = "https://client.example.com/metadata-empty-redirects.json";
		server.use(
			http.get(url, () =>
				HttpResponse.json(
					{ client_id: url, redirect_uris: [] },
					{ headers: { "Content-Type": "application/json" } },
				),
			),
		);

		let resolved = await resolveCimdClient(url, Date.now());
		expect(resolved).toEqual({ ok: false, reason: "invalid-metadata" });
	});

	test("refuses a non-200 response", async () => {
		let url = "https://client.example.com/metadata-missing.json";
		server.use(http.get(url, () => new HttpResponse(null, { status: 404 })));

		let resolved = await resolveCimdClient(url, Date.now());
		expect(resolved).toEqual({ ok: false, reason: "not-found" });
	});

	test("caches a resolution rather than refetching within the TTL", async () => {
		let url = "https://client.example.com/metadata-cached.json";
		let hits = 0;
		server.use(
			http.get(url, () => {
				hits += 1;
				return HttpResponse.json(
					{ client_id: url, redirect_uris: ["https://client.example.com/callback"] },
					{ headers: { "Content-Type": "application/json" } },
				);
			}),
		);

		let now = Date.now();
		await resolveCimdClient(url, now);
		await resolveCimdClient(url, now + 1000);
		expect(hits).toBe(1);

		await resolveCimdClient(url, now + 10 * 60 * 1000);
		expect(hits).toBe(2);
	});
});
