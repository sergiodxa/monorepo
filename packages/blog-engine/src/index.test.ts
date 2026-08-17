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
} as OIDCMetadata;

/**
 * Builds the real blog engine over an in-memory database adapter (the engine runs
 * its own migrations lazily before the first request) and drives a GET request
 * through its full `fetch` path — the same `container.scope(() => router.fetch())`
 * the host uses in production.
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
		// The sitemap handler is wrapped in `inject([Database])` and queries post
		// types/posts, so a working XML response proves the per-request Database
		// resolved inside `container.scope`.
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/sitemap.xml"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("xml");
		let body = await response.text();
		// A freshly-seeded blog always has at least the home URL in its sitemap.
		expect(body).toContain("https://blog.example.com/");
	});

	test("resolves Database inside the request scope for the home feed", async () => {
		// The home feed (`GET /`) is also wrapped in `inject([Database])`; it renders
		// HTML from `loadSiteChrome`/`PostType.findVisible`, both DB-backed.
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	test("does not fail with a 500 from a broken DI path", async () => {
		// Negative guard: the original bug surfaced as an uncaught ServiceNotFoundError
		// bubbling to a 500. Any 2xx/3xx/4xx is acceptable; a 500 is not.
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/sitemap.xml"));

		expect(response.status).toBeLessThan(500);
	});
});
