/**
 * Integration smoke test that drives `createBlogEngine(...).fetch()` end-to-end. It
 * guards the wiring that carries the engine's database from `createBlogEngine` to a
 * controller: the `database()` middleware at the head of the router's chain, and the
 * `ctx.db` every handler reads. A handler reached with no database on the context
 * fails at the first query, so only the full `fetch` path proves the two connect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { Log } from "@sdxc/logger";
import { describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "./shared/test/db.js";

import type { OIDCMetadata } from "./index.js";

import { createBlogEngine } from "./index.js";

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
 * lazily on first request) and drives a GET request through the same `fetch` path
 * production traffic takes.
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

describe("createBlogEngine — the database over the full fetch path", () => {
	test("reads the database from the context for the sitemap endpoint", async () => {
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/sitemap.xml"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("xml");
		let body = await response.text();
		expect(body).toContain("https://blog.example.com/");
	});

	test("reads the database from the context for the home feed", async () => {
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	/**
	 * The 404 fall-through renders the site chrome from the database like any other
	 * page, so an unmapped route proves the middleware covers the default handler.
	 */
	test("reads the database from the context for the 404 fall-through", async () => {
		let engine = createEngine();
		let response = await engine.fetch(new Request("https://blog.example.com/nothing-here"));

		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toContain("text/html");
	});
});

describe("createBlogEngine — logging", () => {
	test("joins the host's log and records the route on it", async () => {
		let engine = createEngine();
		let records: Record<string, unknown>[] = [];
		let host = new Log({ kind: "request", sink: (record) => records.push({ ...record }) });

		let response = await host.run(() =>
			engine.fetch(new Request("https://blog.example.com/sitemap.xml")),
		);

		expect(response.status).toBe(200);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ route: "/sitemap.xml", "http.method": "GET" });
	});
});
