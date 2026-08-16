/**
 * Tests the `/healthcheck/analytics-engine` controller's "degraded" branch: the
 * `PING_RESULTS` binding is a real in-memory Analytics Engine dataset, so writes
 * genuinely work, but the Analytics Engine read-API probe fails (simulated via a
 * rejecting global `fetch`, the same way `app/services/analytics.test.ts` stubs
 * it), so `queryAnalytics` returns a
 * `failure()` Result. The controller must still respond 200, since writes keep
 * working even though the read API is down — see the source's docblock. Split into
 * its own file (rather than a second `describe` in
 * `healthcheck-analytics-engine.test.ts`) because Bun's module cache does not
 * re-run `cloudflare:workers`' mocked top-level code on a second dynamic import of
 * the controller within the same file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/** The write binding the controller probes; module-scoped because `env` is captured on import. */
let pingResults = createAnalyticsEngine();

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		PING_RESULTS: pingResults,
	}),
}));

let { default: healthcheckAnalyticsEngine } = await import("./healthcheck-analytics-engine");

globalThis.fetch = mock(async (..._args: unknown[]) => {
	throw new Error("network unreachable");
}) as unknown as typeof fetch;

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
		expect(body.message).toContain("network unreachable");
	});
});
