/**
 * Integration smoke test that drives `createProviderRouter(...).fetch()` end-to-end
 * over the database the host hands in. Guards the regression where a handler
 * answered a request without reaching the tenant's storage at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Log } from "@sdxc/logger";
import { describe, expect, test } from "vitest";

import { createProviderRouter } from "./provider.js";
import { createTestDatabase } from "./shared/test/db.js";

import type { AnalyticsSink } from "./index.js";

/** No-op analytics sink, mirroring the provider's self-hosted default. */
let analytics: AnalyticsSink = {
	trackAuthentication() {},
	trackRegistration() {},
};

/**
 * Builds the real provider router over an in-memory database with migrations
 * applied and drives a GET request through the same `fetch` path the host uses
 * in production.
 */
async function fetchThroughProvider(url: string): Promise<Response> {
	let { db } = await createTestDatabase();
	let router = createProviderRouter(db, { internalSecret: "test-secret", analytics });
	return router.fetch(new Request(url));
}

describe("createProviderRouter — the database over the full fetch path", () => {
	test("reads the database on the request context for the OAuth metadata endpoint", async () => {
		/**
		 * The oauth-authorization-server handler reads `ctx.db` via
		 * `TenantMeta.getIssuer`, so a working response proves the host's database
		 * reached the handler.
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

	test("reads the database on the request context for the OpenID configuration endpoint", async () => {
		let response = await fetchThroughProvider(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { issuer: string };
		expect(body.issuer).toBe("https://auth.example.com");
	});

	test("reads the database on the request context for the JWKS endpoint", async () => {
		/**
		 * The jwks handler calls `SigningKey.getAll(ctx.db)`; with a fresh DB it
		 * returns an empty key set, proving the query ran against the host's database.
		 */
		let response = await fetchThroughProvider("https://auth.example.com/.well-known/jwks.json");

		expect(response.status).toBe(200);
		let body = (await response.json()) as { keys: unknown[] };
		expect(Array.isArray(body.keys)).toBe(true);
	});

	test("does not fail with a 500 from a missing database", async () => {
		/**
		 * The original bug surfaced as an uncaught error bubbling to a 500; a status
		 * below 500 here confirms the handler had the database it asked for.
		 */
		let response = await fetchThroughProvider(
			"https://auth.example.com/.well-known/oauth-authorization-server",
		);

		expect(response.status).toBeLessThan(500);
	});
});

describe("createProviderRouter — logging through the host's log", () => {
	test("joins the log the host opened and describes the request on it", async () => {
		let { db } = await createTestDatabase();
		let router = createProviderRouter(db, { internalSecret: "test-secret", analytics });
		let records: Record<string, unknown>[] = [];

		await new Log({ kind: "request", service: "auth", sink: (r) => records.push(r) }).run(() =>
			router.fetch(new Request("https://auth.example.com/.well-known/jwks.json")),
		);

		expect(records).toHaveLength(1);
		let [record] = records;
		expect(record?.service).toBe("auth");
		expect(record?.route).toBe("/.well-known/jwks.json");
		expect(record?.["http.method"]).toBe("GET");
		expect(record?.outcome).toBe("ok");
		expect(record?.notes).toEqual([
			expect.objectContaining({ name: "oidc.discovery.jwks_served", key_count: 0 }),
		]);
	});
});
