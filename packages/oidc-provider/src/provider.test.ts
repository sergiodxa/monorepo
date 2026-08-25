/**
 * Integration smoke test that drives `createProviderRouter(...).fetch()` end-to-end
 * through the service-container DI the provider wires per request. Guards the
 * regression where a per-request `Database` registered via `container.instance`
 * was invisible to `inject` inside `container.scope(() => router.fetch())`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Logger } from "@pkg/logger/request";
import { describe, expect, test } from "vitest";

import { createProviderRouter } from "./provider";
import { createTestDatabase } from "./shared/test/db";

import type { AnalyticsSink } from "./index";

/** No-op analytics sink, mirroring the provider's self-hosted default. */
let analytics: AnalyticsSink = {
	trackAuthentication() {},
	trackRegistration() {},
};

/**
 * Builds the real provider router over an in-memory database with migrations
 * applied and drives a GET request through its full `fetch` path — the same
 * `container.scope(() => router.fetch())` the host uses in production.
 */
async function fetchThroughProvider(url: string): Promise<Response> {
	let { db } = await createTestDatabase();
	let request = new Request(url);
	let logger = new Logger(request);
	let router = createProviderRouter(db, logger, { internalSecret: "test-secret", analytics });
	return router.fetch(request);
}

describe("createProviderRouter — service-container DI over the full fetch path", () => {
	test("resolves Database inside the request scope for the OAuth metadata endpoint", async () => {
		/**
		 * The oauth-authorization-server handler is wrapped in `inject([Database])`
		 * and reads it via `TenantMeta.getIssuer`, so a working response proves the
		 * per-request Database resolved inside `container.scope`.
		 */
		let response = await fetchThroughProvider(
			"https://auth.example.com/.well-known/oauth-authorization-server",
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { issuer: string; jwks_uri: string };
		/**
		 * Issuer falls back to the request host when TenantMeta has none — the DB
		 * read still happened (it returned null), which is the point of the guard.
		 */
		expect(body.issuer).toBe("https://auth.example.com");
		expect(body.jwks_uri).toBe("https://auth.example.com/.well-known/jwks.json");
	});

	test("resolves Database inside the request scope for the OpenID configuration endpoint", async () => {
		let response = await fetchThroughProvider(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { issuer: string };
		expect(body.issuer).toBe("https://auth.example.com");
	});

	test("resolves Database inside the request scope for the JWKS endpoint", async () => {
		/**
		 * The jwks handler injects Database and calls `SigningKey.getAll(db)`; with a
		 * fresh DB it returns an empty key set — proving the query ran under DI.
		 */
		let response = await fetchThroughProvider("https://auth.example.com/.well-known/jwks.json");

		expect(response.status).toBe(200);
		let body = (await response.json()) as { keys: unknown[] };
		expect(Array.isArray(body.keys)).toBe(true);
	});

	test("does not fail with a 500 from a broken DI path", async () => {
		/**
		 * The original bug surfaced as an uncaught ServiceNotFoundError bubbling to
		 * a 500; a status below 500 here confirms the DI path resolved cleanly.
		 */
		let response = await fetchThroughProvider(
			"https://auth.example.com/.well-known/oauth-authorization-server",
		);

		expect(response.status).toBeLessThan(500);
	});
});
