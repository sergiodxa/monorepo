/**
 * Tests the `/healthcheck/analytics-engine` controller's degraded branch: the
 * `PING_RESULTS` binding writes to a real in-memory Analytics Engine dataset,
 * but MSW fails the SQL read API at the transport level, so `queryAnalytics`
 * returns `failure()` and the controller responds 200 degraded. Split from
 * `healthcheck-analytics-engine.test.ts` because Vitest caches the
 * dynamically imported controller per file, so a dedicated file guarantees
 * `vi.doMock("cloudflare:workers")` mocks the instance under test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/** The write binding the controller probes; module-scoped because `env` is captured on import. */
let pingResults = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
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
		expect(body.message).toContain("Failed to fetch");
	});
});
