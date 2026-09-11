/**
 * Tests the `/healthcheck/analytics-engine` controller's "binding not
 * configured" branch: with no `PING_RESULTS` on `env`, the controller's
 * binding guard alone produces a 503, ahead of the read-API probe. The env
 * is deliberately non-strict here since the missing binding is the
 * scenario under test — the controller reads
 * `env.PING_RESULTS?.writeDataPoint`, and a strict env would throw on that
 * read before the guard could answer. The "degraded" branch is covered in
 * `healthcheck-analytics-engine-degraded.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}, { strict: false }) }));

let { default: healthcheckAnalyticsEngine } = await import("./healthcheck-analytics-engine");

describe("GET /healthcheck/analytics-engine", () => {
	test("returns 503 when the PING_RESULTS binding is not configured", async () => {
		let { db } = createTestDatabase();

		let router = createRouter({ middleware: [database(() => db)] });
		router.map(routes.healthcheckAnalyticsEngine, healthcheckAnalyticsEngine);

		let request = new Request(`https://example.com${routes.healthcheckAnalyticsEngine.href()}`);
		let response = await router.fetch(request);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: "error",
			message: "Analytics Engine binding (PING_RESULTS) not configured",
		});
	});
});
