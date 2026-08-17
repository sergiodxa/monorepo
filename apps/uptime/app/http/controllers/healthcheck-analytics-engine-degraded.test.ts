/**
 * Tests the `/healthcheck/analytics-engine` controller's "degraded" branch: the
 * `PING_RESULTS` binding is a real in-memory Analytics Engine dataset, so writes
 * genuinely work, but the Analytics Engine read-API probe fails: MSW answers the SQL
 * API with a transport error, so the `fetch` inside `queryAnalytics` rejects and it
 * returns a `failure()` Result. The controller must still respond 200, since writes
 * keep working even though the read API is down — see the source's docblock. Split into
 * its own file (rather than a second `describe` in
 * `healthcheck-analytics-engine.test.ts`) because Bun's module cache does not
 * re-run `cloudflare:workers`' mocked top-level code on a second dynamic import of
 * the controller within the same file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/** The write binding the controller probes; module-scoped because `env` is captured on import. */
let pingResults = createAnalyticsEngine();

await mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		PING_RESULTS: pingResults,
	}),
}));

let { default: healthcheckAnalyticsEngine } = await import("./healthcheck-analytics-engine");

/** The Analytics Engine SQL API endpoint the read probe POSTs to. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

/**
 * MSW server failing the SQL API at the transport level. A non-2xx would exercise the
 * other branch of `queryAnalytics`; this one is the unreachable-read-API case.
 */
let server = setupServer(http.post(SQL_URL, () => HttpResponse.error()));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /healthcheck/analytics-engine", () => {
	test("returns 200 degraded when the write binding works but the read API fails", async () => {
		let { db } = createTestDatabase();

		let router = createRouter();
		router.map(routes.healthcheckAnalyticsEngine, healthcheckAnalyticsEngine);

		let container = new ServiceContainer();
		container.singleton(Database, () => db);

		let request = new Request(`https://example.com${routes.healthcheckAnalyticsEngine.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			status: string;
			binding: boolean;
			apiConnected: boolean;
			eventCount: number | null;
			message: string;
		};
		expect(body.status).toBe("degraded");
		expect(body.binding).toBe(true);
		expect(body.apiConnected).toBe(false);
		expect(body.eventCount).toBeNull();
		// The rejection's own message is surfaced, so an operator reading the healthcheck
		// sees why the read API is unreachable rather than a generic "degraded".
		expect(body.message).toContain("Failed to fetch");
	});
});
