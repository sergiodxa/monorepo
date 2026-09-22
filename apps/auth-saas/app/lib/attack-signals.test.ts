/**
 * Exercises the attack-signals module: `recordAttackSignal` writes one
 * analytics data point per call with the exact blob/double layout a query
 * relies on, swallows a write failure rather than letting it propagate, and
 * `readFailedSignInsByHour` sends the SQL query a security dashboard would
 * run and parses back what the Analytics Engine SQL API answers. The SQL
 * endpoint is stubbed with MSW, the way `usage-reporting.test.ts` stubs it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import type { AttackSignalEnv } from "./attack-signals";

import { readFailedSignInsByHour, recordAttackSignal } from "./attack-signals";

/** An `AttackSignalEnv` whose `writeDataPoint` is a spy, so a test can assert what it was called with. */
function createAttackSignalEnv(): AttackSignalEnv & { writeDataPoint: ReturnType<typeof vi.fn> } {
	let writeDataPoint = vi.fn();
	return { ANALYTICS: { writeDataPoint }, writeDataPoint };
}

describe("recordAttackSignal", () => {
	test("writes a refused-credential signal with the outcome's own detail", () => {
		let env = createAttackSignalEnv();

		recordAttackSignal(env, {
			tenantId: "ten_1",
			surface: "credential",
			outcome: "refused-credential",
			reason: "invalid-credentials",
			country: "US",
		});

		expect(env.writeDataPoint).toHaveBeenCalledTimes(1);
		expect(env.writeDataPoint).toHaveBeenCalledWith({
			indexes: ["ten_1"],
			blobs: [
				"attack_signal",
				"ten_1",
				"credential",
				"refused-credential",
				"invalid-credentials",
				"US",
			],
			doubles: [1],
		});
	});

	test("writes a rate-limit refusal with no reason or country as empty blobs", () => {
		let env = createAttackSignalEnv();

		recordAttackSignal(env, {
			tenantId: "ten_2",
			surface: "token",
			outcome: "refused-rate-limit",
			reason: "rate_limit.exceeded",
		});

		expect(env.writeDataPoint).toHaveBeenCalledWith({
			indexes: ["ten_2"],
			blobs: ["attack_signal", "ten_2", "token", "refused-rate-limit", "rate_limit.exceeded", ""],
			doubles: [1],
		});
	});

	test("writes a bare success signal", () => {
		let env = createAttackSignalEnv();

		recordAttackSignal(env, { tenantId: "ten_3", surface: "credential", outcome: "succeeded" });

		expect(env.writeDataPoint).toHaveBeenCalledWith({
			indexes: ["ten_3"],
			blobs: ["attack_signal", "ten_3", "credential", "succeeded", "", ""],
			doubles: [1],
		});
	});

	test("swallows a write failure rather than letting it propagate", () => {
		let env = createAttackSignalEnv();
		env.writeDataPoint.mockImplementation(() => {
			throw new Error("analytics unavailable");
		});

		expect(() => {
			recordAttackSignal(env, { tenantId: "ten_1", surface: "credential", outcome: "succeeded" });
		}).not.toThrow();
	});
});

describe("readFailedSignInsByHour", () => {
	let ENGINE = { accountId: "acct_1", apiToken: "test-cf-token" };
	let SQL_URL = `https://api.cloudflare.com/client/v4/accounts/${ENGINE.accountId}/analytics_engine/sql`;

	let server = setupServer();
	beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
	afterEach(() => server.resetHandlers());
	afterAll(() => server.close());

	test("sends the failed-sign-ins-per-hour query and parses the rows back", async () => {
		let capturedBody: string | null = null;
		let capturedAuth: string | null = null;

		server.use(
			http.post(SQL_URL, async ({ request }) => {
				capturedBody = await request.text();
				capturedAuth = request.headers.get("Authorization");
				return HttpResponse.json({
					data: [
						{ hour: "2026-09-22 14:00:00", count: 3 },
						{ hour: "2026-09-22 15:00:00", count: 12 },
					],
				});
			}),
		);

		let rows = await readFailedSignInsByHour(ENGINE, {
			tenantId: "ten_1",
			from: Date.UTC(2026, 8, 22, 14, 0, 0),
			to: Date.UTC(2026, 8, 22, 16, 0, 0),
		});

		expect(rows).toEqual([
			{ hour: "2026-09-22 14:00:00", count: 3 },
			{ hour: "2026-09-22 15:00:00", count: 12 },
		]);

		expect(capturedAuth).toBe(`Bearer ${ENGINE.apiToken}`);
		expect(capturedBody).toContain("FROM auth-saas-analytics");
		expect(capturedBody).toContain("blob1 = 'attack_signal'");
		expect(capturedBody).toContain("blob2 = 'ten_1'");
		expect(capturedBody).toContain("blob4 = 'refused-credential'");
		expect(capturedBody).toContain("toDateTime('2026-09-22 14:00:00')");
		expect(capturedBody).toContain("toDateTime('2026-09-22 16:00:00')");
	});

	test("throws with the response body when the SQL API answers an error", async () => {
		server.use(http.post(SQL_URL, () => HttpResponse.text("bad query", { status: 400 })));

		await expect(
			readFailedSignInsByHour(ENGINE, { tenantId: "ten_1", from: 0, to: 1 }),
		).rejects.toThrow(/bad query/);
	});

	test("rejects a tenant id outside a typeid's own charset before querying", async () => {
		server.use(
			http.post(SQL_URL, () => {
				throw new Error("should never be called");
			}),
		);

		await expect(
			readFailedSignInsByHour(ENGINE, { tenantId: "ten_1'; DROP TABLE x --", from: 0, to: 1 }),
		).rejects.toThrow(TypeError);
	});
});
