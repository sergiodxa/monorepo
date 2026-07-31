/**
 * Tests `POST /api/v1/cron-jobs/:cronJobId/ping`: the public, unauthenticated
 * ping endpoint for dead man's switch monitoring. Covers a healthy on-time ping,
 * 404 for an unknown cron job id, 409 for a disabled job, 429 for a ping within the
 * per-monitor window, and 429 once a caller has spent its own budget — two limits
 * with two different purposes, so both are exercised. `Resend` is registered as a
 * fake in the service container the same way `app/jobs/check-ssl.test.ts` does; no
 * seeded alerts means `notifyCronJobResult` never actually dispatches, so no real
 * network call happens.
 *
 * `cloudflare:workers` is mocked before the dynamic import of the controller because
 * the caller budget reads its backend off `env`. The double stands in for the
 * `RATE_LIMITER` binding, counting per key exactly as the platform's does, which is
 * what lets the budget be asserted without the counting being real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { Resend } from "resend";

import CronJobMonitor from "~/app/data/cron-job";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobMonitors, cronJobPings, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The binding's declared `simple.limit` in `wrangler.jsonc`, mirrored by the controller. */
const CALLER_LIMIT = 60;

/** Attempts counted per key by the {@link rateLimiter} double, one window per test run. */
let counts = new Map<string, number>();

/**
 * Stand-in for the `RATE_LIMITER` binding: counts per key and refuses past
 * {@link CALLER_LIMIT}, which is the whole contract the real binding exposes.
 */
let rateLimiter = {
	async limit({ key }: { key: string }) {
		let used = (counts.get(key) ?? 0) + 1;
		counts.set(key, used);
		return { success: used <= CALLER_LIMIT };
	},
};

mock.module("cloudflare:workers", () => ({ env: { RATE_LIMITER: rateLimiter } }));

let { default: cronJobPing } = await import("~/app/http/controllers/api/cron-job-ping");

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function createCronJobRow(db: Db, teamId: string, overrides: Record<string, unknown> = {}) {
	return await CronJobMonitor.create(db, teamId, {
		name: "Nightly backup",
		description: null,
		cron_expression: "0 0 * * *",
		grace_period_seconds: 300,
		timezone: "UTC",
		alert_on_late: false,
		enabled_at: Date.now(),
		...overrides,
	});
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.cronJobPing, cronJobPing);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));

	return container.scope(() => router.fetch(request));
}

/**
 * A ping request, optionally from a named caller. `CF-Connecting-IP` is the only
 * address the caller budget keys on, so a test that omits it lands in the shared
 * "unknown" bucket — which is why the budget test names one.
 */
function ping(cronJobId: string, address?: string) {
	let headers = new Headers();
	if (address !== undefined) headers.set("CF-Connecting-IP", address);

	return new Request(`https://uptime.test${routes.api.cronJobPing.href({ cronJobId })}`, {
		method: "POST",
		headers,
	});
}

describe("POST /api/v1/cron-jobs/:cronJobId/ping", () => {
	test("records an on-time ping and returns 201", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);

		let response = await dispatch(db, ping(monitor.id));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { wasOnTime: boolean };
		expect(body.wasOnTime).toBe(true);

		let updated = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(updated?.status).toBe("healthy");
		expect(updated?.last_ping_at).not.toBeNull();

		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(1);
		expect(pings[0]?.was_on_time).toBeTruthy();
	});

	test("returns 404 for an unknown cron job id", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, ping(crypto.randomUUID()));
		expect(response.status).toBe(404);
	});

	test("returns 409 for a disabled job", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id, { enabled_at: null });

		let response = await dispatch(db, ping(monitor.id));
		expect(response.status).toBe(409);

		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.last_ping_at).toBeNull();
	});

	test("returns 429 for a ping within the rate-limit window", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);
		await CronJobMonitor.updateById(db, monitor.id, { last_ping_at: Date.now() - 1000 });

		let response = await dispatch(db, ping(monitor.id));
		expect(response.status).toBe(429);

		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(0);
	});

	test("refuses a caller that has spent its budget, and describes the policy", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);
		let address = "203.0.113.10";

		// Only the first ping is accepted — the rest are refused by the per-monitor
		// rule — but every one of them spends caller budget, which is the point: the
		// cost of a refusal is what this limit bounds.
		for (let attempt = 0; attempt < CALLER_LIMIT; attempt++) {
			let response = await dispatch(db, ping(monitor.id, address));
			expect(response.status).toBe(attempt === 0 ? 201 : 429);
		}

		let refused = await dispatch(db, ping(monitor.id, address));
		expect(refused.status).toBe(429);
		expect(refused.headers.get("RateLimit-Policy")).toBe(`${CALLER_LIMIT};w=60`);

		// The caller budget's own body rather than the per-monitor rule's, so this
		// refusal came from the middleware and the handler never ran.
		let body = (await refused.json()) as { error: string };
		expect(body.error).toBe("too_many_requests");
	});

	test("keeps one monitor's exhausted budget off another's", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let noisy = await createCronJobRow(db, team.id);
		let quiet = await createCronJobRow(db, team.id);
		let address = "203.0.113.20";

		for (let attempt = 0; attempt <= CALLER_LIMIT; attempt++) {
			await dispatch(db, ping(noisy.id, address));
		}
		expect((await dispatch(db, ping(noisy.id, address))).status).toBe(429);

		// Same caller, different monitor: its own bucket, so a shared egress address
		// cannot let one job starve every other job behind it.
		let served = await dispatch(db, ping(quiet.id, address));
		expect(served.status).toBe(201);
	});
});
