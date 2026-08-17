/**
 * Tests the `/healthcheck/analytics-engine` controller's "binding not configured"
 * branch: with no `PING_RESULTS` on `cloudflare:workers`' `env`, the controller must
 * respond 503 without ever attempting the read-API probe. This is the one case where
 * the env is deliberately non-strict, since a missing binding is the subject rather
 * than a mistake: the controller reads `env.PING_RESULTS?.writeDataPoint`, and a
 * strict env would throw on that read instead of letting the guard answer. The
 * "degraded" (writes work, reads fail) branch is covered separately in
 * `healthcheck-analytics-engine-degraded.test.ts`, since `cloudflare:workers` is
 * mocked once per file via `mock.module` before the controller's dynamic import,
 * and Bun's module cache does not re-run a specifier's top-level code on a second
 * dynamic import within the same file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}, { strict: false }) }));

let { default: healthcheckAnalyticsEngine } = await import("./healthcheck-analytics-engine");

describe("GET /healthcheck/analytics-engine", () => {
	test("returns 503 when the PING_RESULTS binding is not configured", async () => {
		let { db } = createTestDatabase();

		let router = createRouter();
		router.map(routes.healthcheckAnalyticsEngine, healthcheckAnalyticsEngine);

		let container = new ServiceContainer();
		container.singleton(Database, () => db);

		let request = new Request(`https://example.com${routes.healthcheckAnalyticsEngine.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: "error",
			message: "Analytics Engine binding (PING_RESULTS) not configured",
		});
	});
});
