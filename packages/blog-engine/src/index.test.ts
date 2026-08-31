/**
 * Integration smoke test that drives `createBlogEngine(...).fetch()` end-to-end
 * through the service-container DI the engine wires per request. It guards the
 * regression fixed in 8f8cb73 where a per-request `Database` registered via
 * `container.instance(Database, db)` was invisible inside
 * `container.scope(() => router.fetch())`, throwing `ServiceNotFoundError` on every
 * request that resolved `Database` via `inject`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "./shared/test/db";

import type { OIDCMetadata } from "./index";

import { createBlogEngine } from "./index";

/**
 * Inline OIDC metadata so the relying-party config never triggers network
 * discovery — the smoke test targets a public route that does not exercise auth,
 * but supplying metadata keeps construction fully offline and deterministic.
 */
let metadata: OIDCMetadata = {
	issuer: "https://auth.example.com",
	authorization_endpoint: "https://auth.example.com/authorize",
	token_endpoint: "https://auth.example.com/oauth/token",
	userinfo_endpoint: "https://auth.example.com/userinfo",
	jwks_uri: "https://auth.example.com/.well-known/jwks.json",
};

/**
 * Builds the real blog engine over an in-memory database adapter (migrations run
 * lazily on first request) and drives a GET request through the same `fetch`
 * path production traffic takes via `container.scope(() => router.fetch())`.
 */
function createEngine() {
	let sqliteDb = openDatabase(":memory:");
	let adapter = createSqliteDatabaseAdapter(sqliteDb);
	return createBlogEngine({
		database: adapter,
		auth: {
			issuer: "https://auth.example.com",
			clientId: "blog-admin",
			clientSecret: "test-secret",
			metadata,
		},
		session: { secret: "session-secret" },
	});
}

describe("createBlogEngine — service-container DI over the full fetch path", () => {
	test("resolves Database inside the request scope for the sitemap endpoint", async () => {
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/sitemap.xml"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("xml");
		let body = await response.text();
		expect(body).toContain("https://blog.example.com/");
	});

	test("resolves Database inside the request scope for the home feed", async () => {
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	/**
	 * The original bug surfaced as an uncaught `ServiceNotFoundError` bubbling
	 * to a 500, so any 2xx/3xx/4xx response demonstrates the fix — only a 500
	 * indicates the regression.
	 */
	test("does not fail with a 500 from a broken DI path", async () => {
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/sitemap.xml"));

		expect(response.status).toBeLessThan(500);
	});
});
